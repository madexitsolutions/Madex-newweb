/**
 * Payrexx (Swiss PSP: TWINT, PostFinance, cards …).
 *
 * REST API v1.0: https://api.payrexx.com/v1.0/<Resource>/<id>/?instance=<instance>
 * Every request carries ApiSignature = base64(HMAC-SHA256(apiSecret, query))
 * where `query` is PHP's http_build_query() of all other parameters.
 *
 * start():  creates a Gateway (amount in Rappen, CHF, referenceId = order
 *           number) and redirects to its link.
 * webhook:  /api/payments/payrexx/webhook. Payrexx webhooks are not signed,
 *           so the body only names the transaction – its status is always
 *           fetched from the API before anything is changed.
 * refund(): POST Transaction/<id>/refund/
 */
import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { orders, payments } from "@/server/db/schema";
import { getSettings } from "@/server/settings";
import { addOrderEvent, markOrderPaid, markOrderPaymentFailed, orderLabel, recordExternalRefund, type OrderRow } from "@/server/shop/order-core";
import type { PaymentProvider, PaymentsSettings } from "./types";

export const PAYREXX_API = "https://api.payrexx.com/v1.0";

/** PHP urlencode(): like encodeURIComponent, but also ! ' ( ) * ~ encoded and spaces as "+". */
export function phpUrlencode(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
}

type QueryValue = string | number | boolean | null | undefined | QueryValue[] | { [k: string]: QueryValue };

/**
 * PHP http_build_query($params) with the default RFC 1738 encoding:
 * nested arrays as key[sub][…], booleans as 1/0, null skipped, keys encoded.
 */
export function httpBuildQuery(params: Record<string, QueryValue>, prefix?: string): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === null || v === undefined) continue;
    if (typeof v === "object") {
      const nested = Array.isArray(v) ? Object.fromEntries(v.map((x, i) => [String(i), x])) : v;
      const s = httpBuildQuery(nested as Record<string, QueryValue>, key);
      if (s) parts.push(s);
      continue;
    }
    const str = typeof v === "boolean" ? (v ? "1" : "0") : String(v);
    parts.push(`${phpUrlencode(key)}=${phpUrlencode(str)}`);
  }
  return parts.join("&");
}

export function payrexxSignature(params: Record<string, QueryValue>, secret: string) {
  return createHmac("sha256", secret).update(httpBuildQuery(params)).digest("base64");
}

type PayrexxResponse<T> = { status: "success" | "error"; message?: string; data?: T[] };

