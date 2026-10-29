/**
 * One Madex layout for all e-mails – the same look as the analysis report
 * (lib/server/analysis/email.ts): logo on white, Helvetica, petrol and teal,
 * details in a framed box, a rounded button and the company footer.
 * Table-based with inline styles, so it looks the same in Outlook, Gmail and Apple Mail.
 */
import { site } from "@/content/site";
import { getSettings } from "@/server/settings";

export type EmailContent = {
  title: string;
  /** small line above the title, e.g. "Neue Anfrage" */
  kicker?: string;
  intro?: string;
  /** label/value rows */
  rows?: [string, string][];
  /** free paragraphs (plain text, newlines kept) */
  paragraphs?: string[];
  /** a message quoted from someone else (plain text) */
  quote?: { label: string; text: string };
  /** pre-rendered, trusted HTML block (e.g. an order table built with esc()) */
  html?: string;
  cta?: { label: string; url: string };
  footnote?: string;
  /** why the recipient gets this e-mail (small print in the footer) */
  reason?: string;
};

/**
 * The logo travels inside the e-mail (inline attachment, see mailer.ts) instead of
 * being loaded from the website: it shows before the domain points to this app,
 * and Outlook does not block it like external images.
 */
export const LOGO_CID = "logo@madex-it.ch";

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const INK = "#01292d";
const SOFT = "#4f6164";
const LINE = "#e3e9e9";
const TEAL = "#027872";
const FONT = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif";
const nl = (s: string) => esc(s).replace(/\n/g, "<br>");

export async function renderEmail(c: EmailContent) {
  const [g, b] = await Promise.all([getSettings("general"), getSettings("branding")]);
  const name = g.companyName || site.legalName;
  const street = g.street || site.contact.street;
  const place = [g.zip || site.contact.postalCode, g.city || site.contact.locality].filter(Boolean).join(" ");
  const email = g.email || site.contact.email;
  const url = g.siteUrl || site.url;
  const logo = b.logoUrl && /^https?:\/\//.test(b.logoUrl) ? b.logoUrl : `cid:${LOGO_CID}`;

  const rows = (c.rows ?? []).filter(([, v]) => v);
  const rowsHtml = rows.length
    ? `<tr><td style="padding:6px 32px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:10px">${rows
        .map(
          ([k, v], i) =>
            `<tr><td valign="top" width="34%" style="padding:11px 16px;${i ? `border-top:1px solid ${LINE};` : ""}${FONT};font-size:13px;color:${SOFT}">${esc(k)}</td><td valign="top" style="padding:11px 16px;${i ? `border-top:1px solid ${LINE};` : ""}${FONT};font-size:14px;line-height:1.5;color:${INK};font-weight:bold;word-break:break-word">${linkify(v)}</td></tr>`,
        )
        .join("")}</table></td></tr>`
    : "";
  const paragraphs = (c.paragraphs ?? []).map((p) => `<p style="margin:0 0 14px;${FONT};font-size:15px;line-height:1.6;color:${INK}">${nl(p)}</p>`).join("");
  const quote = c.quote?.text
    ? `<tr><td style="padding:6px 32px 14px"><p style="margin:0 0 6px;${FONT};font-size:12px;font-weight:bold;color:${SOFT}">${esc(c.quote.label)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:14px 16px;background:#eef7f6;border-left:3px solid ${TEAL};border-radius:0 8px 8px 0;${FONT};font-size:15px;line-height:1.6;color:${INK}">${nl(c.quote.text)}</td></tr></table></td></tr>`
    : "";

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><title>${esc(c.title)}</title></head>
<body style="margin:0;padding:0;background:#eef2f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f2;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">

<tr><td style="padding:26px 32px 22px;border-bottom:1px solid ${LINE}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><a href="${esc(url)}"><img src="${esc(logo)}" width="150" height="32" alt="${esc(site.name)}" style="display:block;width:150px;height:auto;border:0"></a></td>
${c.kicker ? `<td align="right" style="${FONT};font-size:12px;line-height:1.4;color:${SOFT}">${esc(c.kicker)}</td>` : ""}
</tr></table></td></tr>

<tr><td style="padding:28px 32px 6px">
<h1 style="margin:0 0 10px;${FONT};font-size:22px;line-height:1.3;font-weight:bold;color:${INK}">${esc(c.title)}</h1>
${c.intro ? `<p style="margin:0 0 14px;${FONT};font-size:15px;line-height:1.6;color:${SOFT}">${nl(c.intro)}</p>` : ""}
${paragraphs}
</td></tr>
${quote}
${c.html ? `<tr><td style="padding:4px 32px 8px">${c.html}</td></tr>` : ""}
${rowsHtml}
${c.cta ? `<tr><td style="padding:22px 32px 6px"><a href="${esc(c.cta.url)}" style="display:inline-block;background:${TEAL};color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:999px;${FONT};font-size:15px;font-weight:bold">${esc(c.cta.label)}</a></td></tr>` : ""}
${c.footnote ? `<tr><td style="padding:14px 32px 0;${FONT};font-size:13px;line-height:1.55;color:${SOFT}">${nl(c.footnote)}</td></tr>` : ""}
<tr><td style="padding:0 0 28px;font-size:0;line-height:0">&nbsp;</td></tr>

<tr><td style="padding:20px 32px;background:#f6f8f8;border-top:1px solid ${LINE}">
<p style="margin:0;${FONT};font-size:12px;line-height:1.6;color:${SOFT}"><strong style="color:${INK}">${esc(name)}</strong>${street ? ` · ${esc(street)}` : ""}${place ? ` · ${esc(place)}` : ""}<br>${email ? `<a href="mailto:${esc(email)}" style="color:${SOFT}">${esc(email)}</a> · ` : ""}<a href="${esc(url)}" style="color:${SOFT}">${esc(url.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a></p>
${c.reason ? `<p style="margin:8px 0 0;${FONT};font-size:11px;line-height:1.5;color:#8a9a9c">${esc(c.reason)}</p>` : ""}
</td></tr>

</table></td></tr></table></body></html>`;

  const text = [
    c.title,
    c.intro,
    ...(c.paragraphs ?? []),
    c.quote?.text ? `${c.quote.label}:\n${c.quote.text}` : "",
    rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    c.cta ? `${c.cta.label}: ${c.cta.url}` : "",
    c.footnote,
    [name, street, place].filter(Boolean).join(", "),
    c.reason,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { html, text };
}

/** Plain value, or a link for e-mail addresses, phone numbers and URLs. */
function linkify(v: string) {
  const s = v.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return `<a href="mailto:${esc(s)}" style="color:${TEAL};text-decoration:none">${esc(s)}</a>`;
  if (/^https?:\/\/\S+$/.test(s)) return `<a href="${esc(s)}" style="color:${TEAL};text-decoration:none">${esc(s.replace(/^https?:\/\//, ""))}</a>`;
  if (/^(\+|0)[\d\s()/-]{7,}$/.test(s) && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return `<a href="tel:${esc(s.replace(/[^\d+]/g, ""))}" style="color:${TEAL};text-decoration:none">${esc(s)}</a>`;
  return nl(s);
}
