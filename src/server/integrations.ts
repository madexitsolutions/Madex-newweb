/**
 * Integrations: API keys, outgoing webhooks and the Google Analytics
 * connection. Pages and actions only call these functions.
 */
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { apiKeys, webhookDeliveries, webhooks } from "@/server/db/schema";
import { audit } from "@/server/audit";
import { createApiKey, SCOPES, type Scope } from "@/server/api/keys";
import { EVENTS, ping, redeliver } from "@/server/events";
import { encrypt, randomToken } from "@/server/lib/crypto";
import type { Actor, Result } from "./users";

const err = (error: string) => ({ ok: false as const, error });

/* --------------------------------------------------------------- origins */

/** "https://www.kunde.ch/" → "https://www.kunde.ch"; null when not a plain origin. */
export function normalizeOrigin(raw: string): string | null {
  const s = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^/?#\s]+$/i.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Validates a list of origins; returns the normalised list or the first invalid entry. */
export function parseOrigins(list: string[], allowWildcard = false): { origins: string[] } | { invalid: string } {
  const out: string[] = [];
  for (const raw of list) {
    if (allowWildcard && raw.trim() === "*") {
      out.push("*");
      continue;
    }
    const o = normalizeOrigin(raw);
    if (!o) return { invalid: raw };
    if (!out.includes(o)) out.push(o);
  }
  return { origins: out };
}

/* -------------------------------------------------------------- API keys */

export async function listApiKeys() {
  return db.select().from(apiKeys).orderBy(sql`${apiKeys.revokedAt} is not null`, desc(apiKeys.createdAt));
}

export async function createKey(actor: Actor, input: { name: string; kind: "public" | "secret"; scopes: string[]; origins: string[] }): Promise<Result<{ key: string; id: string }>> {
  const scopes = [...new Set(input.scopes)];
  const unknown = scopes.filter((s) => !(s in SCOPES));
  if (unknown.length) return err(`Unbekannte Berechtigung: ${unknown.join(", ")}.`);
  if (!scopes.length) return err("Wählen Sie mindestens eine Berechtigung (Scope).");
  if (input.kind === "public") {
    const secretOnly = scopes.filter((s) => !SCOPES[s as Scope].public);
    if (secretOnly.length) return err(`Öffentliche Schlüssel dürfen nur öffentliche Berechtigungen haben (nicht: ${secretOnly.join(", ")}). Verwenden Sie dafür einen geheimen Schlüssel.`);
  }
  const parsed = parseOrigins(input.origins);
  if ("invalid" in parsed) return err(`«${parsed.invalid}» ist keine gültige Herkunft. Erwartet wird z. B. https://www.kunde.ch (ohne Pfad).`);
  const { key, row } = await createApiKey({ name: input.name.trim(), kind: input.kind, scopes: scopes as Scope[], allowedOrigins: input.kind === "public" ? parsed.origins : [], userId: actor.id });
  await audit(actor, "api_key.created", { entityType: "api_key", entityId: row.id, summary: `${input.kind === "public" ? "Öffentlicher" : "Geheimer"} API-Schlüssel «${row.name}» erstellt`, data: { scopes: row.scopes, prefix: row.prefix } });
  return { ok: true, key, id: row.id };
}

export async function revokeKey(actor: Actor, id: string): Promise<Result> {
  const [row] = await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt))).returning();
  if (!row) return err("Der Schlüssel ist bereits widerrufen.");
  await audit(actor, "api_key.revoked", { entityType: "api_key", entityId: id, summary: `API-Schlüssel «${row.name}» (${row.prefix}…) widerrufen` });
  return { ok: true };
}

/* -------------------------------------------------------------- webhooks */

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** https only, except for local development targets. */
export function validateWebhookUrl(raw: string): { url: string } | { error: string } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { error: "Bitte eine vollständige Adresse eingeben, z. B. https://www.kunde.ch/api/webhooks/dashboard." };
  }
  if (u.username || u.password) return { error: "Zugangsdaten gehören nicht in die Adresse. Prüfen Sie die Signatur statt Basic-Auth." };
  const local = LOCAL_HOSTS.includes(u.hostname) || u.hostname.endsWith(".localhost");
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return { error: "Die Adresse muss mit https:// beginnen (http:// nur für localhost)." };
  return { url: u.toString() };
}

