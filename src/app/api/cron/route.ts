/**
 * Maintenance endpoint for a scheduler (Coolify "Scheduled Tasks", cron, uptime monitor).
 * Authorised with CRON_SECRET: `Authorization: Bearer <secret>` or `?secret=<secret>`.
 * Returns a JSON summary of what was done.
 */
import { safeEqual } from "@/server/lib/crypto";
import { runMaintenance } from "@/server/cron";

export const dynamic = "force-dynamic";

function authorised(req: Request) {
  const expected = process.env.CRON_SECRET ?? "";
  if (expected.length < 16) return "missing";
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : (new URL(req.url).searchParams.get("secret") ?? "");
  return given && safeEqual(given, expected) ? "ok" : "denied";
}

async function handle(req: Request) {
  const auth = authorised(req);
  const headers = { "cache-control": "no-store" };
  if (auth === "missing") return Response.json({ error: { code: "not_configured", message: "CRON_SECRET ist nicht gesetzt (mind. 16 Zeichen)." } }, { status: 503, headers });
  if (auth === "denied") return Response.json({ error: { code: "unauthorized", message: "Ungültiges Cron-Geheimnis." } }, { status: 401, headers });
  try {
    const summary = await runMaintenance();
    return Response.json({ ok: true, ranAt: new Date().toISOString(), ...summary }, { headers });
  } catch (e) {
    console.error("[cron]", e);
    return Response.json({ ok: false, error: { code: "failed", message: e instanceof Error ? e.message : "Unbekannter Fehler" } }, { status: 500, headers });
  }
}

export const GET = handle;
export const POST = handle;
