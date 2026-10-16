/**
 * Domain events → outgoing webhooks for connected systems (client webapps, ERP,
 * Zapier/Make …). Deliveries are signed with HMAC-SHA256 and retried with
 * backoff (1 min, 5 min, 30 min, 2 h, 12 h).
 *
 * Signature header: X-Webhook-Signature: t=<unix seconds>,v1=<hex hmac of "<t>.<body>">
 */
import { createHmac, randomUUID } from "node:crypto";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { webhookDeliveries, webhooks } from "@/server/db/schema";
import { decrypt } from "@/server/lib/crypto";

export const EVENTS = {
  "order.created": "Bestellung eingegangen",
  "order.paid": "Bestellung bezahlt",
  "order.updated": "Bestellung geändert",
  "order.fulfilled": "Bestellung versendet",
  "order.cancelled": "Bestellung storniert",
  "order.refunded": "Bestellung rückerstattet",
  "product.created": "Produkt erstellt",
  "product.updated": "Produkt geändert",
  "product.deleted": "Produkt gelöscht",
  "stock.low": "Lagerbestand niedrig",
  "customer.created": "Kunde registriert",
  "inquiry.created": "Anfrage eingegangen",
  "post.published": "Beitrag veröffentlicht",
} as const;

export type EventName = keyof typeof EVENTS;

const BACKOFF_MIN = [1, 5, 30, 120, 720];

export function sign(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

async function deliver(deliveryId: string) {
  const [d] = await db.select({ d: webhookDeliveries, w: webhooks }).from(webhookDeliveries).innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id)).where(eq(webhookDeliveries.id, deliveryId));
  if (!d) return;
  const body = JSON.stringify({ id: d.d.id, event: d.d.event, createdAt: d.d.createdAt.toISOString(), data: d.d.payload });
  const started = Date.now();
  let code: number | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(d.w.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Predashboard-Webhooks/1.0",
        "x-webhook-event": d.d.event,
        "x-webhook-delivery": d.d.id,
        "x-webhook-signature": sign(decrypt(d.w.secret), body),
      },
      body,
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
    code = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const ms = Date.now() - started;
  if (!error) {
    await db.update(webhookDeliveries).set({ status: "success", responseCode: code, responseMs: ms, error: null, nextRetryAt: null }).where(eq(webhookDeliveries.id, deliveryId));
    return;
  }
  const wait = BACKOFF_MIN[d.d.attempt - 1];
  await db
    .update(webhookDeliveries)
    .set({
      status: wait ? "pending" : "failed",
      responseCode: code,
      responseMs: ms,
      error: error.slice(0, 500),
      attempt: d.d.attempt + (wait ? 1 : 0),
      nextRetryAt: wait ? new Date(Date.now() + wait * 60_000) : null,
    })
    .where(eq(webhookDeliveries.id, deliveryId));
}

/** Emits an event: one delivery per subscribed, active webhook (sent in the background). */
export async function emit(event: EventName, data: Record<string, unknown>) {
  const hooks = await db.select().from(webhooks).where(eq(webhooks.active, true));
  const targets = hooks.filter((h) => h.events.includes(event) || h.events.includes("*"));
  if (!targets.length) return;
  const rows = await db
    .insert(webhookDeliveries)
    .values(targets.map((h) => ({ id: randomUUID(), webhookId: h.id, event, payload: data })))
    .returning({ id: webhookDeliveries.id });
  // don't block the request that caused the event
  for (const r of rows) void deliver(r.id).catch(() => {});
  void retryDue().catch(() => {});
}

/** Sends deliveries whose retry time has come (also called by /api/cron). */
export async function retryDue(limit = 20) {
  const due = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.status, "pending"), lte(webhookDeliveries.nextRetryAt, new Date())))
    .limit(limit);
  for (const d of due) await deliver(d.id);
  return due.length;
}

/** Manual resend from the dashboard. */
export async function redeliver(deliveryId: string) {
  await db.update(webhookDeliveries).set({ status: "pending", attempt: 1, nextRetryAt: null }).where(eq(webhookDeliveries.id, deliveryId));
  await deliver(deliveryId);
}

/** Test ping for a webhook. */
export async function ping(webhookId: string) {
  const [d] = await db.insert(webhookDeliveries).values({ webhookId, event: "ping", payload: { message: "Testereignis vom Dashboard" } }).returning({ id: webhookDeliveries.id });
  await deliver(d.id);
  const [res] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, d.id));
  return res;
}