export function normalizeEvents(list: string[]): string[] {
  if (list.includes("*")) return ["*"];
  return Object.keys(EVENTS).filter((e) => list.includes(e));
}

const newWebhookSecret = () => `whsec_${randomToken(24)}`;

export async function listWebhooks() {
  const hooks = await db.select().from(webhooks).orderBy(webhooks.name);
  if (!hooks.length) return [];
  const ids = hooks.map((h) => h.id);
  const recent = await db
    .select({ webhookId: webhookDeliveries.webhookId, status: webhookDeliveries.status, createdAt: webhookDeliveries.createdAt, code: webhookDeliveries.responseCode })
    .from(webhookDeliveries)
    .where(inArray(webhookDeliveries.webhookId, ids))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(500);
  const failed = await db
    .select({ webhookId: webhookDeliveries.webhookId, n: count() })
    .from(webhookDeliveries)
    .where(and(inArray(webhookDeliveries.webhookId, ids), eq(webhookDeliveries.status, "failed")))
    .groupBy(webhookDeliveries.webhookId);
  return hooks.map((h) => ({ ...h, secret: undefined, last: recent.find((r) => r.webhookId === h.id) ?? null, failedCount: failed.find((f) => f.webhookId === h.id)?.n ?? 0 }));
}

export async function getWebhook(id: string) {
  const [h] = await db.select().from(webhooks).where(eq(webhooks.id, id));
  return h ? { ...h, secret: undefined } : null;
}

type HookInput = { name: string; url: string; events: string[]; active: boolean };

function checkHook(input: HookInput) {
  const v = validateWebhookUrl(input.url);
  if ("error" in v) return v;
  const events = normalizeEvents(input.events);
  if (!events.length) return { error: "Wählen Sie mindestens ein Ereignis." };
  return { url: v.url, events };
}

export async function createWebhook(actor: Actor, input: HookInput): Promise<Result<{ id: string; secret: string }>> {
  const c = checkHook(input);
  if ("error" in c) return err(c.error);
  const secret = newWebhookSecret();
  const [row] = await db.insert(webhooks).values({ name: input.name.trim(), url: c.url, events: c.events, active: input.active, secret: encrypt(secret) }).returning();
  await audit(actor, "webhook.created", { entityType: "webhook", entityId: row.id, summary: `Webhook «${row.name}» erstellt`, data: { url: row.url, events: row.events } });
  return { ok: true, id: row.id, secret };
}

export async function updateWebhook(actor: Actor, id: string, input: HookInput): Promise<Result> {
  const c = checkHook(input);
  if ("error" in c) return err(c.error);
  const [row] = await db.update(webhooks).set({ name: input.name.trim(), url: c.url, events: c.events, active: input.active, updatedAt: new Date() }).where(eq(webhooks.id, id)).returning();
  if (!row) return err("Der Webhook existiert nicht mehr.");
  await audit(actor, "webhook.updated", { entityType: "webhook", entityId: id, summary: `Webhook «${row.name}» geändert`, data: { url: row.url, events: row.events, active: row.active } });
  return { ok: true };
}

export async function setWebhookActive(actor: Actor, id: string, active: boolean): Promise<Result> {
  const [row] = await db.update(webhooks).set({ active, updatedAt: new Date() }).where(eq(webhooks.id, id)).returning();
  if (!row) return err("Der Webhook existiert nicht mehr.");
  await audit(actor, active ? "webhook.activated" : "webhook.paused", { entityType: "webhook", entityId: id, summary: `Webhook «${row.name}» ${active ? "aktiviert" : "pausiert"}` });
  return { ok: true };
}

export async function rotateWebhookSecret(actor: Actor, id: string): Promise<Result<{ secret: string }>> {
  const secret = newWebhookSecret();
  const [row] = await db.update(webhooks).set({ secret: encrypt(secret), updatedAt: new Date() }).where(eq(webhooks.id, id)).returning();
  if (!row) return err("Der Webhook existiert nicht mehr.");
  await audit(actor, "webhook.secret_rotated", { entityType: "webhook", entityId: id, summary: `Signatur-Geheimnis von «${row.name}» erneuert` });
  return { ok: true, secret };
}

