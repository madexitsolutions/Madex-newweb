/**
 * Helpers for /api/v1 route handlers: API-key auth with scopes, CORS for the
 * connected webapps, rate limiting and one JSON error format:
 *   { "error": { "code": "not_found", "message": "…" } }
 *
 * Usage in a route:
 *   export const OPTIONS = preflight;
 *   export async function GET(req: Request) {
 *     const auth = await apiAuth(req, "catalog:read");
 *     if (auth instanceof Response) return auth;
 *     return json(req, auth, { data });
 *   }
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { apiKeys } from "@/server/db/schema";
import { isIpBlocked } from "@/server/lib/ip-blocks";
import { hit } from "@/server/lib/rate-limit";
import { ipFromRequest } from "@/server/lib/request";
import { getSettings } from "@/server/settings";
import { findKey, type Scope } from "./keys";

export type ApiContext = { keyId: string; kind: "public" | "secret"; scopes: string[]; origins: string[] };

async function allowedOrigin(req: Request, ctx?: ApiContext | null) {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const global = (await getSettings("api")).corsOrigins;
  const list = [...global, ...(ctx?.origins ?? [])];
  return list.includes("*") || list.includes(origin) ? origin : null;
}

async function corsHeaders(req: Request, ctx?: ApiContext | null): Promise<Record<string, string>> {
  const origin = await allowedOrigin(req, ctx);
  if (!origin) return { vary: "Origin" };
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-expose-headers": "x-cart-token, x-customer-token, x-ratelimit-remaining",
    vary: "Origin",
  };
}

export async function preflight(req: Request) {
  const origin = await allowedOrigin(req);
  return new Response(null, {
    status: 204,
    headers: origin
      ? {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "authorization, content-type, x-cart-token, x-customer-token, idempotency-key",
          "access-control-allow-credentials": "true",
          "access-control-max-age": "600",
          vary: "Origin",
        }
      : { vary: "Origin" },
  });
}

export async function json(req: Request, ctx: ApiContext | null, body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(await corsHeaders(req, ctx))) headers.set(k, v);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", headers.get("cache-control") ?? "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export async function apiError(req: Request, ctx: ApiContext | null, status: number, code: string, message: string, details?: unknown) {
  return json(req, ctx, { error: { code, message, ...(details ? { details } : {}) } }, { status });
}

/** Authenticates the request (Authorization: Bearer <key> or ?key=<public key>) and checks the scope. */
export async function apiAuth(req: Request, scope: Scope): Promise<ApiContext | Response> {
  // IP blocks (Sicherheit → Sperren) apply to the API as well
  if (await isIpBlocked(ipFromRequest(req))) return apiError(req, null, 403, "ip_blocked", "Diese IP-Adresse ist gesperrt.");
  const header = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : url.searchParams.get("key") ?? "";
  const key = raw ? await findKey(raw) : null;
  if (!key) return apiError(req, null, 401, "unauthorized", "Gültiger API-Schlüssel fehlt.");
  const ctx: ApiContext = { keyId: key.id, kind: key.kind, scopes: key.scopes, origins: key.allowedOrigins };
  if (key.kind === "secret" && raw === url.searchParams.get("key")) return apiError(req, ctx, 401, "unauthorized", "Geheime Schlüssel dürfen nur im Authorization-Header gesendet werden.");
  if (!key.scopes.includes(scope)) return apiError(req, ctx, 403, "forbidden", `Dem Schlüssel fehlt die Berechtigung «${scope}».`);
  // public keys used from a browser must come from an allowed origin
  const origin = req.headers.get("origin");
  if (key.kind === "public" && origin && !(await allowedOrigin(req, ctx))) return apiError(req, ctx, 403, "origin_not_allowed", `Die Herkunft ${origin} ist für diesen Schlüssel nicht freigegeben.`);
  const limit = await hit(`api:${key.id}:${ipFromRequest(req)}`, key.kind === "secret" ? 600 : 120, 60_000);
  if (!limit.allowed) return apiError(req, ctx, 429, "rate_limited", "Zu viele Anfragen. Bitte kurz warten.");
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
  return ctx;
}

/** Parses a JSON body; returns a 400 response on invalid JSON. */
export async function readJson<T = unknown>(req: Request, ctx: ApiContext): Promise<T | Response> {
  try {
    return (await req.json()) as T;
  } catch {
    return apiError(req, ctx, 400, "invalid_json", "Der Body ist kein gültiges JSON.");
  }
}
