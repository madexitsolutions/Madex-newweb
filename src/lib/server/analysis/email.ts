/**
 * The report as an e-mail in its own Madex layout: score, the six areas,
 * the three most important improvements and the link to the full report.
 * Table-based and inline styles only, so it looks the same in Outlook, Gmail
 * and Apple Mail.
 */
import { CATEGORIES, scoreLabel, type Recommendation } from "@/lib/analysis";
import { site } from "@/content/site";
import { sendMail } from "@/server/mail/mailer";
import { esc } from "@/server/mail/template";
import { appUrl } from "@/server/lib/app-url";
import { getShot, type Report } from "./engine";
import { renderReportPdf } from "./pdf";

const INK = "#01292d";
const SOFT = "#4f6164";
const LINE = "#e3e9e9";
const PETROL = "#025159";
const NIGHT = "#01363b";
const FONT = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif";

/** tone colours: on white, and on the dark score panel */
const tone = (n: number) => (n >= 85 ? "#1f8a5b" : n >= 60 ? "#027872" : n >= 40 ? "#9a6400" : "#b3261e");
const toneDark = (n: number) => (n >= 85 ? "#45d39a" : n >= 60 ? "#4fe0d2" : n >= 40 ? "#ffbe11" : "#ff7a6b");
const IMPACT: Record<Recommendation["impact"], [string, string]> = { hoch: ["#fde7e4", "#8a1c14"], mittel: ["#fff1cc", "#6b4a00"], niedrig: ["#e9efef", SOFT] };

export const reportUrl = (r: Report) => appUrl(`/analyse/${r.id}?t=${encodeURIComponent(r.token)}`);

const dateFmt = new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" });

