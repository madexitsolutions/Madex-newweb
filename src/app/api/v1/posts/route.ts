/** GET /api/v1/posts?category=&tag=&page=&limit= (scope content:read) – published posts, newest first. */
import { apiAuth, apiError, json, preflight } from "@/server/api/http";
import { isModuleEnabled } from "@/modules/registry";
import { publicPosts } from "@/server/content/posts";

export const OPTIONS = preflight;

export async function GET(req: Request) {
  const auth = await apiAuth(req, "content:read");
  if (auth instanceof Response) return auth;
  if (!(await isModuleEnabled("blog"))) return apiError(req, auth, 404, "module_disabled", "Das Modul Beiträge ist ausgeschaltet.");
  const sp = new URL(req.url).searchParams;
  const result = await publicPosts({
    category: sp.get("category")?.slice(0, 80) || undefined,
    tag: sp.get("tag")?.slice(0, 40) || undefined,
    page: Number(sp.get("page")) || 1,
    limit: Number(sp.get("limit")) || 10,
  });
  return json(req, auth, result, { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } });
}
