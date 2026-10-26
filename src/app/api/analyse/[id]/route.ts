import { NextResponse } from "next/server";
import { getReport, toView } from "@/lib/server/analysis/engine";

export const runtime = "nodejs";

/** Progress and result of one analysis (polled by the report page). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await getReport(id, new URL(req.url).searchParams.get("t"));
  if (!r) return NextResponse.json({ ok: false, error: "Dieser Bericht wurde nicht gefunden oder ist abgelaufen." }, { status: 404 });
  return NextResponse.json({ ok: true, report: toView(r) }, { headers: { "Cache-Control": "no-store" } });
}
