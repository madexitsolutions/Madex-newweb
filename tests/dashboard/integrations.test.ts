import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { apiKeys, cartItems, carts, ipBlocks, loginEvents, rateLimits, roles, sessions, tokens, users, webhookDeliveries, webhooks } from "@/server/db/schema";
import { findKey } from "@/server/api/keys";
import { sign } from "@/server/events";
import { decrypt, sha256 } from "@/server/lib/crypto";
import { isIpBlocked } from "@/server/lib/ip-blocks";
import type { Permission } from "@/server/auth/permissions";
import { runMaintenance } from "@/server/cron";
import { createKey, createWebhook, normalizeEvents, parseOrigins, revokeKey, rotateWebhookSecret, validateGa, validateWebhookUrl } from "@/server/integrations";
import { allowlistError, createIpBlock, dayStart, deleteIpBlock } from "@/server/security";
import type { Actor } from "@/server/users";

async function ownerActor(): Promise<Actor> {
  const [r] = await db.select().from(roles).where(eq(roles.key, "owner"));
  const [u] = await db.insert(users).values({ email: `owner-${Math.random()}@example.ch`, name: "Owner", roleId: r.id }).returning();
  return { id: u.id, email: u.email, role: { key: "owner" }, permissions: new Set(r.permissions as Permission[]) };
}

describe("API-Schlüssel", () => {
  it("öffentliche Schlüssel erhalten keine geheimen Scopes", async () => {
    const actor = await ownerActor();
    const bad = await createKey(actor, { name: "Web", kind: "public", scopes: ["catalog:read", "orders:read"], origins: [] });
    expect(bad.ok).toBe(false);
    const good = await createKey(actor, { name: "Web", kind: "public", scopes: ["catalog:read", "cart:write"], origins: ["https://www.kunde.ch/"] });
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    expect(good.key.startsWith("pk_")).toBe(true);
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, good.id));
    expect(row.keyHash).toBe(sha256(good.key));
    expect(JSON.stringify(row)).not.toContain(good.key);
    expect(row.allowedOrigins).toEqual(["https://www.kunde.ch"]);
    expect((await findKey(good.key))?.id).toBe(good.id);
    expect(await findKey(good.key.slice(0, -2) + "xx")).toBeNull();

    expect((await revokeKey(actor, good.id)).ok).toBe(true);
    expect(await findKey(good.key)).toBeNull();
    expect((await revokeKey(actor, good.id)).ok).toBe(false);
  });

  it("geheime Schlüssel dürfen alle Scopes haben", async () => {
    const actor = await ownerActor();
    const r = await createKey(actor, { name: "ERP", kind: "secret", scopes: ["orders:read", "orders:write", "catalog:read"], origins: [] });
    expect(r.ok && r.key.startsWith("sk_")).toBe(true);
    expect((await createKey(actor, { name: "X", kind: "secret", scopes: ["gibt:esnicht"], origins: [] })).ok).toBe(false);
    expect((await createKey(actor, { name: "X", kind: "secret", scopes: [], origins: [] })).ok).toBe(false);
  });

  it("prüft Herkünfte", () => {
    expect(parseOrigins(["https://kunde.ch", "http://localhost:3000/"])).toEqual({ origins: ["https://kunde.ch", "http://localhost:3000"] });
    expect(parseOrigins(["kunde.ch"])).toEqual({ invalid: "kunde.ch" });
    expect(parseOrigins(["https://kunde.ch/shop"])).toEqual({ invalid: "https://kunde.ch/shop" });
    expect(parseOrigins(["*"])).toEqual({ invalid: "*" });
    expect(parseOrigins(["*"], true)).toEqual({ origins: ["*"] });
  });
});

