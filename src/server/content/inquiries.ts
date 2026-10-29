/**
 * Form inquiries from the connected website (contact, quote, custom forms).
 * One entry point for the public API and any built-in forms: createInquiry()
 * validates, filters spam, stores, notifies staff and emits inquiry.created.
 */
import { and, count, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { inquiries, sequences, users } from "@/server/db/schema";
import { emit } from "@/server/events";
import { hit } from "@/server/lib/rate-limit";
import { sendMail } from "@/server/mail/mailer";
import { notify } from "@/server/notifications";
import { appUrl } from "@/server/lib/app-url";
import { getSettings } from "@/server/settings";
import { dayStart, addDays } from "@/lib/tz";
import { site } from "@/content/site";

export type Inquiry = typeof inquiries.$inferSelect;
export type InquiryStatus = Inquiry["status"];

export const INQUIRY_STATUS: Record<InquiryStatus, { label: string; pill: string }> = {
  new: { label: "Neu", pill: "warn" },
  open: { label: "Offen", pill: "info" },
  quoted: { label: "Offerte gesendet", pill: "info" },
  done: { label: "Erledigt", pill: "ok" },
  spam: { label: "Spam", pill: "muted" },
};

/** Limits for the spam filter (exported for tests and the API docs). */
export const SPAM_RULES = {
  /** a form filled faster than this was not filled by a person */
  minFillMs: 3_000,
  /** links in the message from this count on mark the inquiry as spam */
  maxLinks: 3,
  /** accepted submissions per IP and window */
  perIp: 5,
  windowMs: 10 * 60_000,
};

const text = (max: number) => z.string().trim().max(max).optional().default("");

export const inquiryInput = z.object({
  form: z
    .string()
    .trim()
    .max(60)
    .regex(/^[\p{L}\p{N} _.-]*$/u, "Der Formularname darf nur Buchstaben, Zahlen, Leerzeichen, - _ und . enthalten.")
    .optional()
    .default("kontakt")
    .transform((v) => v || "kontakt"),
  name: text(200),
  email: z.string().trim().max(254).email("Bitte eine gültige E-Mail-Adresse angeben."),
  phone: text(60),
  company: text(200),
  subject: text(300),
  message: z.string().trim().max(10_000, "Die Nachricht ist zu lang (max. 10'000 Zeichen).").optional().default(""),
  fields: z
    .record(z.string().max(80), z.union([z.string().max(5_000), z.number(), z.boolean(), z.null()]))
    .optional()
    .default({})
    .refine((f) => Object.keys(f).length <= 50, "Höchstens 50 Zusatzfelder."),
  sourceUrl: z.string().trim().max(2_000).optional().default(""),
  /** hidden field that people leave empty ("website_url" in your form) */
  honeypot: z.string().max(2_000).optional().default(""),
  /** time the form was rendered (ms since epoch) – enables the minimum fill time check */
  startedAt: z.number().int().positive().optional(),
});

export type InquiryInput = z.input<typeof inquiryInput>;
export type InquiryMeta = {
  ip: string;
  now?: Date;
  /** send the person a confirmation that the enquiry arrived (website forms; not for spam) */
  confirm?: boolean;
};

/** Counts links in a text (http(s)://, www., [url=…]). */
export function countLinks(s: string) {
  return (s.match(/https?:\/\/|www\.|\[url=/gi) ?? []).length;
}

/** Spam reasons for an already validated input (empty = looks fine). */
export function spamReasons(input: z.output<typeof inquiryInput>, now = Date.now()): string[] {
  const reasons: string[] = [];
  const pot = input.honeypot || String(input.fields.website_url ?? "") || String(input.fields.honeypot ?? "");
  if (pot.trim()) reasons.push("honeypot");
  if (input.startedAt && now - input.startedAt < SPAM_RULES.minFillMs) reasons.push("too_fast");
  if (countLinks(`${input.subject} ${input.message}`) >= SPAM_RULES.maxLinks) reasons.push("links");
  return reasons;
}

/** Next reference like "A-2026-00042" (atomic counter per year). */
export async function nextReference(now = new Date()) {
  const year = now.toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" }).slice(0, 4);
  const [row] = await db
    .insert(sequences)
    .values({ key: `inquiry:${year}`, value: 1 })
    .onConflictDoUpdate({ target: sequences.key, set: { value: sql`${sequences.value} + 1` } })
    .returning({ value: sequences.value });
  return `A-${year}-${String(row.value).padStart(5, "0")}`;
}

export type CreateResult =
  | { ok: true; id: string; reference: string; status: InquiryStatus; spam: string[] }
  | { ok: false; code: "validation" | "rate_limited"; message: string; fieldErrors?: Record<string, string> };

export async function createInquiry(raw: unknown, meta: InquiryMeta): Promise<CreateResult> {
  const parsed = inquiryInput.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { ok: false, code: "validation", message: parsed.error.issues[0].message, fieldErrors };
  }
  const input = parsed.data;
  const now = meta.now ?? new Date();
  const limit = await hit(`inquiry:${meta.ip || "unknown"}`, SPAM_RULES.perIp, SPAM_RULES.windowMs);
  if (!limit.allowed) return { ok: false, code: "rate_limited", message: "Zu viele Anfragen von dieser Adresse. Bitte versuchen Sie es in einigen Minuten erneut." };

  const spam = spamReasons(input, now.getTime());
  const status: InquiryStatus = spam.length ? "spam" : "new";
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.fields)) {
    if (k === "website_url" || k === "honeypot" || v === null) continue;
    fields[k] = typeof v === "boolean" ? (v ? "Ja" : "Nein") : String(v);
  }
  const reference = await nextReference(now);
  const [row] = await db
    .insert(inquiries)
    .values({
      reference,
      form: input.form,
      status,
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      company: input.company,
      subject: input.subject,
      message: input.message,
      fields,
      sourceUrl: /^https?:\/\//i.test(input.sourceUrl) ? input.sourceUrl : "",
      ip: meta.ip,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (status === "new") await announce(row);
  if (status === "new" && meta.confirm) await confirmToSender(row);
  return { ok: true, id: row.id, reference, status, spam };
}

/** Forms with their own recipients (Einstellungen → E-Mail); every other form uses the standard list. */
export const RECIPIENT_FORMS = { Kontakt: "notifyContact", "Kostenlose Analyse": "notifyAnalysis", Terminanfrage: "notifyChat" } as const;

const envRecipients = () => (process.env.CONTACT_TO_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);

/** Who gets the e-mail for a new enquiry: the list of its form, else the standard list, else CONTACT_TO_EMAIL. */
export async function inquiryRecipients(form: string): Promise<string[]> {
  const e = await getSettings("email");
  const own = form in RECIPIENT_FORMS ? e[RECIPIENT_FORMS[form as keyof typeof RECIPIENT_FORMS]] : [];
  return own.length ? own : e.notifyInquiry.length ? e.notifyInquiry : envRecipients();
}

/** "Danke, wir melden uns": confirmation to the person who sent the enquiry. Replies go to the team. */
async function confirmToSender(row: Inquiry) {
  const first = row.name.trim().split(/\s+/)[0];
  const hello = first ? `, ${first}` : "";
  const phone = site.contact.phonePrimary.label;
  const domain = row.fields.Website ? row.fields.Website.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  const kind = row.form === "Terminanfrage" ? "termin" : row.form === "Kostenlose Analyse" ? "analyse" : "kontakt";
  const text = {
    termin: { subject: "Ihr Terminwunsch ist angekommen", title: `Danke für Ihren Terminwunsch${hello}`, intro: "Wir prüfen den Termin und bestätigen ihn Ihnen persönlich – in der Regel innerhalb von 24 Stunden." },
    analyse: { subject: "Ihre Anfrage für eine Website-Analyse", title: `Danke für Ihr Interesse${hello}`, intro: `Wir sehen uns ${domain || "Ihre Website"} persönlich an und melden uns innerhalb von 24 Stunden mit den Ergebnissen und konkreten Vorschlägen.` },
    kontakt: { subject: "Wir haben Ihre Nachricht erhalten", title: `Danke für Ihre Nachricht${hello}`, intro: "Wir melden uns in der Regel innerhalb von 24 Stunden – an Werktagen oft schon am selben Tag." },
  }[kind];
  const rows: [string, string][] = [["Referenz", row.reference]];
  const readable = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00Z`).toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : v);
  for (const k of ["Leistung", "Paket", "Wunschdatum", "Zeitfenster", "Website"]) if (row.fields[k]) rows.push([k, readable(row.fields[k])]);
  const e = await getSettings("email");
  const replyTo = e.replyTo || (await inquiryRecipients(row.form))[0];
  await sendMail({
    to: row.email,
    subject: `${text.subject} (${row.reference})`,
    template: "inquiry.confirmation",
    replyTo,
    related: { type: "inquiry", id: row.id },
    content: {
      kicker: `Ihre Anfrage ${row.reference}`,
      title: text.title,
      intro: text.intro,
      quote: row.message && kind !== "analyse" ? { label: "Ihre Nachricht", text: row.message.length > 1200 ? `${row.message.slice(0, 1200)} …` : row.message } : undefined,
      rows,
      cta: { label: "Unsere Projekte ansehen", url: appUrl("/website-portfolio") },
      footnote: `Möchten Sie etwas ergänzen? Antworten Sie einfach auf diese E-Mail. Ist es dringend, erreichen Sie uns unter ${phone}.`,
      reason: `Sie erhalten diese E-Mail, weil Sie auf ${site.url.replace(/^https?:\/\//, "")} eine Anfrage gesendet haben.`,
    },
  }).catch(() => {});
}

