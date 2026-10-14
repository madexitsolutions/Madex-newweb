import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { contactSchema } from "@/lib/contact-schema";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (!rateLimit(ip)) {
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
  const data = parsed.data;
  // Honeypot filled → silently accept without sending.
  if (data.fax) return NextResponse.json({ ok: true });

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL } = process.env;
  if (!SMTP_HOST || !CONTACT_TO_EMAIL || !CONTACT_FROM_EMAIL) {
    console.error("[kontakt] SMTP ist nicht konfiguriert (SMTP_HOST, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL).");
    return NextResponse.json(
      { ok: false, error: "Das Formular ist momentan nicht verfügbar. Bitte schreiben Sie uns an info@madex-it.ch oder rufen Sie an: 052 589 67 59." },
      { status: 503 },
    );
  }

  const rows: [string, string | undefined][] = [
    ["Name", data.name],
    ["Unternehmen", data.company],
    ["E-Mail", data.email],
    ["Telefon", data.phone],
    ["Interessierte Leistung", data.service],
    ["Aktuelle Website", data.website],
    ["Wunschdatum", data.date],
    ["Zeitfenster", data.slot],
    ["Quelle", data.source],
  ];
  const text = rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\nNachricht:\n${data.message}`;
  const html =
    `<h2>Neue Anfrage über madex-it.ch</h2><table cellpadding="6">` +
    rows.filter(([, v]) => v).map(([k, v]) => `<tr><th align="left">${k}</th><td>${escape(v!)}</td></tr>`).join("") +
    `</table><h3>Nachricht</h3><p>${escape(data.message).replace(/\n/g, "<br>")}</p>`;

  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    });
    await transport.sendMail({
      from: CONTACT_FROM_EMAIL,
      to: CONTACT_TO_EMAIL,
      replyTo: `${data.name} <${data.email}>`,
      subject: `Anfrage: ${data.service || "Kontakt"} – ${data.name}`,
      text,
      html,
    });
  } catch (err) {
    console.error("[kontakt] Versand fehlgeschlagen", err);
    return NextResponse.json(
      { ok: false, error: "Ihre Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder schreiben Sie an info@madex-it.ch." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
