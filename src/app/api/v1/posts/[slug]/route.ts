/** GET /api/v1/posts/<slug> (scope content:read) – one published post with its HTML body. */
import { apiAuth, apiError, json, preflight } from "@/server/api/http";
import { isModuleEnabled } from "@/modules/registry";
import { publicPost } from "@/server/content/posts";

export const OPTIONS = preflight;

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await apiAuth(req, "content:read");
  if (auth instanceof Response) return auth;
  if (!(await isModuleEnabled("blog"))) return apiError(req, auth, 404, "module_disabled", "Das Modul Beiträge ist ausgeschaltet.");
  const { slug } = await ctx.params;
  const post = /^[a-z0-9-]{1,96}$/.test(slug) ? await publicPost(slug) : null;
  if (!post) return apiError(req, auth, 404, "not_found", "Beitrag nicht gefunden oder nicht veröffentlicht.");
  return json(req, auth, { data: post }, { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } });
}