/** Staff notification (in-app + e-mail) and webhook for a new, non-spam inquiry. */
async function announce(row: Inquiry) {
  const href = `/madexadm/anfragen/${row.id}`;
  const who = row.name || row.email;
  await notify({ type: "inquiry", title: `Neue Anfrage von ${who}`, body: row.subject || row.message.slice(0, 140), href, permission: "inquiries.view" });
  const notifyInquiry = await inquiryRecipients(row.form);
  if (notifyInquiry.length) {
    const rows: [string, string][] = [
      ["Name", row.name],
      ["E-Mail", row.email],
    ];
    if (row.phone) rows.push(["Telefon", row.phone]);
    if (row.company) rows.push(["Firma", row.company]);
    for (const [k, v] of Object.entries(row.fields)) rows.push([k, v]);
    if (row.sourceUrl) rows.push(["Seite", row.sourceUrl]);
    await sendMail({
      to: notifyInquiry,
      subject: `Neue Anfrage ${row.reference}${row.subject ? `: ${row.subject}` : ""}`,
      template: "inquiry.staff",
      replyTo: row.email,
      related: { type: "inquiry", id: row.id },
      content: {
        kicker: `${row.form} · ${row.reference}`,
        title: `Neue Anfrage von ${who}`,
        intro: row.subject || `Über das Formular «${row.form}».`,
        quote: row.message ? { label: "Nachricht", text: row.message } : undefined,
        rows,
        cta: { label: "Im Dashboard öffnen", url: appUrl(href) },
        footnote: "Antworten Sie direkt auf diese E-Mail – die Antwort geht an die anfragende Person.",
      },
    }).catch(() => {});
  }
  await emit("inquiry.created", {
    id: row.id,
    reference: row.reference,
    form: row.form,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    subject: row.subject,
    message: row.message,
    fields: row.fields,
    sourceUrl: row.sourceUrl,
    createdAt: row.createdAt.toISOString(),
  });
}

