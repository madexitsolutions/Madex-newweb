/**
 * Outgoing e-mail via SMTP (settings → E-Mail, falling back to SMTP_* env vars).
 * Every attempt is written to email_log. Without SMTP the mail is logged as "skipped".
 */
import nodemailer from "nodemailer";
import { db } from "@/server/db";
import { emailLog } from "@/server/db/schema";
import { getSettings } from "@/server/settings";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LOGO_CID, renderEmail, type EmailContent } from "./template";

export async function smtpConfig() {
  const s = await getSettings("email");
  const host = s.smtpHost || process.env.SMTP_HOST || "";
  const general = await getSettings("general");
  const fromEmail = s.fromEmail || process.env.MAIL_FROM_EMAIL || general.email;
  return {
    host,
    port: s.smtpHost ? s.smtpPort : Number(process.env.SMTP_PORT || 587),
    secure: s.smtpHost ? s.smtpSecure : process.env.SMTP_SECURE === "true",
    user: s.smtpHost ? s.smtpUser : process.env.SMTP_USER || "",
    pass: s.smtpHost ? s.smtpPassword : process.env.SMTP_PASSWORD || "",
    from: fromEmail ? `"${(s.fromName || general.siteName).replace(/"/g, "")}" <${fromEmail}>` : "",
    replyTo: s.replyTo || undefined,
    configured: Boolean(host && fromEmail),
  };
}

export type SendInput = {
  to: string | string[];
  subject: string;
  template: string;
  content: EmailContent;
  /** own layout instead of the standard template (content is then only the fallback) */
  rendered?: { html: string; text: string };
  replyTo?: string;
  related?: { type: string; id: string };
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
};

export async function sendMail(input: SendInput): Promise<{ ok: boolean; error?: string }> {
  const to = (Array.isArray(input.to) ? input.to : [input.to]).map((s) => s.trim()).filter(Boolean);
  const log = async (status: "sent" | "failed" | "skipped", error?: string) => {
    await db.insert(emailLog).values({
      to: to.join(", "),
      subject: input.subject,
      template: input.template,
      status,
      error: error ?? null,
      relatedType: input.related?.type ?? null,
      relatedId: input.related?.id ?? null,
    });
  };
  if (!to.length) {
    await log("skipped", "Kein Empfänger");
    return { ok: false, error: "Kein Empfänger" };
  }
  const cfg = await smtpConfig();
  if (!cfg.configured) {
    await log("skipped", "SMTP ist nicht eingerichtet");
    return { ok: false, error: "SMTP ist nicht eingerichtet" };
  }
  try {
    const transport = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined });
    const { html, text } = input.rendered ?? (await renderEmail(input.content));
    await transport.sendMail({ from: cfg.from, to, subject: input.subject, html, text, replyTo: input.replyTo || cfg.replyTo, attachments: [...(input.attachments ?? []), ...inlineLogo(html)] });
    await log("sent");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await log("failed", msg.slice(0, 500));
    return { ok: false, error: msg };
  }
}

let logoFile: Buffer | null | undefined;
/** The logo as inline attachment for e-mails that reference cid:LOGO_CID (public/brand/logo.png). */
function inlineLogo(html: string) {
  if (!html.includes(`cid:${LOGO_CID}`)) return [];
  if (logoFile === undefined) {
    try {
      logoFile = readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "brand", "logo.png"));
    } catch {
      logoFile = null; // without the file the alt text shows
    }
  }
  return logoFile ? [{ filename: "madex-logo.png", content: logoFile, contentType: "image/png", cid: LOGO_CID, contentDisposition: "inline" as const }] : [];
}
