import { NextResponse } from "next/server";
import { recommend } from "@/lib/server/packages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Package finder: ranks packages by the visitor's goals (no prices, no internal notes). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { goals?: unknown; hasWebsite?: unknown; companySize?: unknown };
  const goals = Array.isArray(body.goals) ? body.goals.filter((g): g is string => typeof g === "string").slice(0, 10) : [];
  const packages = await recommend({ goals, hasWebsite: body.hasWebsite === true, companySize: Number(body.companySize) || 0 });
  return NextResponse.json({ ok: true, packages });
}
