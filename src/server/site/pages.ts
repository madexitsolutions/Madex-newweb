/**
 * Pages of the website edited in the dashboard (Website → Seiten). Published
 * pages are served at /<slug> by src/app/(site)/[...slug]. Placeholders like
 * {{firma}} are replaced with the company data from the settings when shown.
 */
import { and, asc, count, eq, ilike, ne, or } from "drizzle-orm";
import { z } from "zod";
import { slugify } from "@/lib/format";
import { db } from "@/server/db";
import { media, pages } from "@/server/db/schema";
import { sanitizeHtml } from "@/server/lib/sanitize";
import { getSettings } from "@/server/settings";

export type Page = typeof pages.$inferSelect;

/** Paths the app already uses – a page may not take them. */
export const RESERVED_SLUGS = ["admin", "api", "uploads", "shop", "produkt", "warenkorb", "kasse", "bestellung", "konto", "beitraege", "kontakt", "sitemap.xml", "robots.txt", "favicon.ico", "_next"];

export const pageInput = z.object({
  title: z.string().trim().min(1, "Bitte einen Titel eingeben.").max(200, "Der Titel ist zu lang (max. 200 Zeichen)."),
  slug: z.string().trim().max(96).default(""),
  body: z.string().max(500_000, "Der Text ist zu lang.").default(""),
  status: z.enum(["draft", "published"]),
  coverId: z.string().uuid().nullable().default(null),
  showTitle: z.boolean().default(true),
  seoTitle: z.string().trim().max(200).default(""),
  seoDescription: z.string().trim().max(400).default(""),
  noindex: z.boolean().default(false),
});

export async function listPages(opts: { q?: string; status?: "draft" | "published" } = {}) {
  const where = and(opts.status ? eq(pages.status, opts.status) : undefined, opts.q ? or(ilike(pages.title, `%${opts.q}%`), ilike(pages.slug, `%${opts.q}%`)) : undefined);
  return db.select().from(pages).where(where).orderBy(asc(pages.title));
}

export async function pageCounts() {
  const rows = await db.select({ status: pages.status, n: count() }).from(pages).groupBy(pages.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  return { all: (by.draft ?? 0) + (by.published ?? 0), draft: by.draft ?? 0, published: by.published ?? 0 };
}

export async function getPage(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(pages).where(eq(pages.id, id));
  return row ?? null;
}

async function uniqueSlug(base: string, exceptId?: string) {
  let root = slugify(base) || "seite";
  if (RESERVED_SLUGS.includes(root)) root = `${root}-seite`;
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? root : `${root.slice(0, 90)}-${i}`;
    const [hit] = await db
      .select({ id: pages.id })
      .from(pages)
      .where(exceptId ? and(eq(pages.slug, candidate), ne(pages.id, exceptId)) : eq(pages.slug, candidate));
    if (!hit) return candidate;
  }
  return `${root.slice(0, 80)}-${Date.now().toString(36)}`;
}

export type PageSaveResult = { ok: true; page: Page; slugAdjusted: boolean } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function savePage(id: string | null, raw: z.input<typeof pageInput>): Promise<PageSaveResult> {
  const parsed = pageInput.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".")] ??= i.message;
    return { ok: false, error: parsed.error.issues[0].message, fieldErrors: fe };
  }
  const v = parsed.data;
  const before = id ? await getPage(id) : null;
  if (id && !before) return { ok: false, error: "Die Seite wurde nicht gefunden – sie wurde vielleicht gelöscht." };
  const wanted = slugify(v.slug || v.title) || "seite";
  const slug = await uniqueSlug(wanted, id ?? undefined);
  const values = { ...v, slug, body: sanitizeHtml(v.body), seoTitle: v.seoTitle || null, seoDescription: v.seoDescription || null, updatedAt: new Date() };
  const [page] = before ? await db.update(pages).set(values).where(eq(pages.id, before.id)).returning() : await db.insert(pages).values(values).returning();
  return { ok: true, page, slugAdjusted: slug !== wanted };
}

export async function deletePage(id: string) {
  const [row] = await db.delete(pages).where(eq(pages.id, id)).returning();
  return row ?? null;
}

/** Published page by slug, with its cover image, for the website. */
export async function publicPage(slug: string) {
  const [row] = await db
    .select({ page: pages, cover: { path: media.path, alt: media.alt } })
    .from(pages)
    .leftJoin(media, eq(media.id, pages.coverId))
    .where(and(eq(pages.slug, slug), eq(pages.status, "published")));
  return row ? { ...row.page, cover: row.cover?.path ? row.cover : null } : null;
}

export async function publishedPages() {
  return db.select({ slug: pages.slug, title: pages.title, updatedAt: pages.updatedAt, noindex: pages.noindex }).from(pages).where(eq(pages.status, "published")).orderBy(asc(pages.title));
}

export const PLACEHOLDERS = [
  ["{{firma}}", "Firmenname"],
  ["{{adresse}}", "Strasse, PLZ Ort"],
  ["{{email}}", "E-Mail"],
  ["{{telefon}}", "Telefon"],
  ["{{uid}}", "UID / MWST-Nummer"],
  ["{{website}}", "Name der Website"],
] as const;

/** Replaces {{firma}} etc. with the (escaped) company data. */
export async function fillPlaceholders(html: string) {
  if (!html.includes("{{")) return html;
  const g = await getSettings("general");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const values: Record<string, string> = {
    "{{firma}}": g.companyName || g.siteName,
    "{{adresse}}": [g.street, [g.zip, g.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    "{{email}}": g.email,
    "{{telefon}}": g.phone,
    "{{uid}}": g.vatNumber,
    "{{website}}": g.siteName,
  };
  return html.replace(/\{\{(firma|adresse|email|telefon|uid|website)\}\}/g, (m) => esc(values[m] || "–"));
}

/** Legal starter pages, created once on a new installation (published, to be reviewed by the owner). */
export const STARTER_PAGES: { slug: string; title: string; body: string }[] = [
  {
    slug: "impressum",
    title: "Impressum",
    body: "<h2>Kontakt</h2><p>{{firma}}<br>{{adresse}}</p><p>E-Mail: {{email}}<br>Telefon: {{telefon}}</p><h2>Unternehmens-Identifikationsnummer</h2><p>{{uid}}</p><h2>Haftungsausschluss</h2><p>Die Inhalte dieser Website werden mit grösster Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte übernehmen wir jedoch keine Gewähr.</p>",
  },
  {
    slug: "datenschutz",
    title: "Datenschutzerklärung",
    body: "<p>Diese Datenschutzerklärung informiert darüber, wie {{firma}} Personendaten bearbeitet, wenn Sie diese Website besuchen oder mit uns Kontakt aufnehmen. Bitte passen Sie den Text an Ihr Unternehmen an.</p><h2>Verantwortliche Stelle</h2><p>{{firma}}, {{adresse}}, {{email}}</p><h2>Kontaktformular</h2><p>Wenn Sie uns über das Formular schreiben, bearbeiten wir Ihre Angaben, um Ihre Anfrage zu beantworten.</p><h2>Cookies und Webanalyse</h2><p>Mit Ihrer Einwilligung verwenden wir Google Analytics, um die Nutzung der Website auszuwerten. Sie können die Einwilligung jederzeit über «Cookie-Einstellungen» in der Fusszeile widerrufen.</p><h2>Ihre Rechte</h2><p>Sie können jederzeit Auskunft über Ihre Daten verlangen sowie deren Berichtigung oder Löschung beantragen. Schreiben Sie uns dazu an {{email}}.</p>",
  },
];
