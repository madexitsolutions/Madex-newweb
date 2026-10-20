import { NextResponse } from "next/server";
import { z } from "zod";
import { createInquiry } from "@/server/content/inquiries";
import { ipFromRequest } from "@/server/lib/request";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email("Bitte geben Sie eine gültige E-Mail-Adresse ein.").max(200),
  website: z.string().trim().max(200).optional().default(""),
  fax: z.string().max(0).optional().or(z.literal("")),
});

/** Hero quick form: request the free analysis with just an e-mail (and optionally the current website). */
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
  const r = await createInquiry(
    {
      form: "Kostenlose Analyse",
      email: d.email,
      subject: "Kostenlose Analyse (Startseite)",
      message: d.website ? `Kostenlose Analyse für ${d.website}` : "Kostenlose Analyse angefragt",
      fields: d.website ? { Website: d.website } : {},
      sourceUrl: req.headers.get("referer") ?? "",
    },
    { ip: ipFromRequest(req) },
  );
  if (!r.ok) return NextResponse.json({ ok: false, error: r.message }, { status: r.code === "rate_limited" ? 429 : 422 });
  return NextResponse.json({ ok: true, reference: r.reference });
}
