import { NextResponse } from "next/server";
import { z } from "zod";
import { addGuest, available, canStart, createReport, findReport, getReport, setInquiryRef, type Report } from "@/lib/server/analysis/engine";
import { reportUrl } from "@/lib/server/analysis/email";
import { admit, analysedBefore, clientIp, domainKey, fromOwnSite, releaseDomain } from "@/lib/server/analysis/guard";
import { normalizeUrl } from "@/lib/server/analysis/safe-fetch";
import { metaLeadFromRequest } from "@/server/analytics/meta";
import { createInquiry } from "@/server/content/inquiries";

export const runtime = "nodejs";

/** a person needs at least this long between loading the page and sending the form */
const MIN_FILL_MS = 2_500;

const schema = z.object({
  email: z.string().trim().email("Bitte geben Sie eine gültige E-Mail-Adresse ein.").max(200),
  website: z.string().trim().max(200).optional().default(""),
  // spam trap; a neutral name so browser autofill leaves it empty
  hp: z.string().max(500).optional().default(""),
  startedAt: z.number().int().positive().optional(),
});

/**
 * Hero quick form. With a website the analysis starts right away and the
 * answer carries the link to the live report page; without one only the
 * request is recorded.
 * Rules: one automatic analysis per visit (session cookie); a website that
 * has an available report is not scanned again – the person gets that report
 * with their own link; an expired or failed report is scanned anew.
 * Protection: own site only, minimum fill time, limits per visitor/network/
 * e-mail and a global budget (see analysis/guard.ts).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 422 });
  const d = parsed.data;
  // bots: pretend success, do nothing
  if (d.hp) return NextResponse.json({ ok: true, message: "Danke! Wir melden uns innerhalb von 24 Stunden." });
  if (!fromOwnSite(req)) return NextResponse.json({ ok: false, error: "Bitte starten Sie die Analyse über unsere Website." }, { status: 403 });
  if (!d.startedAt || Date.now() - d.startedAt < MIN_FILL_MS)
    return NextResponse.json({ ok: false, error: "Bitte prüfen Sie Ihre Angaben und senden Sie das Formular erneut." }, { status: 429 });

  const ip = clientIp(req);
  const source = req.headers.get("referer") ?? "";
  /** the request always lands in Admin → Anfragen, even when no analysis runs */
  // confirm = the person gets a "we'll get back to you" e-mail (when no report is coming)
  const lead = async (subject: string, message: string, fields: Record<string, string> = {}, confirm = true) => {
    const r = await createInquiry({ form: "Kostenlose Analyse", email: d.email, subject, message, fields, sourceUrl: source }, { ip, confirm });
    // Meta Conversions API (only with consent); `ref` lets the browser pixel send the same event ID
    if (r.ok && r.status === "new") metaLeadFromRequest(req, { reference: r.reference, email: d.email, form: "Kostenlose Analyse" });
    return r;
  };

  if (!d.website) {
    const r = await lead("Kostenlose Analyse (Startseite)", "Kostenlose Analyse angefragt");
    if (!r.ok) return NextResponse.json({ ok: false, error: r.message }, { status: r.code === "rate_limited" ? 429 : 422 });
    return NextResponse.json({ ok: true, ref: r.reference, message: `Danke! Wir melden uns innerhalb von 24 Stunden. Ihre Referenz: ${r.reference}` });
  }

  const url = normalizeUrl(d.website);
  if (!url) return NextResponse.json({ ok: false, error: "Bitte geben Sie eine gültige Website-Adresse ein, z. B. firma.ch." }, { status: 422 });
  const domain = url.hostname.replace(/^www\./, "");
  const open = (r: Report, token: string, extra: Record<string, unknown> = {}) =>
    withSession(NextResponse.json({ ok: true, id: r.id, url: link(r, token), ...extra }), r.id, token);

  // one automatic analysis per visit: the same website opens the report again, another one becomes a personal request
  const mine = await sessionReport(req);
  if (mine && available(mine.report)) {
    if (domainKey(mine.report.domain) === domainKey(url.hostname)) return open(mine.report, mine.token);
    const more = await lead(`Website-Analyse für ${domain} (weitere Website)`, `In diesem Besuch wurde bereits ${mine.report.domain} analysiert. Weitere Analyse für ${domain} gewünscht – bitte persönlich nachfassen.`, { Website: url.toString(), "Bisheriger Bericht": reportUrl(mine.report, mine.token) });
    return NextResponse.json({
      ok: true,
      ref: more.ok ? more.reference : undefined,
      report: link(mine.report, mine.token),
      message: `Pro Besuch erstellen wir eine automatische Analyse – Ihr Bericht für ${mine.report.domain} ist bereit. Ihre Anfrage für ${domain} haben wir erhalten und melden uns innerhalb von 24 Stunden persönlich.`,
    });
  }

  // the website was analysed before and its report is still available: show it instead of scanning again
  const shared = await existingReport(url.hostname);
  if (shared) return open(shared.report, (await share(shared.report)).token);

  const admission = await admit(ip, d.email);
  if (!admission.ok) {
    if (admission.reason === "budget") {
      const queued = await lead(`Website-Analyse für ${domain} (Kontingent erreicht)`, `Analyse für ${domain} angefragt, das tägliche Kontingent war erreicht – bitte manuell erstellen.`, { Website: url.toString() });
      return NextResponse.json({ ok: true, ref: queued.ok ? queued.reference : undefined, message: admission.message });
    }
    return NextResponse.json({ ok: false, error: admission.message }, { status: 429 });
  }
  if (!canStart()) return NextResponse.json({ ok: false, error: "Gerade laufen sehr viele Analysen. Bitte versuchen Sie es in einer Minute erneut." }, { status: 503 });

  const report = await createReport(url, d.email);
  if (!report) {
    // someone started the same website a moment ago: join that analysis
    const now = await existingReport(url.hostname);
    if (now) return open(now.report, (await share(now.report)).token);
    return NextResponse.json({ ok: false, error: "Für diese Website läuft gerade eine Analyse. Bitte versuchen Sie es in einer Minute erneut." }, { status: 409 });
  }
  // the lead lands in Admin → Anfragen with the link to the report
  const r = await lead(`Website-Analyse für ${domain}`, `Website-Analyse für ${domain} gestartet. Den Bericht finden Sie im Feld «Bericht».`, { Website: url.toString(), Bericht: reportUrl(report) }, false);
  if (r.ok) await setInquiryRef(report, r.reference);
  return open(report, report.token, { ref: r.ok ? r.reference : undefined });

  /** A link of its own for this person; new people land in Anfragen like a new analysis. */
  async function share(rep: Report) {
    const g = await addGuest(rep, d.email);
    if (g.added) {
      await lead(`Website-Analyse für ${domain} (bestehender Bericht)`, `Die Website wurde bereits analysiert – der bestehende Bericht wurde angezeigt. Den Bericht finden Sie im Feld «Bericht».`, { Website: url!.toString(), Bericht: reportUrl(rep, g.token) }, false);
    }
    return g;
  }
}

const SESSION_COOKIE = "madex-analyse";
const link = (r: Report, token: string) => `/analyse/${r.id}?t=${encodeURIComponent(token)}`;

/** Session cookie (no expiry): the analysis of this visit. */
function withSession(res: NextResponse, id: string, token: string) {
  res.cookies.set(SESSION_COOKIE, `${id}.${token}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return res;
}

async function sessionReport(req: Request): Promise<{ report: Report; token: string } | null> {
  const raw = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  const [id, token] = decodeURIComponent(raw?.slice(SESSION_COOKIE.length + 1) ?? "").split(".");
  if (!id || !token) return null;
  const report = await getReport(id, token);
  return report ? { report, token } : null;
}

/** The report registered for this website, while it can still be shown; an unusable entry is freed. */
async function existingReport(host: string): Promise<{ report: Report } | null> {
  const before = await analysedBefore(host);
  if (!before) return null;
  const report = await findReport(before.id);
  if (report && available(report)) return { report };
  await releaseDomain(host, before.id);
  return null;
}