export async function deleteWebhook(actor: Actor, id: string): Promise<Result> {
  const [row] = await db.delete(webhooks).where(eq(webhooks.id, id)).returning();
  if (!row) return err("Der Webhook existiert nicht mehr.");
  await audit(actor, "webhook.deleted", { entityType: "webhook", entityId: id, summary: `Webhook «${row.name}» gelöscht`, data: { url: row.url } });
  return { ok: true };
}

export async function testWebhook(actor: Actor, id: string): Promise<Result<{ status: string; code: number | null; ms: number | null; error: string | null }>> {
  const hook = await getWebhook(id);
  if (!hook) return err("Der Webhook existiert nicht mehr.");
  const d = await ping(id);
  await audit(actor, "webhook.tested", { entityType: "webhook", entityId: id, summary: `Test an «${hook.name}» gesendet (${d.responseCode ?? "keine Antwort"})` });
  return { ok: true, status: d.status, code: d.responseCode, ms: d.responseMs, error: d.error };
}

export async function redeliverDelivery(actor: Actor, deliveryId: string): Promise<Result> {
  const [d] = await db.select({ id: webhookDeliveries.id, event: webhookDeliveries.event, webhookId: webhookDeliveries.webhookId }).from(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId));
  if (!d) return err("Die Zustellung existiert nicht mehr.");
  await redeliver(deliveryId);
  await audit(actor, "webhook.redelivered", { entityType: "webhook", entityId: d.webhookId, summary: `Zustellung «${d.event}» erneut gesendet` });
  return { ok: true };
}

export async function listDeliveries(webhookId: string, page = 1, perPage = 25) {
  const [{ n }] = await db.select({ n: count() }).from(webhookDeliveries).where(eq(webhookDeliveries.webhookId, webhookId));
  const rows = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);
  return { rows, total: n };
}

/* ------------------------------------------------------ Google Analytics */

export type GaInput = { ga4MeasurementId: string; ga4PropertyId: string; serviceAccountEmail: string; serviceAccountKey: string };

/**
 * Validates the GA settings. The key may be pasted as the whole JSON file of
 * the service account (client_email is then taken from it) or as PEM.
 */
export function validateGa(input: GaInput): { value: GaInput } | { error: string; field: keyof GaInput } {
  const out = { ...input, ga4MeasurementId: input.ga4MeasurementId.trim().toUpperCase(), ga4PropertyId: input.ga4PropertyId.trim(), serviceAccountEmail: input.serviceAccountEmail.trim().toLowerCase() };
  let key = input.serviceAccountKey.trim();
  if (key.startsWith("{")) {
    try {
      const json = JSON.parse(key) as { private_key?: string; client_email?: string; type?: string };
      if (!json.private_key) return { error: "In der JSON-Datei fehlt «private_key». Laden Sie den Schlüssel des Dienstkontos erneut als JSON herunter.", field: "serviceAccountKey" };
      key = json.private_key.trim();
      if (json.client_email && !out.serviceAccountEmail) out.serviceAccountEmail = json.client_email.toLowerCase();
    } catch {
      return { error: "Der Schlüssel ist kein gültiges JSON. Fügen Sie den ganzen Inhalt der heruntergeladenen Datei ein.", field: "serviceAccountKey" };
    }
  }
  key = key.replace(/\\n/g, "\n");
  if (key && !/^-----BEGIN PRIVATE KEY-----\n[\s\S]+\n-----END PRIVATE KEY-----$/.test(key)) {
    return { error: "Der private Schlüssel muss mit «-----BEGIN PRIVATE KEY-----» beginnen. Fügen Sie am einfachsten die ganze JSON-Datei ein.", field: "serviceAccountKey" };
  }
  out.serviceAccountKey = key;
  if (out.ga4MeasurementId && !/^G-[A-Z0-9]{4,15}$/.test(out.ga4MeasurementId)) return { error: "Die Mess-ID hat das Format G-XXXXXXXXXX (Admin → Datenstreams).", field: "ga4MeasurementId" };
  if (out.ga4PropertyId && !/^\d{6,12}$/.test(out.ga4PropertyId)) return { error: "Die Property-ID besteht nur aus Ziffern, z. B. 412345678 (Admin → Property-Details).", field: "ga4PropertyId" };
  if (out.serviceAccountEmail && !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(out.serviceAccountEmail)) {
    return { error: "Die Dienstkonto-Adresse endet auf .iam.gserviceaccount.com.", field: "serviceAccountEmail" };
  }
  return { value: out };
}
