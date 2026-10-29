/**
 * Meta (Facebook/Instagram) Conversions API: sends conversions from the server,
 * in addition to the Meta Pixel in the browser. Same event_id on both sides, so
 * Meta counts each conversion once. Only for visitors who agreed in the cookie
 * banner (cookie "madex-consent=yes"); e-mail and phone are SHA-256 hashed.
 *
 *   NEXT_PUBLIC_META_PIXEL_ID   – pixel (data set) ID, also used by the browser pixel
 *   META_CONVERSIONS_API_TOKEN  – access token from Events Manager → Settings → Conversions API
 *   META_TEST_EVENT_CODE        – optional, shows events under "Test events" while setting up
 */
import { createHash } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v23.0";
export const CONSENT_COOKIE = "madex-consent";

export const metaPixelId = () => process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "";
export const metaConfigured = () => Boolean(metaPixelId() && process.env.META_CONVERSIONS_API_TOKEN?.trim());

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
/** Swiss numbers without country code: 079 123 45 67 → 41791234567 */
export function normalizePhone(raw: string) {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `41${d.slice(1)}`;
  return d.length >= 8 ? d : "";
}

export type MetaEvent = {
  name: "Lead" | "Contact" | "Schedule";
  /** shared with the browser pixel (eventID) for deduplication */
  id: string;
  sourceUrl: string;
  email?: string;
  phone?: string;
  firstName?: string;
  ip?: string;
  userAgent?: string;
  /** _fbp / _fbc cookies set by the browser pixel */
  fbp?: string;
  fbc?: string;
  contentName?: string;
};

export function metaPayload(e: MetaEvent, now = Date.now()) {
  const user: Record<string, unknown> = {};
  if (e.email?.trim()) user.em = [sha(e.email.trim().toLowerCase())];
  const ph = e.phone ? normalizePhone(e.phone) : "";
  if (ph) user.ph = [sha(ph)];
  if (e.firstName?.trim()) user.fn = [sha(e.firstName.trim().toLowerCase())];
  if (e.ip) user.client_ip_address = e.ip;
  if (e.userAgent) user.client_user_agent = e.userAgent;
  if (e.fbp) user.fbp = e.fbp;
  if (e.fbc) user.fbc = e.fbc;
  const test = process.env.META_TEST_EVENT_CODE?.trim();
  return {
    data: [
      {
        event_name: e.name,
        event_time: Math.floor(now / 1000),
        event_id: e.id,
        action_source: "website",
        event_source_url: e.sourceUrl,
        user_data: user,
        ...(e.contentName ? { custom_data: { content_name: e.contentName } } : {}),
      },
    ],
    ...(test ? { test_event_code: test } : {}),
  };
}

/** Sends one event. Never throws – tracking must not break a form. */
export async function sendMetaEvent(e: MetaEvent): Promise<boolean> {
  if (!metaConfigured()) return false;
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(metaPixelId())}/events?access_token=${encodeURIComponent(process.env.META_CONVERSIONS_API_TOKEN!.trim())}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(metaPayload(e)),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) console.error("[meta] Conversions API", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return res.ok;
  } catch (err) {
    console.error("[meta] Conversions API nicht erreichbar:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Lead from a website form request – only with consent from the cookie banner. */
export function metaLeadFromRequest(req: Request, lead: { reference: string; email: string; phone?: string; name?: string; form: string }) {
  if (!metaConfigured()) return;
  const cookies = Object.fromEntries((req.headers.get("cookie") ?? "").split(/;\s*/).map((c) => [c.split("=")[0], decodeURIComponent(c.split("=").slice(1).join("="))]));
  if (cookies[CONSENT_COOKIE] !== "yes") return;
  const forwarded = process.env.TRUST_PROXY !== "false" ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") : null;
  // not awaited: the visitor gets the answer right away
  void sendMetaEvent({
    name: "Lead",
    id: lead.reference,
    sourceUrl: req.headers.get("referer") || process.env.NEXT_PUBLIC_SITE_URL || "",
    email: lead.email,
    phone: lead.phone,
    firstName: lead.name?.split(/\s+/)[0],
    ip: forwarded || undefined,
    userAgent: req.headers.get("user-agent") || undefined,
    fbp: cookies._fbp,
    fbc: cookies._fbc,
    contentName: lead.form,
  });
}
