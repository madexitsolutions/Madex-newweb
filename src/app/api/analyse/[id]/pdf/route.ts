import { getReport, getShot } from "@/lib/server/analysis/engine";
import { reportUrl } from "@/lib/server/analysis/email";
import { renderReportPdf } from "@/lib/server/analysis/pdf";

export const runtime = "nodejs";

/** The finished report as a designed PDF (download). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await getReport(id, new URL(req.url).searchParams.get("t"));
  if (!r) return new Response("Dieser Bericht wurde nicht gefunden oder ist abgelaufen.", { status: 404 });
  if (r.status !== "done") return new Response("Die Analyse ist noch nicht fertig.", { status: 409 });
  const [mobile, desktop] = await Promise.all([getShot(id, "mobile"), getShot(id, "desktop")]);
  const pdf = await renderReportPdf(r, { mobile: mobile ?? undefined, desktop: desktop ?? undefined }, reportUrl(r));
  const name = `Website-Analyse ${r.domain}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name.replace(/[^\w. -]/g, "")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
