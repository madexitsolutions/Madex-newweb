/**
 * SEO overrides (title, description, canonical, Open Graph image, noindex) per
 * path of the connected website, plus importing paths from its sitemap.
 */
import { and, asc, count, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { seoEntries } from "@/server/db/schema";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export type SeoEntry = typeof seoEntries.$inferSelect;

export const SEO_LIMITS = { titleMax: 60, descMin: 70, descMax: 160 };

/** "ok" | "warn" | "bad" for a title length (empty = bad). */
export function titleState(t: string | null | undefined) {
  const n = (t ?? "").trim().length;
  if (!n) return "bad" as const;
  return n > SEO_LIMITS.titleMax ? ("warn" as const) : ("ok" as const);
}

export function descState(d: string | null | undefined) {
  const n = (d ?? "").trim().length;
  if (!n) return "bad" as const;
  return n < SEO_LIMITS.descMin || n > SEO_LIMITS.descMax ? ("warn" as const) : ("ok" as const);
}

/** Normalises user input or a URL to a site path: "/ueber-uns" (no query, no trailing slash except root). */
export function normalizePath(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).pathname;
    } catch {
      return null;
    }
  }
  s = s.split(/[?#]/)[0];
  if (!s.startsWith("/")) s = "/" + s;
  s = s.replace(/\/{2,}/g, "/");
  if (s.length > 1) s = s.replace(/\/+$/, "");
  try {
    s = decodeURI(s);
  } catch {
    /* keep encoded */
  }
  if (s.length > 500 || /[\s<>"]/.test(s)) return null;
  return s;
}

export const seoInput = z.object({
  path: z.string().transform((v, ctx) => {
    const p = normalizePath(v);
    if (!p) ctx.addIssue({ code: "custom", message: "Bitte einen Pfad wie /ueber-uns eingeben." });
    return p ?? "";
  }),
  title: z.string().trim().max(200).default(""),
  description: z.string().trim().max(400).default(""),
  canonical: z
    .string()
    .trim()
    .max(1000)
    .default("")
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v) || v.startsWith("/"), "Die kanonische Adresse muss mit https:// oder / beginnen."),
  ogImage: z
    .string()
    .trim()
    .max(1000)
    .default("")
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v) || v.startsWith("/"), "Das Bild muss eine Adresse mit https:// oder / sein."),
  noindex: z.boolean().default(false),
});

export type SeoFilter = "all" | "title_long" | "title_missing" | "desc_missing" | "desc_range" | "noindex";

const len = (c: AnyPgColumn) => sql<number>`char_length(coalesce(trim(${c}), ''))`;

function filterWhere(filter: SeoFilter): SQL | undefined {
  const { titleMax, descMin, descMax } = SEO_LIMITS;
  switch (filter) {
    case "title_long":
      return sql`${len(seoEntries.title)} > ${titleMax}`;
    case "title_missing":
      return sql`${len(seoEntries.title)} = 0`;
    case "desc_missing":
      return sql`${len(seoEntries.description)} = 0`;
    case "desc_range":
      return sql`${len(seoEntries.description)} > 0 and (${len(seoEntries.description)} < ${descMin} or ${len(seoEntries.description)} > ${descMax})`;
    case "noindex":
      return eq(seoEntries.noindex, true);
    default:
      return undefined;
  }
}

export async function seoSummary() {
  const { titleMax, descMin, descMax } = SEO_LIMITS;
  const [r] = await db
    .select({
      total: count(),
      titleLong: sql<number>`count(*) filter (where ${len(seoEntries.title)} > ${titleMax})`.mapWith(Number),
      titleMissing: sql<number>`count(*) filter (where ${len(seoEntries.title)} = 0)`.mapWith(Number),
      descMissing: sql<number>`count(*) filter (where ${len(seoEntries.description)} = 0)`.mapWith(Number),
      descRange: sql<number>`count(*) filter (where ${len(seoEntries.description)} > 0 and (${len(seoEntries.description)} < ${descMin} or ${len(seoEntries.description)} > ${descMax}))`.mapWith(Number),
      noindex: sql<number>`count(*) filter (where ${seoEntries.noindex})`.mapWith(Number),
    })
    .from(seoEntries);
  return r;
}

