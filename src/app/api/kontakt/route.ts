import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/contact-schema";
import { rateLimit } from "@/lib/rate-limit";
import { sendRequestNotification } from "@/lib/server/mailer";
import { createRequest } from "@/lib/server/requests";
import { clientIp, logSecurity } from "@/lib/server/security";

export const runtime = "nodejs";

/**
 * Contact form, free analysis and the hero quick-form.
 * Every request is stored first (visible in /admin/anfragen) and then
 * e-mailed; a failed e-mail never loses the request.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit("form:" + ip, 6, 10 * 60 * 1000)) {
    await logSecurity("rate_form", ip);
    return NextResponse.json({ ok: false, error: "Zu viele Anfragen. Bitte versuchen Sie es in einigen Minuten erneut." }, { status: 429 });
  }

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
  const { item } = await createRequest({
    type: isAnalysis ? "analyse" : "kontakt",
    source: d.source || "kontakt",
    name: d.name,
    company: d.company || undefined,
    email: d.email,
    phone: d.phone || undefined,
    service: d.service || undefined,
    website: d.website || undefined,
    preferredDate: d.date || undefined,
    preferredTime: d.slot || undefined,
    message: d.message,
  });
  await sendRequestNotification(item);
  return NextResponse.json({ ok: true, reference: item.reference });
}