export function renderReportEmail(r: Report) {
  const s = r.scores!;
  const ins = r.insights!;
  const url = reportUrl(r);
  const c = site.contact;
  const date = dateFmt.format(new Date(r.createdAt));
  const counts = { bad: r.checks.filter((x) => x.status === "bad").length, warn: r.checks.filter((x) => x.status === "warn").length, ok: r.checks.filter((x) => x.status === "ok").length };
  const lh = r.lighthouse;

  const cats = CATEGORIES.filter((cat) => typeof s[cat.key] === "number");
  const bars = cats.map((cat) => {
    const v = s[cat.key];
    return `<tr>
<td style="padding:10px 0 4px;${FONT};font-size:14px;color:${INK};font-weight:bold">${esc(cat.label)}</td>
<td align="right" style="padding:10px 0 4px;${FONT};font-size:16px;font-weight:bold;color:${tone(v)}">${v}</td></tr>
<tr><td colspan="2" style="padding:0 0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LINE};border-radius:4px"><tr><td width="${Math.max(2, v)}%" style="background:${tone(v)};height:6px;border-radius:4px;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>
${ins.categories[cat.key] ? `<tr><td colspan="2" style="padding:2px 0 8px;${FONT};font-size:13px;line-height:1.5;color:${SOFT}">${esc(ins.categories[cat.key]!)}</td></tr>` : ""}`;
  }).join("");

  const recs = ins.top
    .map((t, i) => {
      const [bg, fg] = IMPACT[t.impact];
      return `<tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:10px"><tr>
<td width="44" valign="top" style="padding:18px 0 18px 18px"><div style="width:32px;height:32px;line-height:32px;border-radius:16px;background:${PETROL};color:#ffffff;text-align:center;${FONT};font-size:15px;font-weight:bold">${i + 1}</div></td>
<td valign="top" style="padding:18px 18px 18px 14px">
<p style="margin:4px 0 8px;${FONT};font-size:16px;line-height:1.35;font-weight:bold;color:${INK}">${esc(t.title)} <span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${bg};color:${fg};font-size:11px;font-weight:bold;vertical-align:2px">Wirkung ${esc(t.impact)}</span></p>
<p style="margin:0 0 10px;${FONT};font-size:14px;line-height:1.55;color:${INK}">${esc(t.problem)}</p>
${t.solution ? `<p style="margin:0;padding:10px 12px;border-radius:8px;background:#eef7f6;${FONT};font-size:14px;line-height:1.55;color:${INK}"><strong style="color:#01716b">So lösen Sie es:</strong> ${esc(t.solution)}</p>` : ""}
</td></tr></table></td></tr>`;
    })
    .join("");

  const google =
    lh && (lh.mobile || lh.desktop)
      ? `<tr><td style="padding:8px 32px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f7;border-radius:10px"><tr>
${(["mobile", "desktop"] as const)
  .filter((w) => lh[w])
  .map((w) => `<td align="center" style="padding:16px 8px"><p style="margin:0;${FONT};font-size:26px;font-weight:bold;color:${tone(lh[w]!.performance)}">${lh[w]!.performance}</p><p style="margin:2px 0 0;${FONT};font-size:12px;color:${SOFT}">Google-Leistungswert ${w === "mobile" ? "Smartphone" : "Desktop"}</p></td>`)
  .join("")}
</tr></table></td></tr>`
      : "";

  const strengths = ins.strengths.length
    ? `<tr><td style="padding:4px 32px 8px"><p style="margin:0 0 8px;${FONT};font-size:15px;font-weight:bold;color:${INK}">Das machen Sie bereits gut</p>${ins.strengths
        .map((x) => `<p style="margin:0 0 6px;${FONT};font-size:14px;line-height:1.5;color:${INK}"><span style="color:#1f8a5b;font-weight:bold">&#10003;</span>&nbsp; ${esc(x)}</p>`)
        .join("")}</td></tr>`
    : "";

  const preheader = `${s.overall} von 100 Punkten – ${ins.headline}`;
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Website-Analyse ${esc(r.domain)}</title></head>
<body style="margin:0;padding:0;background:#eef2f2">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f2"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">

<tr><td style="padding:24px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><a href="${esc(site.url)}"><img src="${esc(appUrl("/brand/logo.png"))}" width="150" height="32" alt="${esc(site.name)}" style="display:block;width:150px;height:auto;border:0"></a></td>
<td align="right" style="${FONT};font-size:13px;color:${SOFT}">Website-Analyse<br>${esc(date)}</td>
</tr></table></td></tr>

<tr><td style="background:${NIGHT};padding:32px">
<p style="margin:0 0 6px;${FONT};font-size:13px;color:#a9c9c6">Ergebnis für <a href="${esc(r.url)}" style="color:#4fe0d2;text-decoration:none">${esc(r.domain)}</a></p>
<p style="margin:10px 0 14px;${FONT};line-height:1"><span style="font-size:60px;font-weight:bold;color:${toneDark(s.overall)}">${s.overall}</span><span style="font-size:18px;color:#a9c9c6"> / 100 &nbsp;</span><span style="display:inline-block;padding:4px 10px;border-radius:12px;background:#0b4a50;font-size:13px;font-weight:bold;color:${toneDark(s.overall)};vertical-align:10px">${esc(scoreLabel(s.overall))}</span></p>
<p style="margin:0 0 8px;${FONT};font-size:21px;line-height:1.3;font-weight:bold;color:#ffffff">${esc(ins.headline)}</p>
<p style="margin:0;${FONT};font-size:15px;line-height:1.6;color:#d9ecea">${esc(ins.summary)}</p>
<p style="margin:18px 0 0;${FONT};font-size:13px;color:#a9c9c6"><span style="white-space:nowrap"><span style="color:#ff7a6b">&#9679;</span> ${counts.bad} mit Handlungsbedarf</span> &nbsp; <span style="white-space:nowrap"><span style="color:#ffbe11">&#9679;</span> ${counts.warn} verbesserungsfähig</span> &nbsp; <span style="white-space:nowrap"><span style="color:#45d39a">&#9679;</span> ${counts.ok} in Ordnung</span></p>
</td></tr>

<tr><td style="padding:28px 32px 8px"><p style="margin:0 0 6px;${FONT};font-size:18px;font-weight:bold;color:${INK}">Ihre Werte im Überblick</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bars}</table></td></tr>
${google}
${recs ? `<tr><td style="padding:20px 32px 0"><p style="margin:0 0 4px;${FONT};font-size:18px;font-weight:bold;color:${INK}">Das bringt am meisten</p><p style="margin:0 0 14px;${FONT};font-size:14px;color:${SOFT}">Nach Wirkung sortiert.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${recs}</table></td></tr>` : ""}
${strengths}

<tr><td align="center" style="padding:20px 32px 8px">
<a href="${esc(url)}" style="display:inline-block;background:#027872;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:999px;${FONT};font-size:15px;font-weight:bold">Vollständigen Bericht ansehen</a>
<p style="margin:10px 0 0;${FONT};font-size:12px;color:${SOFT}">Den Bericht finden Sie auch als PDF im Anhang. Online mit allen ${r.checks.filter((x) => x.status !== "info").length} Prüfpunkten. Der Link ist 90 Tage gültig.</p></td></tr>

<tr><td style="padding:24px 32px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e3f3f1;border-radius:12px"><tr><td style="padding:20px 22px">
<p style="margin:0 0 6px;${FONT};font-size:16px;font-weight:bold;color:${INK}">Sollen wir die Punkte gemeinsam anschauen?</p>
<p style="margin:0 0 12px;${FONT};font-size:14px;line-height:1.55;color:${INK}">Wir besprechen den Bericht mit Ihnen kostenlos und unverbindlich und zeigen, was sich mit wenig Aufwand verbessern lässt. Antworten Sie einfach auf diese E-Mail oder rufen Sie uns an.</p>
<p style="margin:0;${FONT};font-size:14px"><a href="${esc(c.phonePrimary.href)}" style="color:#01716b;font-weight:bold;text-decoration:none">${esc(c.phonePrimary.label)}</a> &nbsp;·&nbsp; <a href="${esc(appUrl("/kontakt"))}" style="color:#01716b;font-weight:bold;text-decoration:none">Gespräch vereinbaren</a></p>
</td></tr></table></td></tr>

<tr><td style="padding:20px 32px;background:#f6f8f8;border-top:1px solid ${LINE}">
<p style="margin:0 0 4px;${FONT};font-size:12px;line-height:1.6;color:${SOFT}"><strong style="color:${INK}">${esc(site.legalName)}</strong> · ${esc(c.street)} · ${esc(c.postalCode)} ${esc(c.locality)}<br><a href="mailto:${esc(c.email)}" style="color:${SOFT}">${esc(c.email)}</a> · <a href="${esc(site.url)}" style="color:${SOFT}">${esc(site.url.replace(/^https?:\/\//, ""))}</a></p>
<p style="margin:8px 0 0;${FONT};font-size:11px;line-height:1.5;color:#8a9a9c">Sie erhalten diese E-Mail, weil Sie auf unserer Website eine kostenlose Analyse für ${esc(r.domain)} angefordert haben. Automatische Analyse der Startseite vom ${esc(date)}.</p>
</td></tr>

</table></td></tr></table></body></html>`;

  const text = [
    `Website-Analyse für ${r.domain} (${date})`,
    `Gesamtergebnis: ${s.overall} von 100 Punkten (${scoreLabel(s.overall)})`,
    ins.headline,
    ins.summary,
    "Ihre Werte:\n" + cats.map((cat) => `- ${cat.label}: ${s[cat.key]}`).join("\n"),
    ins.top.length ? "Das bringt am meisten:\n" + ins.top.map((t, i) => `${i + 1}. ${t.title} (Wirkung ${t.impact})\n   ${t.problem}\n   So lösen Sie es: ${t.solution}`).join("\n") : "",
    `Vollständiger Bericht: ${url}`,
    `Fragen? ${c.phonePrimary.label} · ${c.email}`,
    `${site.legalName}, ${c.street}, ${c.postalCode} ${c.locality}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { html, text };
}

export async function sendReport(r: Report) {
  if (!r.scores || !r.insights) return { ok: false, error: "Die Analyse ist noch nicht fertig." };
  // the designed PDF goes along; if it can't be rendered, the e-mail still goes out
  let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined;
  try {
    const [mobile, desktop] = await Promise.all([getShot(r.id, "mobile"), getShot(r.id, "desktop")]);
    const pdf = await renderReportPdf(r, { mobile: mobile ?? undefined, desktop: desktop ?? undefined }, reportUrl(r));
    attachments = [{ filename: `Website-Analyse ${r.domain}.pdf`, content: pdf, contentType: "application/pdf" }];
  } catch (e) {
    console.error("[analyse] PDF für E-Mail nicht erstellt:", e);
  }
  return sendMail({
    to: r.email,
    subject: `Ihre Website-Analyse für ${r.domain}: ${r.scores.overall} von 100 Punkten`,
    template: "website-analyse",
    content: { title: `Website-Analyse für ${r.domain}`, cta: { label: "Bericht ansehen", url: reportUrl(r) } },
    rendered: renderReportEmail(r),
    related: { type: "website-analyse", id: r.id },
    attachments,
  });
}
