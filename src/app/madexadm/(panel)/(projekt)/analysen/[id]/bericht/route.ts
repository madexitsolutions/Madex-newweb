import { redirect } from "next/navigation";
import { checkPermission } from "@/server/auth/session";
import { findReport } from "@/lib/server/analysis/engine";

/** Opens the public report of an analysis (its link carries the access token, which the list doesn't show). */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await checkPermission("inquiries.view")))
    return new Response("Keine Berechtigung.", { status: 403 });
  const { id } = await ctx.params;
  const r = await findReport(id);
  if (!r)
    return new Response("Diese Analyse gibt es nicht mehr.", { status: 404 });
  const pdf = new URL(req.url).searchParams.get("pdf") === "1";
  redirect(
    pdf
      ? `/api/analyse/${r.id}/pdf?t=${encodeURIComponent(r.token)}`
      : `/analyse/${r.id}?t=${encodeURIComponent(r.token)}&intern=1`,
  );
}
