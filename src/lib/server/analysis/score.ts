/** Scores per category (0–100) from the weighted checks, plus checks from Google Lighthouse. */
import { CATEGORIES, type CategoryKey, type Check, type CheckStatus, type Lighthouse } from "@/lib/analysis";

const VALUE: Record<Exclude<CheckStatus, "info">, number> = { ok: 1, warn: 0.5, bad: 0 };
const sec = (ms: number) => `${(ms / 1000).toLocaleString("de-CH", { maximumFractionDigits: 1 })} s`;
const band = (v: number, good: number, ok: number): CheckStatus => (v <= good ? "ok" : v <= ok ? "warn" : "bad");
const scoreStatus = (s: number): CheckStatus => (s >= 90 ? "ok" : s >= 50 ? "warn" : "bad");

/** Lighthouse numbers as checks, so they count like the other measurements. */
export function lighthouseChecks(mobile?: Lighthouse | null, desktop?: Lighthouse | null): Check[] {
  const out: Check[] = [];
  if (mobile) {
    out.push({ id: "lh-mobile", category: "mobile", label: "Google-Test Smartphone (Leistung)", status: scoreStatus(mobile.performance), value: `${mobile.performance} / 100`, detail: "So bewertet Google die Ladeleistung auf einem durchschnittlichen Smartphone mit mobilem Netz.", weight: 4 });
    if (mobile.vitals.lcp) out.push({ id: "lh-mobile-lcp", category: "mobile", label: "Hauptinhalt sichtbar nach (Smartphone)", status: band(mobile.vitals.lcp, 2500, 4000), value: sec(mobile.vitals.lcp), detail: "Largest Contentful Paint – Google empfiehlt unter 2.5 Sekunden.", weight: 2 });
    out.push({ id: "lh-a11y", category: "mobile", label: "Bedienbarkeit und Barrierefreiheit", status: scoreStatus(mobile.accessibility), value: `${mobile.accessibility} / 100`, detail: "Kontraste, Schriftgrössen, Beschriftungen und genug grosse Klickflächen.", weight: 1 });
    out.push({ id: "lh-seo", category: "seo", label: "Google-SEO-Test", status: scoreStatus(mobile.seo), value: `${mobile.seo} / 100`, detail: "Die technische SEO-Prüfung von Google (Lighthouse).", weight: 2 });
  }
  if (desktop) {
    out.push({ id: "lh-desktop", category: "speed", label: "Google-Test Desktop (Leistung)", status: scoreStatus(desktop.performance), value: `${desktop.performance} / 100`, detail: "So bewertet Google die Ladeleistung am Computer.", weight: 3 });
    if (desktop.vitals.lcp) out.push({ id: "lh-desktop-lcp", category: "speed", label: "Hauptinhalt sichtbar nach (Desktop)", status: band(desktop.vitals.lcp, 2500, 4000), value: sec(desktop.vitals.lcp), detail: "Largest Contentful Paint am Computer.", weight: 1.5 });
  }
  const cls = mobile?.vitals.cls ?? desktop?.vitals.cls;
  if (cls !== undefined) out.push({ id: "lh-cls", category: "speed", label: "Ruhiger Seitenaufbau (Layout-Verschiebung)", status: cls <= 0.1 ? "ok" : cls <= 0.25 ? "warn" : "bad", value: cls.toLocaleString("de-CH"), detail: "Springende Inhalte beim Laden ärgern Besucher – Google empfiehlt unter 0.1.", weight: 1.5 });
  const tbt = mobile?.vitals.tbt;
  if (tbt !== undefined) out.push({ id: "lh-tbt", category: "speed", label: "Reaktionszeit (blockierte Zeit, Smartphone)", status: band(tbt, 200, 600), value: `${tbt.toLocaleString("de-CH")} ms`, detail: "Wie lange die Seite beim Laden nicht auf Eingaben reagiert.", weight: 1.5 });
  const bp = mobile?.bestPractices ?? desktop?.bestPractices;
  if (bp !== undefined) out.push({ id: "lh-bp", category: "tech", label: "Google-Test Best Practices", status: scoreStatus(bp), value: `${bp} / 100`, detail: "Sicherheit, moderne Technik und fehlerfreie Konsole.", weight: 1.5 });
  return out;
}

export function scoreChecks(checks: Check[]): Record<CategoryKey, number> & { overall: number } {
  const scores = {} as Record<CategoryKey, number>;
  for (const c of CATEGORIES) {
    const list = checks.filter((x) => x.category === c.key && x.status !== "info" && x.weight > 0);
    const w = list.reduce((s, x) => s + x.weight, 0);
    scores[c.key] = w ? Math.round((list.reduce((s, x) => s + x.weight * VALUE[x.status as keyof typeof VALUE], 0) / w) * 100) : 0;
  }
  // a site Google can't index is not "good", however well the rest is done
  const blocked = checks.some((c) => c.id === "indexable" && c.status === "bad");
  let overall = Math.round(CATEGORIES.reduce((s, c) => s + scores[c.key] * c.weight, 0));
  if (blocked) overall = Math.min(overall, 45);
  return { ...scores, overall };
}
