import { NextResponse } from "next/server";
import { appendMessages, getSession } from "@/lib/server/chats";
import { extractActions, nextActions, respond, UNCONFIRMED } from "@/lib/server/orion";
import { checkMessage, clientIp, logSecurity } from "@/lib/server/security";
import { getSettings } from "@/lib/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const settings = await getSettings();
  if (!settings.chatbot.enabled) return NextResponse.json({ ok: false, error: "Der Chat ist derzeit deaktiviert." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { id?: string; token?: string; message?: string } | null;
  if (!body?.id || !body.token || typeof body.message !== "string") return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  const session = await getSession(body.id, body.token);
  if (!session) return NextResponse.json({ ok: false, error: "Die Chat-Sitzung ist abgelaufen. Bitte starten Sie ein neues Gespräch." }, { status: 401 });

  const ip = clientIp(req);
  const message = body.message.trim();
  const check = checkMessage(ip, message, settings.security);
  if (!check.ok) {
    await logSecurity(check.reason, ip, message.slice(0, 80));
    return NextResponse.json({ ok: false, error: check.message }, { status: 429 });
  }

  const history = [...session.messages.map(({ role, content }) => ({ role, content })), { role: "user" as const, content: message }];
  let raw: string;
  try {
    raw = await respond(history, settings.chatbot);
  } catch (err) {
    console.error("[orion]", err);
    raw = UNCONFIRMED + "\n[[kontakt]]";
  }
  const { text, actions } = extractActions(raw);
  const finalActions = nextActions(message, text, actions);
  const now = new Date().toISOString();
  await appendMessages(session.id, [
    { role: "user", content: message, at: now },
    { role: "assistant", content: text, at: now, actions: finalActions },
  ]);
  return NextResponse.json({ ok: true, reply: text, actions: finalActions });
}
