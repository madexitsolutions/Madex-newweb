/**
 * Weekly summary by e-mail (Einstellungen → E-Mail → Wochenbericht): leads,
 * follow-ups, shop, visitors and Google of the past week (Monday–Sunday).
 * runMaintenance() sends it once per week, at the first cron run from Monday 07:00 (Zurich).
 * Projects add their own sections via PROJECT.weeklyDigest (src/site/project.ts).
 */
import { and, count, gte, inArray, lt } from "drizzle-orm";
import { money, number } from "@/lib/format";
import { addDays, dayStart, zurichDay } from "@/lib/tz";
import { enabledModules } from "@/modules/registry";
import { ga4Config, ga4Report } from "@/server/analytics/ga4";
import { loadSales, totalsOf } from "@/server/analytics/sales";
import { searchConsolePages } from "@/server/analytics/search-console";
import { dueFollowUps } from "@/server/content/inquiries";
import { db } from "@/server/db";
import { inquiries } from "@/server/db/schema";
import { hit } from "@/server/lib/rate-limit";
import { appUrl } from "@/server/lib/app-url";
import { esc } from "@/server/mail/template";
import { sendMail } from "@/server/mail/mailer";
import { getSettings } from "@/server/settings";
import { PROJECT } from "@/site/project";

export type DigestRow = { label: string; value: string; change?: string; href?: string };
export type DigestSection = { title: string; rows: DigestRow[]; note?: string };
export type DigestWeek = { from: string; to: string; start: Date; end: Date; prevStart: Date };

const SEND_HOUR = 7;

/** Monday (YYYY-MM-DD) of the Zurich week `now` falls in. */
export function mondayOf(now: Date): string {
  const day = zurichDay(now);
  const dow = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(day, -dow);
}

/** The finished week before `now` (Monday–Sunday). */
export function lastWeek(now = new Date()): DigestWeek {
  const monday = mondayOf(now);
  const from = addDays(monday, -7);
  return { from, to: addDays(monday, -1), start: dayStart(from), end: dayStart(monday), prevStart: dayStart(addDays(from, -7)) };
}

/** "+3 zur Vorwoche" / "−12 %" – empty when there is nothing to compare. */
export function change(current: number, previous: number, mode: "abs" | "pct" = "abs"): string {
  if (current === previous) return previous ? "wie Vorwoche" : "";
  if (mode === "pct") {
    if (!previous) return "";
    const p = Math.round(((current - previous) / previous) * 100);
    return p === 0 ? "wie Vorwoche" : `${p > 0 ? "+" : "−"}${Math.abs(p)} % zur Vorwoche`;
  }
  const d = current - previous;
  return `${d > 0 ? "+" : "−"}${number(Math.abs(d))} zur Vorwoche`;
}

const dayLabel = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("de-CH", { day: "numeric", month: "long", timeZone: "UTC" });

async function inquirySection(w: DigestWeek, now: Date): Promise<DigestSection> {
  const countBetween = async (a: Date, b: Date) => (await db.select({ n: count() }).from(inquiries).where(and(gte(inquiries.createdAt, a), lt(inquiries.createdAt, b), inArray(inquiries.status, ["new", "open", "quoted", "done"]))))[0].n;
  const [cur, prev, open, quoted, due] = await Promise.all([
    countBetween(w.start, w.end),
    countBetween(w.prevStart, w.start),
    db.select({ n: count() }).from(inquiries).where(inArray(inquiries.status, ["new", "open"])),
    db.select({ n: count() }).from(inquiries).where(inArray(inquiries.status, ["quoted"])),
    dueFollowUps(now, 50),
  ]);
  return {
    title: "Anfragen",
    rows: [
      { label: "Neue Anfragen", value: number(cur), change: change(cur, prev), href: appUrl("/madexadm/anfragen") },
      { label: "Noch offen", value: number(open[0].n), href: appUrl("/madexadm/anfragen") },
      { label: "Offerte gesendet", value: number(quoted[0].n), href: appUrl("/madexadm/anfragen?status=offerte") },
      ...due.slice(0, 5).map((q) => ({ label: "Nachfassen fällig", value: `${q.name || q.email}${q.subject ? ` – ${q.subject}` : ""}`, href: appUrl(`/madexadm/anfragen/${q.id}`) })),
    ],
    note: due.length > 5 ? `Und ${due.length - 5} weitere Anfragen zum Nachfassen.` : undefined,
  };
}

async function shopSection(w: DigestWeek): Promise<DigestSection> {
  const rows = await loadSales(w.prevStart, w.end);
  const cur = totalsOf(rows.filter((r) => r.createdAt >= w.start));
  const prev = totalsOf(rows.filter((r) => r.createdAt < w.start));
  return {
    title: "Shop",
    rows: [
      { label: "Umsatz", value: money(cur.revenue), change: change(cur.revenue, prev.revenue, "pct"), href: appUrl("/madexadm/statistiken") },
      { label: "Bezahlte Bestellungen", value: number(cur.orders), change: change(cur.orders, prev.orders) },
    ],
  };
}

async function visitorSection(w: DigestWeek): Promise<DigestSection | null> {
  if (!(await ga4Config()).configured) return null;
  try {
    const r = await ga4Report({ fromDay: w.from, toDay: w.to, prev: { fromDay: addDays(w.from, -7), toDay: addDays(w.to, -7) } });
    const top = r.pages.slice(0, 3).map((p) => `${p.path} (${number(p.views)})`);
    return {
      title: "Besucher",
      rows: [
        { label: "Besucher", value: number(r.totals.users), change: change(r.totals.users, r.previous.users, "pct"), href: appUrl("/madexadm/statistiken") },
        { label: "Seitenaufrufe", value: number(r.totals.views), change: change(r.totals.views, r.previous.views, "pct") },
        ...(top.length ? [{ label: "Meistbesucht", value: top.join(", ") }] : []),
      ],
    };
  } catch (e) {
    return { title: "Besucher", rows: [], note: `Google Analytics: ${e instanceof Error ? e.message : "nicht erreichbar"}` };
  }
}