export async function payrexxRequest<T = Record<string, unknown>>(s: Pick<PaymentsSettings, "payrexxInstance" | "payrexxApiSecret">, method: "GET" | "POST" | "DELETE", path: string, params: Record<string, QueryValue> = {}): Promise<T> {
  if (!s.payrexxInstance || !s.payrexxApiSecret) throw new Error("Payrexx ist nicht eingerichtet (Instanz oder API-Schlüssel fehlt).");
  const signature = payrexxSignature(params, s.payrexxApiSecret);
  const query = httpBuildQuery({ ...params, ApiSignature: signature });
  const base = `${PAYREXX_API}/${path.replace(/^\/|\/$/g, "")}/?instance=${encodeURIComponent(s.payrexxInstance)}`;
  const res = await fetch(method === "POST" ? base : `${base}&${query}`, {
    method,
    headers: method === "POST" ? { "content-type": "application/x-www-form-urlencoded", accept: "application/json" } : { accept: "application/json" },
    body: method === "POST" ? query : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  let json: PayrexxResponse<T>;
  try {
    json = (await res.json()) as PayrexxResponse<T>;
  } catch {
    throw new Error(`Payrexx antwortet nicht wie erwartet (HTTP ${res.status}).`);
  }
  if (!res.ok || json.status !== "success" || !json.data?.length) throw new Error(`Payrexx: ${json.message || `HTTP ${res.status}`}`);
  return json.data[0];
}

type Gateway = { id: number; hash?: string; link: string; status?: string };
export type PayrexxTransaction = {
  id: number;
  status: string;
  amount: number;
  referenceId?: string;
  invoice?: { paymentRequestId?: number; referenceId?: string; currency?: string };
  refundedAmount?: number;
  [k: string]: unknown;
};

async function start(order: OrderRow, _items: unknown, s: PaymentsSettings, urls: { success: string; cancel: string }) {
  const label = await orderLabel(order);
  const b = order.billingAddress;
  const gateway = await payrexxRequest<Gateway>(s, "POST", "Gateway", {
    amount: order.total,
    currency: order.currency,
    purpose: `Bestellung ${label}`,
    referenceId: label,
    successRedirectUrl: urls.success,
    failedRedirectUrl: urls.cancel,
    cancelRedirectUrl: urls.cancel,
    fields: {
      email: { value: order.email },
      forename: { value: b.firstName },
      surname: { value: b.lastName },
      company: b.company ? { value: b.company } : null,
      street: { value: b.street },
      postcode: { value: b.zip },
      place: { value: b.city },
      country: { value: b.country },
    },
  });
  await db.insert(payments).values({ orderId: order.id, provider: "payrexx", providerRef: String(gateway.id), kind: "charge", status: "pending", amount: order.total, currency: order.currency, raw: { link: gateway.link } });
  return { type: "redirect" as const, url: gateway.link, providerRef: String(gateway.id) };
}

/** Reads the transaction id from a webhook body (JSON or form-encoded). */
export function webhookTransactionId(body: string, contentType: string): number | null {
  try {
    if (contentType.includes("json")) {
      const j = JSON.parse(body) as { transaction?: { id?: number | string } };
      const id = Number(j.transaction?.id);
      return Number.isInteger(id) && id > 0 ? id : null;
    }
    const id = Number(new URLSearchParams(body).get("transaction[id]"));
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

async function findOrder(tx: PayrexxTransaction) {
  const gatewayId = tx.invoice?.paymentRequestId;
  if (gatewayId) {
    const [p] = await db
      .select({ orderId: payments.orderId })
      .from(payments)
      .where(and(eq(payments.provider, "payrexx"), eq(payments.providerRef, String(gatewayId))));
    if (p) return { orderId: p.orderId, gatewayId: String(gatewayId) };
  }
  const ref = tx.referenceId ?? tx.invoice?.referenceId;
  const num = Number(String(ref ?? "").replace(/\D/g, ""));
  if (num) {
    const [o] = await db.select({ id: orders.id }).from(orders).where(eq(orders.number, num));
    if (o) return { orderId: o.id, gatewayId: gatewayId ? String(gatewayId) : null };
  }
  return null;
}

/** Applies a transaction status fetched from the API (exported for tests). */
export async function processPayrexxTransaction(tx: PayrexxTransaction) {
  const found = await findOrder(tx);
  if (!found) return "ignored";
  const raw = { transactionId: tx.id, status: tx.status };
  switch (tx.status) {
    case "confirmed":
      await markOrderPaid(found.orderId, { provider: "payrexx", providerRef: found.gatewayId ?? String(tx.id), amount: tx.amount, paymentReference: String(tx.id), raw });
      return "paid";
    case "waiting":
    case "authorized":
    case "reserved":
      await addOrderEvent(found.orderId, "payment", `Payrexx: Zahlung ${tx.status === "waiting" ? "eingeleitet, Bestätigung ausstehend" : "autorisiert"}.`, { data: raw });
      return "pending";
    case "cancelled":
    case "declined":
    case "error":
    case "expired":
      await markOrderPaymentFailed(found.orderId, { provider: "payrexx", providerRef: found.gatewayId, reason: `Payrexx: Zahlungsversuch ${tx.status === "cancelled" ? "abgebrochen" : "abgelehnt"}.`, giveUp: tx.status === "expired", raw });
      return "failed";
    case "refunded":
    case "partially-refunded": {
      const [o] = await db.select({ total: orders.total }).from(orders).where(eq(orders.id, found.orderId));
      const refunded = tx.status === "refunded" ? (o?.total ?? 0) : typeof tx.refundedAmount === "number" ? tx.refundedAmount : null;
      if (refunded === null) {
        await addOrderEvent(found.orderId, "refund", "Payrexx meldet eine Teilrückerstattung. Bitte Betrag im Payrexx-Konto prüfen und hier erfassen.", { data: raw });
        return "refund-unknown";
      }
      await recordExternalRefund(found.orderId, { provider: "payrexx", providerRef: String(tx.id), refundedTotal: refunded, raw });
      return "refunded";
    }
    default:
      return "ignored";
  }
}

/** POST /api/payments/payrexx/webhook */
export async function handlePayrexxWebhook(req: Request): Promise<Response> {
  const s = await getSettings("payments");
  if (!s.payrexxEnabled || !s.payrexxApiSecret) return new Response("Payrexx ist nicht eingerichtet.", { status: 503 });
  const body = await req.text();
  const id = webhookTransactionId(body, req.headers.get("content-type") ?? "");
  if (!id) return new Response("Keine Transaktion.", { status: 400 });
  try {
    // never trust the (unsigned) body: fetch the transaction from the API
    const tx = await payrexxRequest<PayrexxTransaction>(s, "GET", `Transaction/${id}`);
    const result = await processPayrexxTransaction(tx);
    return Response.json({ received: true, result });
  } catch (e) {
    console.error("[payrexx] webhook", id, e);
    return new Response("Fehler bei der Verarbeitung.", { status: 500 });
  }
}

export const payrexxProvider: PaymentProvider = {
  key: "payrexx",
  label: "TWINT, PostFinance, Karte",
  description: "Online bezahlen über Payrexx mit TWINT, PostFinance oder Kreditkarte.",
  online: true,
  initial: { status: "pending", paymentStatus: "pending" },
  isAvailable: (s, ctx) => s.payrexxEnabled && Boolean(s.payrexxInstance && s.payrexxApiSecret) && ctx.total > 0,
  start,
  handleWebhook: handlePayrexxWebhook,
  async refund(order, amount, _reason, s) {
    if (!order.paymentReference || !/^\d+$/.test(order.paymentReference)) throw new Error("Zu dieser Bestellung ist keine Payrexx-Transaktion bekannt.");
    const res = await payrexxRequest<{ id?: number; status?: string }>(s, "POST", `Transaction/${order.paymentReference}/refund`, { amount });
    return { providerRef: res.id ? String(res.id) : order.paymentReference, status: res.status === "refunded" || res.status === "partially-refunded" ? "succeeded" : "pending" };
  },
};
