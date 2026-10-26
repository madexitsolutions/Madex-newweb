import { rateLimit } from "@/lib/rate-limit";
import { getReport, getShot } from "@/lib/server/analysis/engine";
import { clientIp } from "@/lib/server/analysis/guard";

export const runtime = "nodejs";

/** Screenshot from the Google test (mobile or desktop). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; which: string }> }) {
  if (!rateLimit(`analyse-img:${clientIp(req)}`, 120, 10 * 60_000)) return new Response("Zu viele Anfragen. Bitte warten Sie einen Moment.", { status: 429 });
  const { id, which } = await ctx.params;
  if (which !== "mobile" && which !== "desktop") return new Response("Nicht gefunden", { status: 404 });
  const r = await getReport(id, new URL(req.url).searchParams.get("t"));
  const shot = r ? await getShot(id, which) : null;
  const m = shot?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return new Response("Nicht gefunden", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}
