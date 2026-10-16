/** One branded, table-based HTML layout for all e-mails (works in Outlook and Gmail). */
import { getSettings } from "@/server/settings";

export type EmailContent = {
  title: string;
  intro?: string;
  /** label/value rows */
  rows?: [string, string][];
  /** free paragraphs (plain text, newlines kept) */
  paragraphs?: string[];
  /** pre-rendered, trusted HTML block (e.g. an order table built with esc()) */
  html?: string;
  cta?: { label: string; url: string };
  footnote?: string;
};

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function renderEmail(c: EmailContent) {
  const [g, b] = await Promise.all([getSettings("general"), getSettings("branding")]);
  const brand = b.primaryColor;
  const header = b.logoUrl && /^https?:\/\//.test(b.logoUrl) ? `<img src="${esc(b.logoUrl)}" alt="${esc(g.siteName)}" height="32" style="display:block;height:32px">` : `<span style="color:#ffffff;font-size:18px;font-weight:bold">${esc(g.siteName)}</span>`;
  const rows = (c.rows ?? [])
    .map(([k, v]) => `<tr><td style="padding:8px 12px;color:#5b6b6d;font-size:13px;white-space:nowrap;border-bottom:1px solid #e6eceb;vertical-align:top">${esc(k)}</td><td style="padding:8px 12px;font-size:14px;color:#12262a;border-bottom:1px solid #e6eceb">${esc(v).replace(/\n/g, "<br>")}</td></tr>`)
    .join("");
  const paragraphs = (c.paragraphs ?? []).map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#12262a">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const address = [g.companyName || g.siteName, g.street, [g.zip, g.city].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(c.title)}</title></head>
<body style="margin:0;background:#f4f6f6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f6;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:${brand};padding:20px 24px">${header}</td></tr>
<tr><td style="padding:24px 24px 4px"><h1 style="margin:0 0 10px;font-size:20px;color:#12262a">${esc(c.title)}</h1>${c.intro ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#12262a">${esc(c.intro).replace(/\n/g, "<br>")}</p>` : ""}</td></tr>
${paragraphs ? `<tr><td style="padding:0 24px">${paragraphs}</td></tr>` : ""}
${c.html ? `<tr><td style="padding:4px 24px 8px">${c.html}</td></tr>` : ""}
${rows ? `<tr><td style="padding:4px 12px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>` : ""}
${c.cta ? `<tr><td style="padding:8px 24px 24px"><a href="${esc(c.cta.url)}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;font-size:15px">${esc(c.cta.label)}</a></td></tr>` : ""}
${c.footnote ? `<tr><td style="padding:0 24px 20px;color:#5b6b6d;font-size:13px;line-height:1.5">${esc(c.footnote)}</td></tr>` : ""}
<tr><td style="padding:16px 24px;background:#f8fafa;color:#7d8b8d;font-size:12px">${esc(address)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [c.title, c.intro, ...(c.paragraphs ?? []), ...(c.rows ?? []).map(([k, v]) => `${k}: ${v}`), c.cta ? `${c.cta.label}: ${c.cta.url}` : "", c.footnote, address].filter(Boolean).join("\n\n");
  return { html, text };
}
