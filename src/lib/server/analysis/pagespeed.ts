/**
 * Google PageSpeed Insights (Lighthouse) for mobile and desktop: scores, Core
 * Web Vitals, the biggest savings and a screenshot. Needs PAGESPEED_API_KEY
 * (free in the Google Cloud Console) – without a key Google rejects most calls.
 */
import type { Lighthouse } from "@/lib/analysis";

export type PsiResult = Lighthouse & { screenshot?: string };

type Audit = { title?: string; numericValue?: number; score?: number | null; details?: { type?: string; data?: string; overallSavingsMs?: number } };
type LhJson = {
  lighthouseResult?: {
    categories?: Record<string, { score: number | null }>;
    audits?: Record<string, Audit>;
  };
  error?: { message?: string };
};

export const pagespeedConfigured = () => Boolean(process.env.PAGESPEED_API_KEY);

const pct = (v: number | null | undefined) => Math.round((v ?? 0) * 100);

export async function runPagespeed(url: string, strategy: "mobile" | "desktop"): Promise<PsiResult | null> {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return null;
  const q = new URLSearchParams({ url, strategy, locale: "de", key });
  for (const c of ["performance", "seo", "accessibility", "best-practices"]) q.append("category", c);
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(75_000) });
    if (!res.ok) return null;
    const j = (await res.json()) as LhJson;
    const lh = j.lighthouseResult;
    if (!lh?.categories || !lh.audits) return null;
    const a = lh.audits;
    const n = (k: string) => (typeof a[k]?.numericValue === "number" ? Math.round(a[k].numericValue!) : undefined);
    const opportunities = Object.values(a)
      .filter((x) => x.details?.type === "opportunity" && (x.details.overallSavingsMs ?? 0) > 150 && x.title)
      .sort((x, y) => (y.details?.overallSavingsMs ?? 0) - (x.details?.overallSavingsMs ?? 0))
      .slice(0, 5)
      .map((x) => ({ title: x.title!, savingsMs: Math.round(x.details?.overallSavingsMs ?? 0) }));
    const shot = a["final-screenshot"]?.details?.data;
    return {
      performance: pct(lh.categories.performance?.score),
      seo: pct(lh.categories.seo?.score),
      accessibility: pct(lh.categories.accessibility?.score),
      bestPractices: pct(lh.categories["best-practices"]?.score),
      vitals: {
        score: pct(lh.categories.performance?.score),
        lcp: n("largest-contentful-paint"),
        fcp: n("first-contentful-paint"),
        tbt: n("total-blocking-time"),
        si: n("speed-index"),
        cls: typeof a["cumulative-layout-shift"]?.numericValue === "number" ? Math.round(a["cumulative-layout-shift"].numericValue! * 1000) / 1000 : undefined,
      },
      opportunities,
      hasScreenshot: Boolean(shot),
      screenshot: shot && shot.startsWith("data:image/") ? shot : undefined,
    };
  } catch {
    return null;
  }
}