describe("Webhooks", () => {
  it("signiert im Format t=…,v1=<hmac>", () => {
    const body = JSON.stringify({ event: "order.paid" });
    const header = sign("whsec_test", body, 1_700_000_000);
    const expected = createHmac("sha256", "whsec_test").update(`1700000000.${body}`).digest("hex");
    expect(header).toBe(`t=1700000000,v1=${expected}`);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it("verlangt https (ausser localhost) und gültige Ereignisse", async () => {
    expect("error" in validateWebhookUrl("http://kunde.ch/hook")).toBe(true);
    expect("url" in validateWebhookUrl("http://localhost:4000/hook")).toBe(true);
    expect("url" in validateWebhookUrl("https://kunde.ch/hook")).toBe(true);
    expect("error" in validateWebhookUrl("https://user:pw@kunde.ch/hook")).toBe(true);
    expect("error" in validateWebhookUrl("ftp://kunde.ch")).toBe(true);
    expect(normalizeEvents(["order.paid", "quatsch"])).toEqual(["order.paid"]);
    expect(normalizeEvents(["order.paid", "*"])).toEqual(["*"]);

    const actor = await ownerActor();
    expect((await createWebhook(actor, { name: "X", url: "https://kunde.ch/h", events: [], active: true })).ok).toBe(false);
    const r = await createWebhook(actor, { name: "ERP", url: "https://kunde.ch/h", events: ["order.paid"], active: true });
    if (!r.ok) throw new Error(r.error);
    expect(r.secret.startsWith("whsec_")).toBe(true);
    const [row] = await db.select().from(webhooks).where(eq(webhooks.id, r.id));
    expect(row.secret).not.toContain(r.secret);
    expect(decrypt(row.secret)).toBe(r.secret);
    const rot = await rotateWebhookSecret(actor, r.id);
    if (!rot.ok) throw new Error(rot.error);
    expect(rot.secret).not.toBe(r.secret);
  });
});

describe("Google Analytics", () => {
  it("prüft Formate und liest den Schlüssel aus der JSON-Datei", () => {
    const pem = "-----BEGIN PRIVATE KEY-----\nMIIabc\n-----END PRIVATE KEY-----";
    const json = JSON.stringify({ type: "service_account", client_email: "ga@projekt-123.iam.gserviceaccount.com", private_key: pem + "\n" });
    const r = validateGa({ ga4MeasurementId: "g-abc123xyz", ga4PropertyId: "412345678", serviceAccountEmail: "", serviceAccountKey: json });
    expect("value" in r && r.value).toMatchObject({ ga4MeasurementId: "G-ABC123XYZ", serviceAccountEmail: "ga@projekt-123.iam.gserviceaccount.com", serviceAccountKey: pem });
    expect(validateGa({ ga4MeasurementId: "UA-1234", ga4PropertyId: "", serviceAccountEmail: "", serviceAccountKey: "" })).toMatchObject({ field: "ga4MeasurementId" });
    expect(validateGa({ ga4MeasurementId: "", ga4PropertyId: "G-1", serviceAccountEmail: "", serviceAccountKey: "" })).toMatchObject({ field: "ga4PropertyId" });
    expect(validateGa({ ga4MeasurementId: "", ga4PropertyId: "", serviceAccountEmail: "a@gmail.com", serviceAccountKey: "" })).toMatchObject({ field: "serviceAccountEmail" });
    expect(validateGa({ ga4MeasurementId: "", ga4PropertyId: "", serviceAccountEmail: "", serviceAccountKey: "abc" })).toMatchObject({ field: "serviceAccountKey" });
  });
});

describe("Sicherheit", () => {
  it("verhindert, dass man sich mit der Freigabeliste aussperrt", () => {
    expect(allowlistError([], "203.0.113.5")).toBeNull();
    expect(allowlistError(["203.0.113.0/24"], "203.0.113.5")).toBeNull();
    expect(allowlistError(["198.51.100.0/24"], "203.0.113.5")).toMatch(/aussperren/);
    expect(allowlistError(["kein-ip"], "203.0.113.5")).toMatch(/keine gültige/);
  });

  it("sperrt IPs mit Ablauf und nie die eigene", async () => {
    const actor = await ownerActor();
    expect((await createIpBlock(actor, { cidr: "203.0.113.0/24", reason: "", expiresAt: null }, "203.0.113.9")).ok).toBe(false);
    const r = await createIpBlock(actor, { cidr: "192.0.2.0/24", reason: "Bots", expiresAt: null }, "203.0.113.9");
    if (!r.ok) throw new Error(r.error);
    expect(await isIpBlocked("192.0.2.77")).toBe(true);
    expect(await isIpBlocked("192.0.3.1")).toBe(false);
    await deleteIpBlock(actor, r.id);
    expect(await isIpBlocked("192.0.2.77")).toBe(false);
    await db.insert(ipBlocks).values({ cidr: "192.0.2.5", expiresAt: new Date(Date.now() - 1000) });
    expect(await isIpBlocked("192.0.2.5")).toBe(false);
  });

  it("rechnet Datumsfilter in Schweizer Zeit", () => {
    expect(dayStart("2026-07-01")?.toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(dayStart("2026-01-15")?.toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(dayStart("gestern")).toBeNull();
  });
});

describe("Cron", () => {
  it("räumt abgelaufene Daten auf und lässt aktuelle stehen", async () => {
    const [r] = await db.select().from(roles).where(eq(roles.key, "viewer"));
    const [u] = await db.insert(users).values({ email: "cron@example.ch", name: "Cron", roleId: r.id }).returning();
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 3_600_000);
    const old = (days: number) => new Date(Date.now() - days * 86_400_000);
    await db.insert(sessions).values([
      { id: "s-old", userId: u.id, stage: "active", expiresAt: past },
      { id: "s-new", userId: u.id, stage: "active", expiresAt: future },
    ]);
    await db.insert(tokens).values([
      { id: "t-old", type: "password_reset", userId: u.id, email: u.email, expiresAt: past },
      { id: "t-new", type: "password_reset", userId: u.id, email: u.email, expiresAt: future },
    ]);
    await db.insert(rateLimits).values([
      { key: "rl-old", count: 3, resetAt: past },
      { key: "rl-new", count: 3, resetAt: future },
    ]);
    await db.insert(carts).values([
      { id: "c-old", updatedAt: old(31) },
      { id: "c-new", updatedAt: old(2) },
    ]);
    await db.insert(loginEvents).values([
      { email: "a@x.ch", success: true, createdAt: old(200) },
      { email: "b@x.ch", success: true, createdAt: old(10) },
    ]);
    const s = await runMaintenance();
    expect(s.sessionsPruned).toBeGreaterThanOrEqual(1);
    expect(s.tokensPruned).toBeGreaterThanOrEqual(1);
    expect(s.cartsPruned).toBe(1);
    expect(s.loginEventsPruned).toBe(1);
    expect((await db.select().from(sessions).where(eq(sessions.id, "s-new"))).length).toBe(1);
    expect((await db.select().from(sessions).where(eq(sessions.id, "s-old"))).length).toBe(0);
    expect((await db.select().from(tokens).where(eq(tokens.id, "t-new"))).length).toBe(1);
    expect((await db.select().from(rateLimits).where(eq(rateLimits.key, "rl-new"))).length).toBe(1);
    expect((await db.select().from(rateLimits).where(eq(rateLimits.key, "rl-old"))).length).toBe(0);
    expect((await db.select().from(carts).where(eq(carts.id, "c-new"))).length).toBe(1);
    expect((await db.select().from(cartItems)).length).toBe(0);
    expect((await db.select().from(loginEvents)).map((e) => e.email)).toEqual(["b@x.ch"]);
    expect(await db.select().from(webhookDeliveries)).toEqual([]);
  });
});
