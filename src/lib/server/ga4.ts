/**
 * Google Analytics 4 Data API (read-only) via a service account – no SDK needed.
 * Env: GA4_PROPERTY_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 * The service account must be added as "Betrachter" in the GA4 property.
 */
import { createSign } from "node:crypto";

let cached: { token: string; exp: number } | null = null;

export function ga4Configured() {
  return Boolean(process.env.GA4_PROPERTY_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
}

const b64 = (v: object | string) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

async function accessToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claims)}`;
  const key = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Google-Anmeldung fehlgeschlagen (HTTP ${res.status}). Prüfen Sie E-Mail und Schlüssel des Dienstkontos.`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

type Row = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };

async function runReport(body: object) {
  const token = await accessToken();
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(process.env.GA4_PROPERTY_ID!)}:runReport`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (res.status === 403) throw new Error("Das Dienstkonto hat keinen Zugriff auf die GA4-Property. Fügen Sie es in Google Analytics als Betrachter hinzu.");
  if (!res.ok) throw new Error(`Google Analytics antwortet mit Status ${res.status}.`);
  return ((await res.json()) as { rows?: Row[] }).rows ?? [];
}

export type Ga4Report = {
  totals: { users: number; sessions: number; views: number; engagement: number };
  days: { date: string; users: number; views: number }[];
  pages: { path: string; views: number }[];
  sources: { source: string; sessions: number }[];
};

export async function ga4Report(days = 28): Promise<Ga4Report> {
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
  const [totals, daily, pages, sources] = await Promise.all([
    runReport({ dateRanges, metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "engagementRate" }] }),
    runReport({ dateRanges, dimensions: [{ name: "date" }], metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }], orderBys: [{ dimension: { dimensionName: "date" } }] }),
    runReport({ dateRanges, dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 10 }),
    runReport({ dateRanges, dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 8 }),
  ]);
  const n = (r: Row | undefined, i: number) => Number(r?.metricValues?.[i]?.value ?? 0);
  return {
    totals: { users: n(totals[0], 0), sessions: n(totals[0], 1), views: n(totals[0], 2), engagement: n(totals[0], 3) },
    days: daily.map((r) => {
      const d = r.dimensionValues?.[0]?.value ?? "";
      return { date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, users: n(r, 0), views: n(r, 1) };
    }),
    pages: pages.map((r) => ({ path: r.dimensionValues?.[0]?.value ?? "", views: n(r, 0) })),
    sources: sources.map((r) => ({ source: r.dimensionValues?.[0]?.value ?? "", sessions: n(r, 0) })),
  };
}
