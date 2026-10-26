import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getReport, toView } from "@/lib/server/analysis/engine";
import { clientIp } from "@/lib/server/analysis/guard";

export const runtime = "nodejs";

/** Progress and result of one analysis (polled by the report page). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // the page polls about once a second while a scan runs
  if (!rateLimit(`analyse-poll:${clientIp(req)}`, 400, 10 * 60_000)) return NextResponse.json({ ok: false, error: "Zu viele Anfragen. Bitte warten Sie einen Moment." }, { status: 429 });
  const { id } = await ctx.params;
  const r = await getReport(id, new URL(req.url).searchParams.get("t"));
  if (!r) return NextResponse.json({ ok: false, error: "Dieser Bericht wurde nicht gefunden oder ist abgelaufen." }, { status: 404 });
  return NextResponse.json({ ok: true, report: toView(r) }, { headers: { "Cache-Control": "no-store" } });
}