/* ---------- admin queries ---------- */

export type InquiryFilter = { status?: InquiryStatus | "all"; q?: string; form?: string; from?: string; to?: string };

export function inquiryWhere(f: InquiryFilter, withStatus = true): SQL | undefined {
  const conds: (SQL | undefined)[] = [];
  if (withStatus && f.status && f.status !== "all") conds.push(eq(inquiries.status, f.status));
  if (f.form) conds.push(eq(inquiries.form, f.form));
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    conds.push(or(ilike(inquiries.name, like), ilike(inquiries.email, like), ilike(inquiries.company, like), ilike(inquiries.subject, like), ilike(inquiries.message, like), ilike(inquiries.reference, like)));
  }
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) conds.push(gte(inquiries.createdAt, dayStart(f.from)));
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) conds.push(lt(inquiries.createdAt, dayStart(addDays(f.to, 1))));
  const list = conds.filter(Boolean) as SQL[];
  return list.length ? and(...list) : undefined;
}

export async function inquiryCounts(f: InquiryFilter) {
  const rows = await db.select({ status: inquiries.status, n: count() }).from(inquiries).where(inquiryWhere(f, false)).groupBy(inquiries.status);
  const out: Record<InquiryStatus | "all", number> = { new: 0, open: 0, quoted: 0, done: 0, spam: 0, all: 0 };
  for (const r of rows) {
    out[r.status] = r.n;
    if (r.status !== "spam") out.all += r.n;
  }
  return out;
}

/** "Alle" hides spam unless the spam tab is chosen. */
export function listWhere(f: InquiryFilter) {
  const base = inquiryWhere(f);
  return f.status === "all" || !f.status ? and(base, sql`${inquiries.status} <> 'spam'`) : base;
}

