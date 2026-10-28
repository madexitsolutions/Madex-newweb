/**
 * Google Analytics 4 Data API (read-only) with a service account – no SDK.
 * The service account signs a JWT (RS256, node:crypto), exchanges it for an
 * access token and calls properties/<id>:runReport. Results are cached in
 * memory for 15 minutes. Settings: Einstellungen → Statistiken (analytics group).
 * The service account must be added to the GA4 property as "Betrachter".
 */
import { createPrivateKey, createSign, type KeyObject } from "node:crypto";
import { getSettings } from "@/server/settings";
import { addDays, zurichDay } from "@/lib/tz";

export const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
export const GA4_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CACHE_MS = 15 * 60_000;
const ERROR_CACHE_MS = 60_000;

export class Ga4Error extends Error {
  constructor(
    message: string,
    public code: "config" | "auth" | "forbidden" | "not_found" | "quota" | "network" | "unknown",
  ) {
    super(message);
  }
}

const b64 = (v: object | string) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

/** Accepts the downloaded JSON key file or just the PEM private key (with literal "\n" too). */
export function parseServiceAccount(email: string, rawKey: string): { email: string; key: KeyObject } {
  let pem = rawKey.trim();
  let mail = email.trim();
  if (pem.startsWith("{")) {
    try {
      const j = JSON.parse(pem) as { private_key?: string; client_email?: string };
      pem = j.private_key ?? "";
      mail ||= j.client_email ?? "";
    } catch {
      throw new Ga4Error("Der Dienstkonto-Schlüssel ist kein gültiges JSON. Fügen Sie den Inhalt der heruntergeladenen JSON-Datei vollständig ein.", "config");
    }
  }
  pem = pem.replace(/\\n/g, "\n");
  if (!mail) throw new Ga4Error("Die E-Mail-Adresse des Dienstkontos fehlt.", "config");
  try {
    return { email: mail, key: createPrivateKey(pem) };
  } catch {
    throw new Ga4Error("Der private Schlüssel des Dienstkontos ist ungültig. Er beginnt mit «-----BEGIN PRIVATE KEY-----».", "config");
  }
}

/** Signed JWT assertion for the OAuth 2.0 JWT bearer flow. */
export function createJwt(email: string, key: KeyObject | string, nowSec = Math.floor(Date.now() / 1000), scope = GA4_SCOPE) {
  const claims = { iss: email, scope, aud: GA4_TOKEN_URL, iat: nowSec, exp: nowSec + 3600 };
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claims)}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key).toString("base64url");
  return `${unsigned}.${signature}`;
}

const tokens = new Map<string, { token: string; exp: number }>();

/** OAuth access token of the service account (cached). Other Google APIs (e.g. Search Console) pass their own scope. */
export async function accessToken(email: string, key: KeyObject, scope = GA4_SCOPE) {
  const cacheKey = `${email} ${scope}`;
  const hit = tokens.get(cacheKey);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  let res: Response;
  try {
    res = await fetch(GA4_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: createJwt(email, key, undefined, scope) }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Ga4Error("Google ist nicht erreichbar. Prüfen Sie die Internetverbindung des Servers und versuchen Sie es später erneut.", "network");
  }
  if (!res.ok) throw new Ga4Error("Anmeldung bei Google fehlgeschlagen – prüfen Sie E-Mail-Adresse und Schlüssel des Dienstkontos (Schlüssel eventuell widerrufen).", "auth");
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokens.set(cacheKey, { token: json.access_token, exp: Date.now() + json.expires_in * 1000 });
  return json.access_token;
}

type Row = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };

/** Maps an HTTP status of the Data API to a helpful message. */
export function ga4HttpError(status: number, body = ""): Ga4Error {
  if (status === 403 || status === 401) return new Ga4Error("Zugriff verweigert – Dienstkonto in Google Analytics (Verwaltung → Zugriffsverwaltung für Properties) als Betrachter hinzufügen.", "forbidden");
  if (status === 404 || (status === 400 && /property/i.test(body))) return new Ga4Error("Property nicht gefunden – prüfen Sie die numerische Property-ID (nicht die Mess-ID «G-…»).", "not_found");
  if (status === 429) return new Ga4Error("Das Tageskontingent der Google Analytics API ist aufgebraucht. Die Zahlen sind später wieder verfügbar.", "quota");
  return new Ga4Error(`Google Analytics antwortet mit Status ${status}. Versuchen Sie es später erneut.`, "unknown");
}

