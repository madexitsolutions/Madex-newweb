/**
 * Google Search Console (read-only): clicks, impressions and position per page
 * of the last 28 days. Uses the service account of Statistiken (GA4) with the
 * webmasters scope – add its e-mail address in the Search Console under
 * Einstellungen → Nutzer und Berechtigungen (eingeschränkt genügt).
 *
 * The property is GSC_SITE_URL (e.g. "sc-domain:firma.ch" or "https://www.firma.ch/");
 * without it, the domain property of the website and then its URL prefix are tried.
 * Results are cached in memory for an hour.
 */
import { addDays, zurichDay } from "@/lib/tz";
import { getSettings } from "@/server/settings";
import { accessToken, Ga4Error, parseServiceAccount } from "./ga4";

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const CACHE_MS = 60 * 60_000;
const ERROR_CACHE_MS = 5 * 60_000;
export const GSC_DAYS = 28;

export type GscStats = { clicks: number; impressions: number; ctr: number; position: number };
export type GscQuery = GscStats & { query: string };
export type GscReport = { site: string; from: string; to: string; totals: GscStats; pages: Record<string, GscStats> };
export type GscResult = { configured: false } | { configured: true; report: GscReport } | { configured: true; error: string };

const cache = new Map<string, { at: number; value: unknown }>();
/** The property that answered last time (saves the failed attempt on the next call). */
let knownSite = "";

/** "https://www.firma.ch/leistungen/" → "/leistungen" */
export function gscPath(url: string): string {
  try {
    const p = decodeURI(new URL(url).pathname);
    return p.length > 1 ? p.replace(/\/+$/, "") : "/";
  } catch {
    return url;
  }
}

/** Property candidates for a host: the explicit one, else domain property, then URL prefix. */
export function gscCandidates(host: string, explicit = process.env.GSC_SITE_URL?.trim()): string[] {
  if (explicit) return [explicit];
  if (!host) return [];
  const bare = host.replace(/^www\./, "").replace(/:\d+$/, "");
  return [`sc-domain:${bare}`, `https://${host}/`, ...(host.startsWith("www.") ? [] : [`https://www.${bare}/`])];
}

function httpError(status: number): Ga4Error {
  if (status === 401 || status === 403) return new Ga4Error("Kein Zugriff auf die Search Console. Fügen Sie die E-Mail-Adresse des Dienstkontos in der Search Console unter Einstellungen → Nutzer und Berechtigungen hinzufügen (eingeschränkt genügt).", "forbidden");
  if (status === 404) return new Ga4Error("Diese Website ist in der Search Console nicht eingetragen. Prüfen Sie GSC_SITE_URL (z. B. «sc-domain:firma.ch»).", "not_found");
  if (status === 429) return new Ga4Error("Das Kontingent der Search Console ist aufgebraucht. Die Zahlen sind später wieder verfügbar.", "quota");
  return new Ga4Error(`Die Search Console antwortet mit Status ${status}. Versuchen Sie es später erneut.`, "unknown");
}

async function account() {
  const s = await getSettings("analytics");
  if (!s.serviceAccountKey || !(s.serviceAccountEmail || s.serviceAccountKey.trim().startsWith("{"))) return null;
  return parseServiceAccount(s.serviceAccountEmail, s.serviceAccountKey);
}

type Row = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

async function query(site: string, token: string, body: object): Promise<Row[]> {
  let res: Response;
  try {
    res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new Ga4Error("Die Search Console ist nicht erreichbar. Versuchen Sie es später erneut.", "network");
  }
  if (!res.ok) throw httpError(res.status);
  return ((await res.json()) as { rows?: Row[] }).rows ?? [];
}

/** Search Console data starts about 2 days late – the window ends there. */
function range(now = new Date()) {
  const to = addDays(zurichDay(now), -2);
  return { from: addDays(to, -(GSC_DAYS - 1)), to };
}

/** Runs `body` against the first property that answers. */
async function run(host: string, body: (w: { from: string; to: string }) => object): Promise<{ site: string; rows: Row[]; from: string; to: string }> {
  const acc = await account();
  if (!acc) throw new Ga4Error("Das Dienstkonto fehlt. Richten Sie es unter Plugins → Statistiken ein.", "config");
  const token = await accessToken(acc.email, acc.key, GSC_SCOPE);
  const w = range();
  const candidates = gscCandidates(host);
  const ordered = knownSite && candidates.includes(knownSite) ? [knownSite, ...candidates.filter((c) => c !== knownSite)] : candidates;
  if (!ordered.length) throw new Ga4Error("Die Adresse der Website fehlt. Tragen Sie sie unter Einstellungen → Allgemein ein oder setzen Sie GSC_SITE_URL.", "config");
  let last: unknown;
  for (const site of ordered) {
    try {
      const rows = await query(site, token, { startDate: w.from, endDate: w.to, ...body(w) });
      knownSite = site;
      return { site, rows, ...w };
    } catch (e) {
      last = e;
      if (!(e instanceof Ga4Error) || (e.code !== "forbidden" && e.code !== "not_found")) throw e;
    }
  }
  throw last;
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ((hit.value as { error?: string }).error ? ERROR_CACHE_MS : CACHE_MS)) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Die Search Console ist nicht erreichbar.");

/** Clicks, impressions and position per page (path) of the last 28 days. Never throws. */
export async function searchConsolePages(host: string): Promise<GscResult> {
  if (!(await account().catch(() => null))) return { configured: false };
  return cached<GscResult>(`pages ${host}`, async () => {
    try {
      const r = await run(host, () => ({ dimensions: ["page"], rowLimit: 1000 }));
      const pages: Record<string, GscStats> = {};
      const totals = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
      let weighted = 0;
      for (const row of r.rows) {
        const path = gscPath(row.keys?.[0] ?? "");
        const prev = pages[path];
        // http/https or www/non-www variants of one page are added up
        pages[path] = prev
          ? { clicks: prev.clicks + row.clicks, impressions: prev.impressions + row.impressions, ctr: 0, position: (prev.position * prev.impressions + row.position * row.impressions) / Math.max(1, prev.impressions + row.impressions) }
          : { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position };
        if (prev) pages[path].ctr = pages[path].impressions ? pages[path].clicks / pages[path].impressions : 0;
        totals.clicks += row.clicks;
        totals.impressions += row.impressions;
        weighted += row.position * row.impressions;
      }
      totals.ctr = totals.impressions ? totals.clicks / totals.impressions : 0;
      totals.position = totals.impressions ? weighted / totals.impressions : 0;
      return { configured: true, report: { site: r.site, from: r.from, to: r.to, totals, pages } };
    } catch (e) {
      return { configured: true, error: errorText(e) };
    }
  });
}

/** The search terms each page was found with (top 10 per page by clicks). */
async function allQueries(host: string): Promise<Record<string, GscQuery[]>> {
  return cached<Record<string, GscQuery[]>>(`queries ${host}`, async () => {
    try {
      const r = await run(host, () => ({ dimensions: ["page", "query"], rowLimit: 5000 }));
      const out: Record<string, GscQuery[]> = {};
      for (const row of r.rows) (out[gscPath(row.keys?.[0] ?? "")] ??= []).push({ query: row.keys?.[1] ?? "", clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position });
      for (const list of Object.values(out)) list.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).splice(10);
      return out;
    } catch {
      return {};
    }
  });
}

export async function searchConsoleQueries(host: string, path: string): Promise<GscQuery[]> {
  if (!(await account().catch(() => null))) return [];
  return (await allQueries(host))[path] ?? [];
}

/** For tests. */
export function clearSearchConsoleCache() {
  cache.clear();
  knownSite = "";
}
