/**
 * PROJEKTCODE (Madex): own sections of the weekly summary – website analyses,
 * chatbot and SEO rating (see src/server/digest.ts).
 */
import { number } from "@/lib/format";
import { listAnalyses } from "@/lib/server/analysis/admin";
import { listSessions } from "@/lib/server/chatbot-admin";
import { allSeoPages } from "@/lib/seo-pages";
import { ratedPages } from "@/server/content/seo";
import { change, type DigestSection, type DigestWeek } from "@/server/digest";
import { appUrl } from "@/server/lib/app-url";

const LEADS = `/madexadm/anfragen?status=alle&formular=${encodeURIComponent("Kostenlose Analyse")}`;

const inRange = (iso: string | undefined, a: Date, b: Date) => {
  const t = iso ? Date.parse(iso) : NaN;
  return t >= a.getTime() && t < b.getTime();
};

export async function madexDigest(w: DigestWeek): Promise<DigestSection[]> {
  const [analyses, chats, pages] = await Promise.all([listAnalyses().catch(() => []), listSessions().catch(() => []), allSeoPages().then(ratedPages).catch(() => [])]);
  const out: DigestSection[] = [];

  const week = analyses.filter((a) => inRange(a.createdAt, w.start, w.end));
  const prev = analyses.filter((a) => inRange(a.createdAt, w.prevStart, w.start));
  if (week.length || prev.length) {
    const prospects = week.filter((a) => a.status === "done" && !a.madex);
    const weak = prospects.filter((a) => (a.score ?? 100) < 60).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
    const unopened = prospects.filter((a) => a.views === 0).length;
    out.push({
      title: "Website-Analysen",
      rows: [
        { label: "Analysen gestartet", value: number(week.length), change: change(week.length, prev.length), href: appUrl(LEADS) },
        { label: "Bericht nicht geöffnet", value: number(unopened), href: appUrl(LEADS) },
        ...weak.slice(0, 3).map((a) => ({ label: "Grosses Potenzial", value: `${a.domain} (${a.score} Punkte)`, href: appUrl(`/madexadm/anfragen?status=alle&q=${encodeURIComponent(a.domain)}`) })),
      ],
    });
  }

  const chatWeek = chats.filter((c) => inRange(c.createdAt, w.start, w.end));
  if (chatWeek.length) {
    const unanswered = chatWeek.filter((c) => c.messages.some((m) => m.role === "assistant" && m.fallback)).length;
    out.push({
      title: "Chatbot Orion",
      rows: [
        { label: "Gespräche", value: number(chatWeek.length), change: change(chatWeek.length, chats.filter((c) => inRange(c.createdAt, w.prevStart, w.start)).length), href: appUrl("/madexadm/chatbot") },
        { label: "Daraus Anfragen", value: number(chatWeek.filter((c) => c.requestRef).length) },
        ...(unanswered ? [{ label: "Ohne Antwort", value: `${number(unanswered)} – Wissen ergänzen`, href: appUrl("/madexadm/chatbot?tab=wissen") }] : []),
      ],
    });
  }

  if (pages.length) {
    const avg = Math.round(pages.reduce((n, p) => n + p.score, 0) / pages.length);
    const weak = pages.filter((p) => p.score < 70).length;
    out.push({
      title: "SEO",
      rows: [
        { label: "Ø Bewertung", value: `${avg} von 100`, href: appUrl("/madexadm/seo") },
        ...(weak ? [{ label: "Seiten mit Verbesserungsbedarf", value: number(weak), href: appUrl("/madexadm/seo?ansicht=verbessern&sort=bewertung") }] : []),
      ],
    });
  }
  return out;
}
