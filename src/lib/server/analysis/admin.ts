/**
 * Website analyses for the dashboard: a compact index of every report (so the
 * list doesn't open hundreds of files), views of the report page, deleting a
 * report and freeing a domain for a new scan, and today's budget usage.
 */
import { inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { rateLimits } from "@/server/db/schema";
import { listCollections, read, remove, update } from "@/lib/server/store";
import { budget, domainKey, releaseDomain } from "./guard";
import type { Report } from "./engine";

export type AnalysisRow = {
  id: string;
  domain: string;
  url: string;
  email: string;
  createdAt: string;
  status: Report["status"];
  score?: number;
  madex?: boolean;
  error?: string;
  emailSentAt?: string;
  views: number;
  lastViewedAt?: string;
  inquiryRef?: string;
  /** the three most important improvements (for the enquiry detail) */
  top?: string[];
};

type Index = { rows: Record<string, AnalysisRow>; built?: boolean };
const INDEX = "analyse-index";

export function rowOf(r: Report, prev?: AnalysisRow): AnalysisRow {
  return {
    id: r.id,
    domain: r.domain,
    url: r.url,
    email: r.email,
    createdAt: r.createdAt,
    status: r.status,
    score: r.scores?.overall,
    madex: r.madex,
    error: r.error,
    emailSentAt: r.emailSentAt,
    views: prev?.views ?? 0,
    lastViewedAt: prev?.lastViewedAt,
    inquiryRef: r.inquiryRef,
    top: r.insights?.top.map((t) => t.title),
  };
}

/** Keeps the index in step with a report (called when a run ends and on changes). */
export async function indexReport(r: Report) {
  await update<Index>(INDEX, { rows: {} }, (ix) => {
    ix.rows[r.id] = rowOf(r, ix.rows[r.id]);
  });
}

/** The report page was opened by its visitor. */
export async function markViewed(id: string) {
  await update<Index>(INDEX, { rows: {} }, (ix) => {
    const row = ix.rows[id];
    if (!row) return;
    row.views += 1;
    row.lastViewedAt = new Date().toISOString();
  });
}

/** Every analysis, newest first. Builds the index once from the stored reports. */
export async function listAnalyses(): Promise<AnalysisRow[]> {
  let ix = await read<Index>(INDEX, { rows: {} });
  if (!ix.built) {
    const names = (await listCollections("analyse-")).filter((n) => /^analyse-[a-f0-9]{20}$/.test(n));
    const reports = await Promise.all(names.map((n) => read<Report | null>(n, null)));
    ix = await update<Index, Index>(INDEX, { rows: {} }, (cur) => {
      for (const r of reports) if (r?.id && !cur.rows[r.id]) cur.rows[r.id] = rowOf(r);
      cur.built = true;
      return structuredClone(cur);
    });
  }
  return Object.values(ix.rows).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The analysis behind an enquiry ("Bericht" link or reference). */
export async function analysisForInquiry(reference: string, reportLink?: string): Promise<AnalysisRow | null> {
  const id = reportLink?.match(/\/analyse\/([a-f0-9]{20})/)?.[1];
  const all = await listAnalyses();
  return all.find((a) => (id && a.id === id) || a.inquiryRef === reference) ?? null;
}

/** Deletes report, screenshots and index entry and frees the domain. */
export async function deleteAnalysis(id: string) {
  if (!/^[a-f0-9]{20}$/.test(id)) return;
  const row = (await read<Index>(INDEX, { rows: {} })).rows[id];
  await remove(`analyse-${id}`);
  await remove(`analyse-${id}-bilder`);
  await update<Index>(INDEX, { rows: {} }, (ix) => {
    delete ix.rows[id];
  });
  if (row) await releaseDomain(new URL(row.url).hostname, id);
}

/** Allows a new scan of the domain; the old report stays. */
export async function allowRescan(id: string) {
  const row = (await read<Index>(INDEX, { rows: {} })).rows[id];
  if (row) await releaseDomain(new URL(row.url).hostname, id);
}

/** Whether the domain is currently blocked for new scans (by this report). */
export async function blockedDomains(): Promise<Map<string, string>> {
  const all = await read<Record<string, { id: string }>>("analyse-domains", {});
  return new Map(Object.entries(all).map(([k, v]) => [k, v.id]));
}

export { domainKey };

/** Analyses used this hour / today against the budget. */
export async function budgetUsage() {
  const b = budget();
  const rows = await db.select().from(rateLimits).where(inArray(rateLimits.key, ["analyse:global-h", "analyse:global-d"]));
  const now = Date.now();
  const used = (key: string) => {
    const r = rows.find((x) => x.key === key);
    return r && r.resetAt.getTime() > now ? r.count : 0;
  };
  return { hour: Math.min(used("analyse:global-h"), b.hourly), hourly: b.hourly, day: Math.min(used("analyse:global-d"), b.daily), daily: b.daily };
}
