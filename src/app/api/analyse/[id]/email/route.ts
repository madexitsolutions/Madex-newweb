import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getReport, markEmailSent } from "@/lib/server/analysis/engine";
import { sendReport } from "@/lib/server/analysis/email";

export const runtime = "nodejs";

/** Sends the report to the e-mail address given in the hero form (never to another one). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let token: string | null = null;
  try {
    token = String(((await req.json()) as { t?: unknown }).t ?? "");
  } catch {
    /* handled below */
  }
  const r = await getReport(id, token);
  if (!r) return NextResponse.json({ ok: false, error: "Dieser Bericht wurde nicht gefunden oder ist abgelaufen." }, { status: 404 });
  if (r.status !== "done") return NextResponse.json({ ok: false, error: "Die Analyse ist noch nicht fertig." }, { status: 409 });
  if (!rateLimit(`analyse-mail:${id}`, 3, 60 * 60_000)) return NextResponse.json({ ok: false, error: "Der Bericht wurde bereits mehrmals verschickt. Bitte prüfen Sie auch Ihren Spam-Ordner." }, { status: 429 });
  const sent = await sendReport(r);
  if (!sent.ok) {
    console.error("[analyse] E-Mail nicht gesendet:", sent.error);
    return NextResponse.json({ ok: false, error: "Die E-Mail konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut oder speichern Sie den Bericht als PDF." }, { status: 502 });
  }
  await markEmailSent(r);
  return NextResponse.json({ ok: true, sentAt: r.emailSentAt });
}
