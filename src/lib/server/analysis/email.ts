/** The report as an e-mail: overall score, categories, top recommendations and a link to the full report. */
import { CATEGORIES, scoreLabel } from "@/lib/analysis";
import { sendMail } from "@/server/mail/mailer";
import { esc } from "@/server/mail/template";
import { appUrl } from "@/server/lib/app-url";
import type { Report } from "./engine";

const COLORS = { good: "#1f8a5b", fair: "#3d7f8c", weak: "#c07a12", poor: "#b3372f" };
const color = (n: number) => (n >= 85 ? COLORS.good : n >= 60 ? COLORS.fair : n >= 40 ? COLORS.weak : COLORS.poor);

export const reportUrl = (r: Report) => appUrl(`/analyse/${r.id}?t=${encodeURIComponent(r.token)}`);

export async function sendReport(r: Report) {
  if (!r.scores || !r.insights) return { ok: false, error: "Die Analyse ist noch nicht fertig." };
  const s = r.scores;
  const bars = CATEGORIES.map(
    (c) => `<tr>
<td style="padding:6px 0;font-size:14px;color:#12262a;width:46%">${esc(c.label)}</td>
<td style="padding:6px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e6eceb;border-radius:4px"><tr><td width="${Math.max(2, s[c.key])}%" style="background:${color(s[c.key])};height:8px;border-radius:4px;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr></table></td>
<td style="padding:6px 0;font-size:14px;font-weight:bold;color:${color(s[c.key])};text-align:right;width:44px">${s[c.key]}</td></tr>`,
  ).join("");
  const top = r.insights.top
    .map(
      (t, i) => `<tr><td style="padding:12px 0;border-top:1px solid #e6eceb">
<p style="margin:0 0 4px;font-size:15px;font-weight:bold;color:#12262a">${i + 1}. ${esc(t.title)} <span style="font-size:12px;font-weight:normal;color:#5b6b6d">(Wirkung: ${esc(t.impact)})</span></p>
<p style="margin:0 0 4px;font-size:14px;line-height:1.5;color:#12262a">${esc(t.problem)}</p>
<p style="margin:0;font-size:14px;line-height:1.5;color:#3d5457"><strong>So lösen Sie es:</strong> ${esc(t.solution)}</p></td></tr>`,
    )
    .join("");
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#f4f8f8;border-radius:8px"><tr>
<td style="padding:18px 20px;width:96px"><span style="font-size:44px;font-weight:bold;color:${color(s.overall)};line-height:1">${s.overall}</span><br><span style="font-size:12px;color:#5b6b6d">von 100</span></td>
<td style="padding:18px 20px 18px 0"><p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#12262a">${esc(scoreLabel(s.overall))}: ${esc(r.insights.headline)}</p><p style="margin:0;font-size:14px;line-height:1.5;color:#3d5457">${esc(r.insights.summary)}</p></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px">${bars}</table>
${top ? `<p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#12262a">Die wichtigsten Verbesserungen</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${top}</table>` : ""}`;
  return sendMail({
    to: r.email,
    subject: `Ihre Website-Analyse für ${r.domain}: ${s.overall} von 100 Punkten`,
    template: "website-analyse",
    content: {
      title: `Website-Analyse für ${r.domain}`,
      intro: "Vielen Dank für Ihr Interesse. Hier ist die Zusammenfassung Ihrer kostenlosen Website-Analyse – den vollständigen Bericht mit allen Prüfpunkten finden Sie über den Link unten.",
      html,
      cta: { label: "Vollständigen Bericht ansehen", url: reportUrl(r) },
      footnote: "Möchten Sie die Punkte gemeinsam anschauen? Antworten Sie einfach auf diese E-Mail – die Besprechung ist kostenlos und unverbindlich. Der Link zum Bericht ist 90 Tage gültig.",
    },
    related: { type: "website-analyse", id: r.id },
  });
}
