import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/contact-schema";
import { createInquiry } from "@/server/content/inquiries";
import { ipFromRequest } from "@/server/lib/request";

export const runtime = "nodejs";

/**
 * Contact form and free analysis. Each request lands in the dashboard inbox
 * (/admin/anfragen) and is e-mailed to the configured recipients.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
    return NextResponse.json({ ok: false, error: "Bitte prüfen Sie Ihre Eingaben.", fieldErrors }, { status: 422 });
  }
  const d = parsed.data;
  // Honeypot filled → accept silently, store nothing.
  if (d.fax) return NextResponse.json({ ok: true });

  const isAnalysis = d.source === "kostenlose-prufung" || d.source === "hero" || d.service === "Kostenlose Analyse";
  const fields: Record<string, string> = {};
  if (d.service) fields["Leistung"] = d.service;
  if (d.website) fields["Website"] = d.website;
  if (d.date) fields["Wunschdatum"] = d.date;
  if (d.slot) fields["Zeitfenster"] = d.slot;

  const r = await createInquiry(
    {
      form: isAnalysis ? "Kostenlose Analyse" : "Kontakt",
      name: d.name,
      company: d.company || "",
      email: d.email,
      phone: d.phone || "",
      subject: isAnalysis ? "Kostenlose Website- und Marketing-Analyse" : d.service ? `Anfrage: ${d.service}` : "Kontaktanfrage",
      message: d.message,
      fields,
      sourceUrl: req.headers.get("referer") ?? "",
    },
    { ip: ipFromRequest(req) },
  );
  if (!r.ok) return NextResponse.json({ ok: false, error: r.message, fieldErrors: r.fieldErrors }, { status: r.code === "rate_limited" ? 429 : 422 });
  return NextResponse.json({ ok: true, reference: r.reference });
}
