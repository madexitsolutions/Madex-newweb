import { NextResponse } from "next/server";
import { analyticsIds, getSettings } from "@/lib/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, non-secret runtime config for the chat widget and the analytics loader. */
export async function GET() {
  const s = await getSettings();
  const c = s.chatbot;
  return NextResponse.json(
    {
      chat: {
        enabled: c.enabled,
        name: c.assistantName,
        welcome: c.welcomeMessage,
        teaserEnabled: c.teaserEnabled,
        teaserMessage: c.teaserMessage,
        teaserDelay: c.teaserDelay,
        teaserMobile: c.teaserMobile,
      },
      analytics: { ...analyticsIds(s.analytics), requireConsent: s.analytics.requireConsent },
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
