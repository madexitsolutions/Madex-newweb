import { NextResponse } from "next/server";
import { appendMessages, createSession, getSession } from "@/lib/server/chats";
import { checkNewSession, clientIp, logSecurity } from "@/lib/server/security";
import { getSettings } from "@/lib/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start a chat session (token-protected). */
export async function POST(req: Request) {
  const settings = await getSettings();
  if (!settings.chatbot.enabled) return NextResponse.json({ ok: false, error: "Der Chat ist derzeit deaktiviert." }, { status: 503 });
  const ip = clientIp(req);
  const check = checkNewSession(ip, settings.security);
  if (!check.ok) {
    await logSecurity(check.reason, ip);
    return NextResponse.json({ ok: false, error: check.message }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { page?: string };
  const { id, token } = await createSession(typeof body.page === "string" ? body.page.slice(0, 200) : undefined);
  const welcome = settings.chatbot.welcomeMessage;
  await appendMessages(id, [{ role: "assistant", content: welcome, at: new Date().toISOString() }]);
  return NextResponse.json({ ok: true, id, token, welcome });
}

/** Load an earlier conversation (requires its token). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const s = await getSession(url.searchParams.get("id") ?? "", url.searchParams.get("token") ?? "");
  if (!s) return NextResponse.json({ ok: false, error: "Der Chatverlauf konnte nicht geladen werden." }, { status: 404 });
  return NextResponse.json({ ok: true, messages: s.messages.map(({ role, content, actions }) => ({ role, content, actions })) });
}