async function runReport(cfg: { propertyId: string; email: string; key: KeyObject }, body: object): Promise<Row[]> {
  const token = await accessToken(cfg.email, cfg.key);
  let res: Response;
  try {
    res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(cfg.propertyId)}:runReport`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new Ga4Error("Google Analytics ist nicht erreichbar. Versuchen Sie es später erneut.", "network");
  }
  if (!res.ok) throw ga4HttpError(res.status, await res.text().catch(() => ""));
  return ((await res.json()) as { rows?: Row[] }).rows ?? [];
}

export async function ga4Config() {
  const s = await getSettings("analytics");
  const configured = Boolean(s.ga4PropertyId && s.serviceAccountKey && (s.serviceAccountEmail || s.serviceAccountKey.trim().startsWith("{")));
  return { configured, propertyId: s.ga4PropertyId.replace(/^properties\//, "").trim(), email: s.serviceAccountEmail, rawKey: s.serviceAccountKey };
}

export type Ga4Report = {
  totals: { users: number; newUsers: number; sessions: number; views: number; engagement: number };
  previous: { users: number; sessions: number; views: number };
  days: { date: string; users: number; sessions: number; views: number }[];
  pages: { path: string; views: number; users: number }[];
  sources: { source: string; sessions: number }[];
  devices: { device: string; sessions: number }[];
  fetchedAt: string;
};

const cache = new Map<string, { at: number; value?: Ga4Report; error?: Ga4Error }>();

const n = (r: Row | undefined, i: number) => Number(r?.metricValues?.[i]?.value ?? 0);
const dim = (r: Row, i = 0) => r.dimensionValues?.[i]?.value ?? "";

const DEVICE: Record<string, string> = { desktop: "Desktop", mobile: "Mobil", tablet: "Tablet", smart_tv: "Smart-TV" };
const CHANNEL: Record<string, string> = {
  "Organic Search": "Suchmaschinen",
  Direct: "Direkt",
  Referral: "Verweise",
  "Organic Social": "Soziale Netzwerke",
  "Paid Search": "Bezahlte Suche",
  "Paid Social": "Bezahlte soziale Netzwerke",
  Email: "E-Mail",
  Display: "Display-Werbung",
  Unassigned: "Nicht zugeordnet",
  "Organic Video": "Video",
  "Cross-network": "Netzwerkübergreifend",
};

/** Full report for [fromDay, toDay] (YYYY-MM-DD) with the previous period for comparison. */
export async function ga4Report(range: { fromDay: string; toDay: string; prev: { fromDay: string; toDay: string } }): Promise<Ga4Report> {
  const c = await ga4Config();
  if (!c.configured) throw new Ga4Error("Google Analytics ist nicht eingerichtet.", "config");
  const key = `${c.propertyId}|${c.email}|${range.fromDay}|${range.toDay}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.error ? ERROR_CACHE_MS : CACHE_MS)) {
    if (hit.error) throw hit.error;
    return hit.value!;
  }
  try {
    const sa = parseServiceAccount(c.email, c.rawKey);
    const cfg = { propertyId: c.propertyId, email: sa.email, key: sa.key };
    const dateRanges = [{ startDate: range.fromDay, endDate: range.toDay }];
    const [totals, prev, daily, pages, sources, devices] = await Promise.all([
      runReport(cfg, { dateRanges, metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "engagementRate" }] }),
      runReport(cfg, { dateRanges: [{ startDate: range.prev.fromDay, endDate: range.prev.toDay }], metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }] }),
      runReport(cfg, { dateRanges, dimensions: [{ name: "date" }], metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }], orderBys: [{ dimension: { dimensionName: "date" } }], limit: 1000 }),
      runReport(cfg, { dateRanges, dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 10 }),
      runReport(cfg, { dateRanges, dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 8 }),
      runReport(cfg, { dateRanges, dimensions: [{ name: "deviceCategory" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }] }),
    ]);
    const value: Ga4Report = {
      totals: { users: n(totals[0], 0), newUsers: n(totals[0], 1), sessions: n(totals[0], 2), views: n(totals[0], 3), engagement: n(totals[0], 4) },
      previous: { users: n(prev[0], 0), sessions: n(prev[0], 1), views: n(prev[0], 2) },
      days: daily.map((r) => {
        const d = dim(r);
        return { date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, users: n(r, 0), sessions: n(r, 1), views: n(r, 2) };
      }),
      pages: pages.map((r) => ({ path: dim(r), views: n(r, 0), users: n(r, 1) })),
      sources: sources.map((r) => ({ source: CHANNEL[dim(r)] ?? dim(r), sessions: n(r, 0) })),
      devices: devices.map((r) => ({ device: DEVICE[dim(r)] ?? dim(r), sessions: n(r, 0) })),
      fetchedAt: new Date().toISOString(),
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    const err = e instanceof Ga4Error ? e : new Ga4Error("Google Analytics konnte nicht abgefragt werden.", "unknown");
    cache.set(key, { at: Date.now(), error: err });
    throw err;
  }
}

/** Visitors of the last 7 days and the 7 days before (overview card). */
export async function ga4Visitors(): Promise<{ users: number; previous: number; sessions: number; prevSessions: number; views: number; prevViews: number } | { error: string } | null> {
  const c = await ga4Config();
  if (!c.configured) return null;
  const today = zurichDay(new Date());
  try {
    const r = await ga4Report({ fromDay: addDays(today, -6), toDay: today, prev: { fromDay: addDays(today, -13), toDay: addDays(today, -7) } });
    return { users: r.totals.users, previous: r.previous.users, sessions: r.totals.sessions, prevSessions: r.previous.sessions, views: r.totals.views, prevViews: r.previous.views };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Fehler" };
  }
}

/** For tests. */
export function clearGa4Cache() {
  cache.clear();
  tokens.clear();
}
