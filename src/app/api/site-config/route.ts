import { NextResponse } from "next/server";
import { analyticsIds, getSettings } from "@/lib/server/settings";
import { metaPixelId } from "@/server/analytics/meta";
import { getSettings as getDashboardSettings } from "@/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Google Ads tag (AW-…) and the conversion label for enquiries – both public by nature. */
const googleAds = () => ({ adsId: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || "", adsLeadLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL?.trim() || "" });

/** Public, non-secret runtime config for the chat widget and the analytics loader. */
export async function GET() {
  const s = await getSettings();
  // the GA4 measurement ID is managed in the dashboard (Plugins → Google Analytics)
  const ga4 = (await getDashboardSettings("analytics").catch(() => null))?.ga4MeasurementId?.trim();
  const ids = analyticsIds(s.analytics);
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
      analytics: { ...ids, ga4Id: ga4 || ids.ga4Id, metaPixelId: metaPixelId(), ...googleAds(), requireConsent: s.analytics.requireConsent },
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
