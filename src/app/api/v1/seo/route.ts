/**
 * GET /api/v1/seo?path=/ueber-uns (scope content:read) – SEO data for one path (data: null when none)
 * GET /api/v1/seo                 – all entries (for build-time generation)
 */
import { asc } from "drizzle-orm";
import { apiAuth, apiError, json, preflight } from "@/server/api/http";
import { isModuleEnabled } from "@/modules/registry";
import { db } from "@/server/db";
import { seoEntries } from "@/server/db/schema";
import { getSeo, normalizePath, toPublicSeo } from "@/server/content/seo";

export const OPTIONS = preflight;

export async function GET(req: Request) {
  const auth = await apiAuth(req, "content:read");
  if (auth instanceof Response) return auth;
  if (!(await isModuleEnabled("seo"))) return apiError(req, auth, 404, "module_disabled", "Das Modul SEO ist ausgeschaltet.");
  const cache = { "cache-control": "public, max-age=60, stale-while-revalidate=300" };
  const path = new URL(req.url).searchParams.get("path");
  if (path !== null) {
    const p = normalizePath(path);
    if (!p) return apiError(req, auth, 400, "invalid_path", "path muss ein Pfad wie /ueber-uns sein.");
    const row = await getSeo(p);
    return json(req, auth, { data: row ? toPublicSeo(row) : null }, { headers: cache });
  }
  const rows = await db.select().from(seoEntries).orderBy(asc(seoEntries.path)).limit(10_000);
  return json(req, auth, { data: rows.map(toPublicSeo) }, { headers: cache });
}