export async function listInquiries(f: InquiryFilter, page: number, perPage = 25) {
  const where = listWhere(f);
  const [{ n }] = await db.select({ n: count() }).from(inquiries).where(where);
  const rows = await db
    .select()
    .from(inquiries)
    .where(where)
    .orderBy(desc(inquiries.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);
  return { rows, total: n };
}

export async function inquiryForms() {
  const rows = await db.selectDistinct({ form: inquiries.form }).from(inquiries).orderBy(inquiries.form);
  return rows.map((r) => r.form);
}

export async function assignableUsers() {
  const rows = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.status, "active")).orderBy(users.name);
  return rows;
}

/** Display label of an extra field key: "preferred_date" → "Preferred date". */
export function fieldLabel(key: string) {
  const s = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Rows for the CSV export. */
export function inquiryCsvRows(rows: Inquiry[]) {
  const extraKeys = [...new Set(rows.flatMap((r) => Object.keys(r.fields)))].sort();
  const head = ["Referenz", "Datum", "Status", "Formular", "Name", "E-Mail", "Telefon", "Firma", "Betreff", "Nachricht", "Seite", ...extraKeys.map(fieldLabel)];
  const body = rows.map((r) => [
    r.reference,
    r.createdAt.toLocaleString("de-CH", { timeZone: "Europe/Zurich" }),
    INQUIRY_STATUS[r.status].label,
    r.form,
    r.name,
    r.email,
    r.phone,
    r.company,
    r.subject,
    r.message,
    r.sourceUrl,
    ...extraKeys.map((k) => r.fields[k] ?? ""),
  ]);
  return [head, ...body];
}

/* ---------- follow-up ---------- */

const OPEN_STATES = ["new", "open", "quoted"] as const;

/** The follow-up date of an open enquiry has come. */
export function isFollowUpDue(q: Pick<Inquiry, "followUpAt" | "status">, now = new Date()) {
  return Boolean(q.followUpAt && q.followUpAt <= now && (OPEN_STATES as readonly string[]).includes(q.status));
}

/** Enquiries whose follow-up date has come (open ones only), oldest first. */
export async function dueFollowUps(now = new Date(), limit = 20) {
  return db
    .select({ id: inquiries.id, reference: inquiries.reference, name: inquiries.name, email: inquiries.email, subject: inquiries.subject, status: inquiries.status, followUpAt: inquiries.followUpAt, assignedTo: inquiries.assignedTo, followUpNotified: inquiries.followUpNotified })
    .from(inquiries)
    .where(and(lt(inquiries.followUpAt, now), inArray(inquiries.status, [...OPEN_STATES])))
    .orderBy(inquiries.followUpAt)
    .limit(limit);
}

/** One notification per due follow-up – to the assigned person, otherwise to everyone who handles enquiries. */
export async function remindFollowUps(now = new Date()) {
  let sent = 0;
  const mailTo = (await getSettings("email")).notifyFollowUp;
  for (const q of (await dueFollowUps(now, 100)).filter((x) => !x.followUpNotified)) {
    const title = `Nachfassen: ${q.name || q.email}`;
    const body = `${q.reference}${q.status === "quoted" ? " – Offerte gesendet, noch keine Antwort" : ""}${q.subject ? ` · ${q.subject}` : ""}`;
    const href = `/madexadm/anfragen/${q.id}`;
    await notify({ type: "inquiry.follow_up", ...(q.assignedTo ? { userId: q.assignedTo } : { permission: "inquiries.manage" as const }), title, body, href });
    // also by e-mail when recipients are set (Einstellungen → E-Mail)
    if (mailTo.length)
      await sendMail({
        to: mailTo,
        subject: `${title} (${q.reference})`,
        template: "inquiry.follow_up",
        related: { type: "inquiry", id: q.id },
        content: {
          kicker: "Nachfass-Erinnerung",
          title: "Heute nachfassen",
          intro: `Bei ${q.name || q.email} ist der Nachfass-Termin erreicht.${q.status === "quoted" ? " Die Offerte ist gesendet, eine Antwort fehlt noch." : ""}`,
          rows: [["Referenz", q.reference], ["E-Mail", q.email], ...(q.subject ? ([["Betreff", q.subject]] as [string, string][]) : [])],
          cta: { label: "Anfrage öffnen", url: appUrl(href) },
        },
      }).catch(() => {});
    await db.update(inquiries).set({ followUpNotified: true }).where(eq(inquiries.id, q.id));
    sent++;
  }
  return sent;
}