export async function listSeo(opts: { q?: string; filter: SeoFilter }, page: number, perPage = 25) {
  const conds: (SQL | undefined)[] = [filterWhere(opts.filter)];
  if (opts.q) {
    const like = `%${opts.q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    conds.push(or(ilike(seoEntries.path, like), ilike(seoEntries.title, like), ilike(seoEntries.description, like)));
  }
  const list = conds.filter(Boolean) as SQL[];
  const where = list.length ? and(...list) : undefined;
  const [{ n }] = await db.select({ n: count() }).from(seoEntries).where(where);
  const rows = await db
    .select()
    .from(seoEntries)
    .where(where)
    .orderBy(asc(seoEntries.path))
    .limit(perPage)
    .offset((page - 1) * perPage);
  return { rows, total: n };
}

export async function getSeo(path: string) {
  const p = normalizePath(path);
  if (!p) return null;
  const [row] = await db.select().from(seoEntries).where(eq(seoEntries.path, p));
  return row ?? null;
}

/* ---------- all pages of the website, rated ---------- */

/** A page of the website with its built-in SEO (project code: src/site/project.ts → seoPages). */
export type SitePage = { path: string; group: string; title: string; description: string; image?: string };

export type SeoCheck = { label: string; ok: boolean; points: number; max: number; hint: string; /** short problem, e.g. "Titel zu lang (72 Zeichen)" */ issue: string };

/** Effective SEO of one page (dashboard changes over built-in defaults) with its rating. */
export type RatedPage = {
  path: string;
  group: string;
  title: string;
  description: string;
  ogImage: string;
  noindex: boolean;
  canonical: string;
  /** changed in the dashboard (otherwise the website's own defaults apply) */
  custom: boolean;
  defaults: SitePage | null;
  score: number;
  checks: SeoCheck[];
};

const GENERIC_IMAGE = /\/og\.(jpe?g|png|webp)$/i;

/**
 * 0–100 per page: title (35), description (35), own share image (10),
 * indexed (10), unique title (5), readable address (5).
 */
export function rateSeo(v: { path: string; title: string; description: string; ogImage: string; noindex: boolean }, duplicateTitle = false): { score: number; checks: SeoCheck[] } {
  const t = v.title.trim().length;
  const d = v.description.trim().length;
  const checks: SeoCheck[] = [
    { label: "Titel vorhanden", ok: t > 0, points: t > 0 ? 20 : 0, max: 20, hint: "Ohne Titel zeigt Google irgendeinen Text der Seite an.", issue: "Titel fehlt" },
    {
      label: "Titellänge 30–60 Zeichen",
      ok: t >= 30 && t <= SEO_LIMITS.titleMax,
      points: t >= 30 && t <= SEO_LIMITS.titleMax ? 15 : t >= 15 && t <= 70 ? 7 : 0,
      max: 15,
      hint: t > SEO_LIMITS.titleMax ? "Längere Titel schneidet Google ab." : "Kurze Titel verschenken Platz für Suchbegriffe wie Leistung und Ort.",
      issue: `Titel zu ${t > SEO_LIMITS.titleMax ? "lang" : "kurz"} (${t} Zeichen)`,
    },
    { label: "Beschreibung vorhanden", ok: d > 0, points: d > 0 ? 20 : 0, max: 20, hint: "Ohne Beschreibung wählt Google einen zufälligen Textausschnitt.", issue: "Beschreibung fehlt" },
    {
      label: `Beschreibung ${SEO_LIMITS.descMin}–${SEO_LIMITS.descMax} Zeichen`,
      ok: d >= SEO_LIMITS.descMin && d <= SEO_LIMITS.descMax,
      points: d >= SEO_LIMITS.descMin && d <= SEO_LIMITS.descMax ? 15 : d >= 50 && d <= 200 ? 7 : 0,
      max: 15,
      hint: d > SEO_LIMITS.descMax ? "Google schneidet den Text ab – die wichtigste Aussage gehört an den Anfang." : "Nutzen Sie den Platz für Nutzen und Aufruf, z. B. «Jetzt Offerte anfragen».",
      issue: `Beschreibung zu ${d > SEO_LIMITS.descMax ? "lang" : "kurz"} (${d} Zeichen)`,
    },
    { label: "Eigenes Vorschaubild", ok: Boolean(v.ogImage) && !GENERIC_IMAGE.test(v.ogImage), points: v.ogImage && !GENERIC_IMAGE.test(v.ogImage) ? 10 : 0, max: 10, hint: "Ein passendes Bild macht geteilte Links auf WhatsApp, LinkedIn und Facebook auffälliger.", issue: "Kein eigenes Vorschaubild" },
    { label: "Bei Google sichtbar", ok: !v.noindex, points: v.noindex ? 0 : 10, max: 10, hint: "Die Seite ist auf noindex gesetzt und erscheint nicht bei Google.", issue: "Nicht bei Google sichtbar" },
    { label: "Titel nur einmal verwendet", ok: !duplicateTitle, points: duplicateTitle ? 0 : 5, max: 5, hint: "Mehrere Seiten mit demselben Titel konkurrieren bei Google miteinander.", issue: "Titel doppelt verwendet" },
    {
      label: "Lesbare Adresse",
      ok: v.path.length <= 75 && !/[A-Z_?=]/.test(v.path),
      points: v.path.length <= 75 && !/[A-Z_?=]/.test(v.path) ? 5 : 0,
      max: 5,
      hint: "Kurze Adressen aus Wörtern mit Bindestrich lassen sich besser merken und teilen.",
      issue: "Sehr lange Adresse",
    },
  ];
  return { score: checks.reduce((n, c) => n + c.points, 0), checks };
}

export const seoGrade = (n: number) => (n >= 85 ? { label: "Sehr gut", tone: "ok" as const } : n >= 70 ? { label: "Gut", tone: "info" as const } : n >= 50 ? { label: "Ausbaufähig", tone: "warn" as const } : { label: "Schwach", tone: "bad" as const });

/** Every page: built-in defaults merged with dashboard changes, plus extra paths only kept in the dashboard. */
export async function ratedPages(defaults: SitePage[]): Promise<RatedPage[]> {
  const rows = await db.select().from(seoEntries);
  const saved = new Map(rows.map((r) => [r.path, r]));
  const known = new Set(defaults.map((p) => p.path));
  const base = [
    ...defaults.map((p) => ({ p, e: saved.get(p.path) })),
    ...rows.filter((r) => !known.has(r.path)).map((e) => ({ p: null, e })),
  ].map(({ p, e }) => ({
    path: (p?.path ?? e?.path)!,
    group: p?.group ?? "Weitere",
    title: e?.title?.trim() || p?.title || "",
    description: e?.description?.trim() || p?.description || "",
    ogImage: e?.ogImage?.trim() || p?.image || "",
    noindex: e?.noindex ?? false,
    canonical: e?.canonical ?? "",
    custom: Boolean(e),
    defaults: p,
  }));
  const titles = new Map<string, number>();
  for (const r of base) if (r.title) titles.set(r.title.toLowerCase(), (titles.get(r.title.toLowerCase()) ?? 0) + 1);
  return base.map((r) => ({ ...r, ...rateSeo(r, (titles.get(r.title.toLowerCase()) ?? 0) > 1) }));
}

/* ---------- sitemap import ---------- */

export const SITEMAP_LIMITS = { timeoutMs: 8_000, maxBytes: 5 * 1024 * 1024, maxSitemaps: 20, maxUrls: 5_000 };

const decodeXml = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&")
    .trim();

/** Parses a sitemap or sitemap index: returns page URLs and nested sitemap URLs. */
export function parseSitemap(xml: string): { urls: string[]; sitemaps: string[] } {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const locs: string[] = [];
  const re = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const v = decodeXml(m[1]);
    if (/^https?:\/\//i.test(v)) locs.push(v);
  }
  if (isIndex) return { urls: [], sitemaps: [...new Set(locs)] };
  return { urls: [...new Set(locs)], sitemaps: [] };
}

/** Fetches a URL with timeout and size limit; only http(s). */
export async function fetchText(url: string, opts = SITEMAP_LIMITS): Promise<string> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Ungültige Adresse: ${url}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Nur http- und https-Adressen sind erlaubt.");
  const res = await fetch(u, { signal: AbortSignal.timeout(opts.timeoutMs), redirect: "follow", headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.5", "user-agent": "Predashboard-SEO/1.0" } });
  if (!res.ok) throw new Error(`${u.href} antwortet mit HTTP ${res.status}.`);
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > opts.maxBytes) throw new Error(`${u.href} ist grösser als ${Math.round(opts.maxBytes / 1024 / 1024)} MB.`);
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > opts.maxBytes) {
      await reader.cancel();
      throw new Error(`${u.href} ist grösser als ${Math.round(opts.maxBytes / 1024 / 1024)} MB.`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Collects page paths from siteUrl/sitemap.xml (follows sitemap indexes, same host only). */
export async function sitemapPaths(siteUrl: string, fetcher: (url: string) => Promise<string> = (u) => fetchText(u)) {
  const base = new URL(siteUrl);
  if (base.protocol !== "http:" && base.protocol !== "https:") throw new Error("Die Website-Adresse muss mit http:// oder https:// beginnen.");
  const queue = [new URL("/sitemap.xml", base).href];
  const seen = new Set<string>();
  const paths = new Set<string>();
  const errors: string[] = [];
  while (queue.length && seen.size < SITEMAP_LIMITS.maxSitemaps) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    let xml: string;
    try {
      xml = await fetcher(url);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      continue;
    }
    const { urls, sitemaps } = parseSitemap(xml);
    for (const s of sitemaps) if (sameHost(s, base)) queue.push(s);
    for (const u of urls) {
      if (!sameHost(u, base)) continue;
      const p = normalizePath(u);
      if (p) paths.add(p);
      if (paths.size >= SITEMAP_LIMITS.maxUrls) break;
    }
  }
  return { paths: [...paths], errors, sitemaps: seen.size };
}

function sameHost(url: string, base: URL) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

/** Adds paths that have no entry yet. Returns how many were added. */
export async function addMissingPaths(paths: string[]) {
  if (!paths.length) return 0;
  let added = 0;
  for (let i = 0; i < paths.length; i += 500) {
    const chunk = paths.slice(i, i + 500);
    const existing = new Set((await db.select({ p: seoEntries.path }).from(seoEntries).where(inArray(seoEntries.path, chunk))).map((r) => r.p));
    const fresh = chunk.filter((p) => !existing.has(p));
    if (fresh.length) {
      await db.insert(seoEntries).values(fresh.map((path) => ({ path }))).onConflictDoNothing();
      added += fresh.length;
    }
  }
  return added;
}

export function toPublicSeo(e: SeoEntry) {
  return { path: e.path, title: e.title || null, description: e.description || null, canonical: e.canonical || null, ogImage: e.ogImage || null, noindex: e.noindex, updatedAt: e.updatedAt.toISOString() };
}
