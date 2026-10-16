/**
 * Stripe Checkout (cards, TWINT, Apple/Google Pay … – whatever is enabled in
 * the Stripe account's payment method settings).
 *
 * start():   creates a Checkout Session (CHF), redirects the customer to it.
 * webhook:   /api/payments/stripe/webhook, signature checked with
 *            payments.stripeWebhookSecret. Subscribe in Stripe to
 *            checkout.session.completed, checkout.session.async_payment_succeeded,
 *            checkout.session.async_payment_failed, checkout.session.expired
 *            and charge.refunded.
 * refund():  stripe.refunds.create on the PaymentIntent.
 */
import Stripe from "stripe";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { orders, payments } from "@/server/db/schema";
import { getSettings } from "@/server/settings";
import { addOrderEvent, markOrderPaid, markOrderPaymentFailed, orderLabel, recordExternalRefund, type OrderItemRow, type OrderRow } from "@/server/shop/order-core";
import type { PaymentProvider, PaymentsSettings, ReturnUrls } from "./types";

type StripeClient = InstanceType<typeof Stripe>;

let factory: (secretKey: string) => StripeClient = (key) => new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 });

/** Tests: replace the client (e.g. with a stub for checkout.sessions.create / refunds.create). */
export function setStripeFactory(f: (secretKey: string) => StripeClient) {
  factory = f;
}

export function stripeClient(s: Pick<PaymentsSettings, "stripeSecretKey">) {
  if (!s.stripeSecretKey) throw new Error("Stripe ist nicht eingerichtet (geheimer Schlüssel fehlt).");
  return factory(s.stripeSecretKey);
}

/** Line items when they add up exactly to the total (prices incl. VAT, no discount); otherwise one total line. */
export function stripeLineItems(order: OrderRow, items: OrderItemRow[], label: string) {
  const sum = items.reduce((a, i) => a + i.unitPrice * i.quantity, 0) + order.shippingTotal;
  const itemized = order.pricesIncludeTax && order.discountTotal === 0 && sum === order.total && items.every((i) => i.unitPrice > 0);
  if (!itemized) return [{ quantity: 1, price_data: { currency: "chf", unit_amount: order.total, product_data: { name: `Bestellung ${label}` } } }];
  const lines = items.map((i) => ({ quantity: i.quantity, price_data: { currency: "chf", unit_amount: i.unitPrice, product_data: { name: i.variantTitle ? `${i.name} – ${i.variantTitle}` : i.name } } }));
  if (order.shippingTotal > 0) lines.push({ quantity: 1, price_data: { currency: "chf", unit_amount: order.shippingTotal, product_data: { name: `Versand: ${order.shippingMethodName || "Versand"}` } } });
  return lines;
}

async function start(order: OrderRow, items: OrderItemRow[], s: PaymentsSettings, urls: ReturnUrls) {
  const stripe = stripeClient(s);
  const label = await orderLabel(order);
  const [{ n }] = await db
    .select({ n: count() })
    .from(payments)
    .where(and(eq(payments.orderId, order.id), eq(payments.provider, "stripe")));
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: stripeLineItems(order, items, label),
      customer_email: order.email,
      client_reference_id: order.id,
      locale: "de",
      success_url: urls.success,
      cancel_url: urls.cancel,
      metadata: { orderId: order.id, orderNumber: label },
      payment_intent_data: { description: `Bestellung ${label}`, metadata: { orderId: order.id, orderNumber: label } },
    },
    { idempotencyKey: `pd-order-${order.id}-${n}` },
  );
  await db.insert(payments).values({ orderId: order.id, provider: "stripe", providerRef: session.id, kind: "charge", status: "pending", amount: order.total, currency: order.currency, raw: { url: session.url } });
  if (!session.url) throw new Error("Stripe hat keine Zahlungsseite geliefert.");
  return { type: "redirect" as const, url: session.url, providerRef: session.id };
}

const piId = (pi: string | { id: string } | null | undefined) => (typeof pi === "string" ? pi : (pi?.id ?? null));

