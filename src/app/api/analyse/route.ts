import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { canStart, createReport, setInquiryRef } from "@/lib/server/analysis/engine";
import { reportUrl } from "@/lib/server/analysis/email";
import { normalizeUrl } from "@/lib/server/analysis/safe-fetch";
import { createInquiry } from "@/server/content/inquiries";
import { ipFromRequest } from "@/server/lib/request";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email("Bitte geben Sie eine gültige E-Mail-Adresse ein.").max(200),
  website: z.string().trim().max(200).optional().default(""),
  fax: z.string().max(0).optional().or(z.literal("")),
});

/**
 * Hero quick form. With a website the analysis starts right away and the
 * answer carries the link to the live report page; without one only the
 * request is recorded (as before).
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
  if (d.fax) return NextResponse.json({ ok: true });
  const ip = ipFromRequest(req);
  const source = req.headers.get("referer") ?? "";

  if (!d.website) {
    const r = await createInquiry(
      { form: "Kostenlose Analyse", email: d.email, subject: "Kostenlose Analyse (Startseite)", message: "Kostenlose Analyse angefragt", sourceUrl: source },
      { ip },
    );
    if (!r.ok) return NextResponse.json({ ok: false, error: r.message }, { status: r.code === "rate_limited" ? 429 : 422 });
    return NextResponse.json({ ok: true, reference: r.reference });
  }

  const url = normalizeUrl(d.website);
  if (!url) return NextResponse.json({ ok: false, error: "Bitte geben Sie eine gültige Website-Adresse ein, z. B. firma.ch." }, { status: 422 });
  const domain = url.hostname.replace(/^www\./, "");
  if (!rateLimit(`analyse:${ip}`, 5, 30 * 60_000) || !rateLimit(`analyse-domain:${domain}`, 5, 30 * 60_000))
    return NextResponse.json({ ok: false, error: "Sie haben in kurzer Zeit mehrere Analysen gestartet. Bitte versuchen Sie es in 30 Minuten erneut." }, { status: 429 });
  if (!canStart()) return NextResponse.json({ ok: false, error: "Gerade laufen sehr viele Analysen. Bitte versuchen Sie es in einer Minute erneut." }, { status: 503 });

  const report = createReport(url, d.email);
  // the lead lands in Admin → Anfragen with the link to the report
  const r = await createInquiry(
    {
      form: "Kostenlose Analyse",
      email: d.email,
      subject: `Website-Analyse für ${domain}`,
      message: `Website-Analyse für ${domain} gestartet. Den Bericht finden Sie im Feld «Bericht».`,
      fields: { Website: url.toString(), Bericht: reportUrl(report) },
      sourceUrl: source,
    },
    { ip },
  );
  if (r.ok) await setInquiryRef(report, r.reference);
  return NextResponse.json({ ok: true, id: report.id, url: `/analyse/${report.id}?t=${encodeURIComponent(report.token)}` });
}
