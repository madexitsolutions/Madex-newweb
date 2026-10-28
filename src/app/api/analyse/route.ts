import { NextResponse } from "next/server";
import { z } from "zod";
import { canStart, createReport, findReport, setInquiryRef } from "@/lib/server/analysis/engine";
import { reportUrl } from "@/lib/server/analysis/email";
import { admit, analysedBefore, clientIp, fromOwnSite } from "@/lib/server/analysis/guard";
import { normalizeUrl } from "@/lib/server/analysis/safe-fetch";
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
 * request is recorded. Protection: own site only, minimum fill time, each
 * domain once, limits per visitor/network/e-mail and a global budget
 * (see analysis/guard.ts).
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
  const lead = (subject: string, message: string, fields: Record<string, string> = {}, confirm = true) =>
    createInquiry({ form: "Kostenlose Analyse", email: d.email, subject, message, fields, sourceUrl: source }, { ip, confirm });

  if (!d.website) {
    const r = await lead("Kostenlose Analyse (Startseite)", "Kostenlose Analyse angefragt");
    if (!r.ok) return NextResponse.json({ ok: false, error: r.message }, { status: r.code === "rate_limited" ? 429 : 422 });
    return NextResponse.json({ ok: true, message: `Danke! Wir melden uns innerhalb von 24 Stunden. Ihre Referenz: ${r.reference}` });
  }

  const url = normalizeUrl(d.website);
  if (!url) return NextResponse.json({ ok: false, error: "Bitte geben Sie eine gültige Website-Adresse ein, z. B. firma.ch." }, { status: 422 });
  const domain = url.hostname.replace(/^www\./, "");

  // each website only once: the same person gets their report back, anyone else a personal follow-up
  const before = await analysedBefore(url.hostname);
  if (before) {
    if (before.email.toLowerCase() === d.email.toLowerCase()) {
      const existing = await findReport(before.id);
      if (existing) return NextResponse.json({ ok: true, id: existing.id, url: `/analyse/${existing.id}?t=${encodeURIComponent(existing.token)}` });
    }
    await lead(`Website-Analyse für ${domain} (bereits analysiert)`, `Erneute Anfrage für ${domain}. Die Website wurde bereits automatisch analysiert – bitte persönlich nachfassen.`, { Website: url.toString() });
    return NextResponse.json({
      ok: true,
      message: `Für ${domain} wurde bereits eine Analyse erstellt. Wir haben Ihre Anfrage erhalten und melden uns innerhalb von 24 Stunden persönlich mit den Ergebnissen.`,
    });
  }

  const admission = await admit(ip, d.email);
  if (!admission.ok) {
    if (admission.reason === "budget") {
      await lead(`Website-Analyse für ${domain} (Kontingent erreicht)`, `Analyse für ${domain} angefragt, das tägliche Kontingent war erreicht – bitte manuell erstellen.`, { Website: url.toString() });
      return NextResponse.json({ ok: true, message: admission.message });
    }
    return NextResponse.json({ ok: false, error: admission.message }, { status: 429 });
  }
  if (!canStart()) return NextResponse.json({ ok: false, error: "Gerade laufen sehr viele Analysen. Bitte versuchen Sie es in einer Minute erneut." }, { status: 503 });

  const report = await createReport(url, d.email);
  if (!report) return NextResponse.json({ ok: true, message: `Für ${domain} wird gerade bereits eine Analyse erstellt. Wir melden uns innerhalb von 24 Stunden persönlich.` });
  // the lead lands in Admin → Anfragen with the link to the report
  const r = await lead(`Website-Analyse für ${domain}`, `Website-Analyse für ${domain} gestartet. Den Bericht finden Sie im Feld «Bericht».`, { Website: url.toString(), Bericht: reportUrl(report) }, false);
  if (r.ok) await setInquiryRef(report, r.reference);
  return NextResponse.json({ ok: true, id: report.id, url: `/analyse/${report.id}?t=${encodeURIComponent(report.token)}` });
}