/** Handles one verified Stripe event (exported for tests). */
export async function processStripeEvent(event: { type: string; data: { object: unknown } }) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId ?? session.client_reference_id;
      if (!orderId) return "ignored";
      if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
        await markOrderPaid(orderId, {
          provider: "stripe",
          providerRef: session.id,
          amount: session.amount_total ?? undefined,
          paymentReference: piId(session.payment_intent),
          raw: { sessionId: session.id, paymentIntent: piId(session.payment_intent), eventType: event.type },
        });
        return "paid";
      }
      await db.update(orders).set({ paymentStatus: "pending", paymentReference: piId(session.payment_intent), updatedAt: new Date() }).where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "unpaid")));
      await addOrderEvent(orderId, "payment", "Zahlung bei Stripe eingeleitet, Bestätigung der Bank ausstehend.", { data: { sessionId: session.id } });
      return "pending";
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId ?? session.client_reference_id;
      if (!orderId) return "ignored";
      const reason = event.type === "checkout.session.expired" ? "Die Stripe-Zahlungssitzung ist abgelaufen, ohne dass bezahlt wurde." : "Die Zahlung über Stripe ist fehlgeschlagen.";
      await markOrderPaymentFailed(orderId, { provider: "stripe", providerRef: session.id, reason, giveUp: true, raw: { eventType: event.type } });
      return "failed";
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const pi = piId(charge.payment_intent);
      if (!pi) return "ignored";
      const [o] = await db.select({ id: orders.id }).from(orders).where(eq(orders.paymentReference, pi));
      if (!o) return "ignored";
      await recordExternalRefund(o.id, { provider: "stripe", providerRef: charge.id, refundedTotal: charge.amount_refunded, raw: { chargeId: charge.id } });
      return "refunded";
    }
    default:
      return "ignored";
  }
}

/** POST /api/payments/stripe/webhook */
export async function handleStripeWebhook(req: Request): Promise<Response> {
  const s = await getSettings("payments");
  if (!s.stripeWebhookSecret) return new Response("Stripe-Webhook ist nicht eingerichtet.", { status: 503 });
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!sig) return new Response("Signatur fehlt.", { status: 400 });
  let event: Stripe.Event;
  try {
    // the client is only used for verification; no API key needed
    event = factory(s.stripeSecretKey || "sk_unused").webhooks.constructEvent(body, sig, s.stripeWebhookSecret);
  } catch {
    return new Response("Ungültige Signatur.", { status: 400 });
  }
  try {
    const result = await processStripeEvent(event);
    return Response.json({ received: true, result });
  } catch (e) {
    console.error("[stripe] webhook", event.type, e);
    // 500 → Stripe retries later; handlers are idempotent
    return new Response("Fehler bei der Verarbeitung.", { status: 500 });
  }
}

export const stripeProvider: PaymentProvider = {
  key: "stripe",
  label: "Karte / TWINT",
  description: "Sicher online bezahlen mit Kreditkarte, TWINT, Apple Pay oder Google Pay.",
  online: true,
  initial: { status: "pending", paymentStatus: "pending" },
  isAvailable: (s, ctx) => s.stripeEnabled && Boolean(s.stripeSecretKey) && ctx.total >= 50,
  start,
  handleWebhook: handleStripeWebhook,
  async refund(order, amount, reason, s) {
    if (!order.paymentReference?.startsWith("pi_")) throw new Error("Zu dieser Bestellung ist keine Stripe-Zahlung bekannt.");
    const refund = await stripeClient(s).refunds.create(
      { payment_intent: order.paymentReference, amount, reason: "requested_by_customer", metadata: { orderId: order.id, note: reason.slice(0, 400) } },
      { idempotencyKey: `pd-refund-${order.id}-${order.refundedTotal}-${amount}` },
    );
    return { providerRef: refund.id, status: refund.status === "succeeded" ? "succeeded" : "pending" };
  },
};