async function googleSection(host: string): Promise<DigestSection | null> {
  const r = await searchConsolePages(host);
  if (!r.configured || !("report" in r)) return null;
  const top = Object.entries(r.report.pages)
    .sort((a, b) => b[1].clicks - a[1].clicks)
    .slice(0, 3)
    .map(([p, s]) => `${p} (${number(s.clicks)})`);
  return {
    title: "Google-Suche (letzte 28 Tage)",
    rows: [
      { label: "Klicks", value: number(r.report.totals.clicks), href: appUrl("/madexadm/seo?sort=klicks") },
      { label: "Gezeigt", value: number(r.report.totals.impressions) },
      { label: "Ø Position", value: r.report.totals.position.toLocaleString("de-CH", { maximumFractionDigits: 1 }) },
      ...(top.length ? [{ label: "Meiste Klicks", value: top.join(", ") }] : []),
    ],
  };
}

function siteHost(siteUrl: string) {
  for (const u of [siteUrl, process.env.NEXT_PUBLIC_SITE_URL]) {
    try {
      if (u) return new URL(u).host;
    } catch {
      /* next */
    }
  }
  return "";
}

export async function buildDigest(now = new Date()) {
  const w = lastWeek(now);
  const [general, modules] = await Promise.all([getSettings("general"), enabledModules()]);
  const sections = (
    await Promise.all([
      modules.inquiries ? inquirySection(w, now) : null,
      modules.shop ? shopSection(w) : null,
      modules.analytics ? visitorSection(w) : null,
      googleSection(siteHost(general.siteUrl)).catch(() => null),
      ...(PROJECT.weeklyDigest ? [PROJECT.weeklyDigest(w).catch(() => [] as DigestSection[])] : []),
    ])
  )
    .flat()
    .filter((s): s is DigestSection => Boolean(s) && (s!.rows.length > 0 || Boolean(s!.note)));
  const period = `${dayLabel(w.from)} – ${dayLabel(w.to)}`;
  const F = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif";
  const changeColor = (c: string) => (c.startsWith("+") ? "#1f8a5b" : c.startsWith("−") ? "#b3261e" : "#4f6164");
  const html = sections
    .map(
      (s) =>
        `<p style="margin:22px 0 8px;${F};font-size:16px;font-weight:bold;color:#01292d">${esc(s.title)}</p>${
          s.rows.length
            ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e9e9;border-radius:10px">${s.rows
                .map(
                  (r, i) =>
                    `<tr><td valign="top" width="42%" style="padding:11px 16px;${i ? "border-top:1px solid #e3e9e9;" : ""}${F};font-size:13px;color:#4f6164">${esc(r.label)}</td><td valign="top" style="padding:11px 16px;${i ? "border-top:1px solid #e3e9e9;" : ""}${F};font-size:15px;line-height:1.45;color:#01292d">${r.href ? `<a href="${esc(r.href)}" style="color:#01292d;text-decoration:none;font-weight:bold">${esc(r.value)}</a>` : `<strong>${esc(r.value)}</strong>`}${r.change ? `<br><span style="font-size:12px;font-weight:bold;color:${changeColor(r.change)}">${esc(r.change)}</span>` : ""}</td></tr>`,
                )
                .join("")}</table>`
            : ""
        }${s.note ? `<p style="margin:8px 0 0;${F};font-size:13px;color:#4f6164">${esc(s.note)}</p>` : ""}`,
    )
    .join("");
  return { week: w, period, sections, html, siteName: general.siteName };
}

/** Sends the summary of last week to `to` (or the configured addresses). */
export async function sendWeeklyDigest(now = new Date(), to?: string[]): Promise<{ ok: boolean; error?: string; to: string[] }> {
  const recipients = to ?? (await getSettings("email")).notifyWeekly;
  if (!recipients.length) return { ok: false, error: "Keine Empfänger: Tragen Sie unter Einstellungen → E-Mail → Wochenbericht mindestens eine Adresse ein.", to: [] };
  const d = await buildDigest(now);
  const content = {
    kicker: "Wochenbericht",
    title: `Ihre Woche: ${d.period}`,
    intro: d.sections.length ? "Das Wichtigste der letzten Woche auf einen Blick." : "Letzte Woche gab es nichts Neues zu berichten.",
    html: d.html,
    cta: { label: "Dashboard öffnen", url: appUrl("/madexadm") },
    reason: "Sie erhalten diese Zusammenfassung jeden Montag. Abbestellen: Einstellungen → E-Mail → Wochenbericht.",
  };
  const r = await sendMail({ to: recipients, subject: `Wochenbericht ${d.siteName}: ${d.period}`, template: "weekly_digest", content });
  return { ...r, to: recipients };
}

/** Called by the cron: sends once per week from Monday 07:00 (Zurich). */
export async function weeklyDigestIfDue(now = new Date()): Promise<boolean> {
  const monday = mondayOf(now);
  if (now < new Date(dayStart(monday).getTime() + SEND_HOUR * 3_600_000)) return false;
  if (!(await getSettings("email")).notifyWeekly.length) return false;
  const first = await hit(`digest:${monday}`, 1, 8 * 86_400_000);
  if (!first.allowed) return false;
  return (await sendWeeklyDigest(now)).ok;
}
