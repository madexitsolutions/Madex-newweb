/** Branded notification e-mails (SMTP via env). Delivery is tracked on the request. */
import nodemailer from "nodemailer";
import { patchRequest, STATUS_LABELS, TIME_LABELS, TYPE_LABELS, type InboxRequest } from "./requests";
import { getSettings } from "./settings";

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && (process.env.MAIL_FROM || process.env.CONTACT_FROM_EMAIL));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function rows(r: InboxRequest): [string, string][] {
  const out: [string, string | undefined][] = [
    ["Referenz", r.reference],
    ["Art", TYPE_LABELS[r.type]],
    ["Name", r.name],
    ["Firma", r.company],
    ["E-Mail", r.email],
    ["Telefon", r.phone],
    ["Bereits Kunde", r.existingClient === undefined ? undefined : r.existingClient ? "Ja" : "Nein"],
    ["Leistung", r.service],
    ["Paket", r.packageInterest],
    ["Website", r.website],
    ["Wunschdatum", r.preferredDate],
    ["Zeitfenster", r.preferredTime ? TIME_LABELS[r.preferredTime] ?? r.preferredTime : undefined],
    ["Quelle", r.source],
    ["Status", STATUS_LABELS[r.status]],
  ];
  return out.filter((x): x is [string, string] => Boolean(x[1]));
}

export async function sendRequestNotification(r: InboxRequest) {
  if (!smtpConfigured()) {
    await patchRequest(r.id, (x) => {
      x.emailStatus = "skipped";
      x.emailError = "SMTP ist nicht konfiguriert.";
    });
    return false;
  }
  const settings = await getSettings();
  const to = [...new Set([...(process.env.CONTACT_TO_EMAIL || "").split(","), ...settings.notifyEmails].map((s) => s.trim()).filter(Boolean))];
  if (!to.length) {
    await patchRequest(r.id, (x) => {
      x.emailStatus = "skipped";
      x.emailError = "Kein Empfänger (CONTACT_TO_EMAIL) gesetzt.";
    });
    return false;
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://madex-it.ch";
  const adminUrl = `${site.replace(/\/$/, "")}/admin/anfragen/${r.id}`;
  const table = rows(r)
    .map(([k, v]) => `<tr><td style="padding:8px 12px;color:#5b6b6d;font-size:13px;white-space:nowrap;border-bottom:1px solid #e6eceb">${esc(k)}</td><td style="padding:8px 12px;font-size:14px;color:#12262a;border-bottom:1px solid #e6eceb">${esc(v)}</td></tr>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f6;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f6;padding:24px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#025159;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:bold">Neue Anfrage · ${esc(TYPE_LABELS[r.type])}</td></tr>
<tr><td style="padding:20px 24px 8px;color:#12262a;font-size:15px">Über madex-it.ch ist eine neue Anfrage eingegangen (Referenz <strong>${esc(r.reference)}</strong>).</td></tr>
<tr><td style="padding:8px 12px"><table width="100%" cellpadding="0" cellspacing="0">${table}</table></td></tr>
${r.message ? `<tr><td style="padding:12px 24px;color:#12262a;font-size:14px;line-height:1.6"><strong>Nachricht</strong><br>${esc(r.message).replace(/\n/g, "<br>")}</td></tr>` : ""}
<tr><td style="padding:16px 24px 28px"><a href="${adminUrl}" style="display:inline-block;background:#028d86;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;font-size:14px">Im Admin öffnen</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = rows(r).map(([k, v]) => `${k}: ${v}`).join("\n") + (r.message ? `\n\nNachricht:\n${r.message}` : "") + `\n\nIm Admin öffnen: ${adminUrl}`;
  try {
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.CONTACT_FROM_EMAIL,
      to,
      replyTo: `${r.name} <${r.email}>`,
      subject: `${TYPE_LABELS[r.type]}: ${r.name} (${r.reference})`,
      text,
      html,
    });
    await patchRequest(r.id, (x) => {
      x.emailStatus = "sent";
      x.emailError = undefined;
      x.events.push({ at: new Date().toISOString(), type: "email_sent" });
    });
    return true;
  } catch (err) {
    await patchRequest(r.id, (x) => {
      x.emailStatus = "failed";
      x.emailError = (err as Error).message.slice(0, 300);
      x.events.push({ at: new Date().toISOString(), type: "email_failed", note: x.emailError });
    });
    return false;
  }
}
