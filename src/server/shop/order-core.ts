/**
 * Low-level order building blocks shared by the checkout, the payment
 * providers (webhooks) and the order service: timeline events, customer
 * statistics, stock movements, coupon usage and the payment state changes.
 *
 * Nothing here checks permissions – callers (pages, actions, API routes,
 * webhooks) do that.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import { coupons, customers, orderEvents, orderItems, orders, payments, products, productVariants, refunds } from "@/server/db/schema";
import { emit } from "@/server/events";
import { notify } from "@/server/notifications";
import { getSettings } from "@/server/settings";
import { money } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/orders";
import { adjustStock } from "./inventory";

export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type Actor = { id: string; email: string; name?: string } | null;

export type OrderEventType = "created" | "status" | "payment" | "fulfilment" | "refund" | "cancel" | "note" | "email" | "update" | "stock";

export async function addOrderEvent(
  orderId: string,
  type: OrderEventType,
  message: string,
  opts: { internal?: boolean; userId?: string | null; data?: Record<string, unknown>; tx?: Tx } = {},
) {
  await (opts.tx ?? db).insert(orderEvents).values({ orderId, type, message, internal: opts.internal ?? true, userId: opts.userId ?? null, data: opts.data ?? {} });
}

/** "#1001" with the configured prefix. */
export async function orderLabel(order: Pick<OrderRow, "number">) {
  const { orderPrefix } = await getSettings("shop");
  return `${orderPrefix}${order.number}`;
}

export async function loadOrder(id: string, tx?: Tx, opts: { lock?: boolean } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const q = (tx ?? db).select().from(orders).where(eq(orders.id, id));
  const [o] = opts.lock && tx ? await q.for("update") : await q;
  return o ?? null;
}

export async function loadOrderItems(orderId: string, tx?: Tx) {
  return (tx ?? db).select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(orderItems.name);
}

/**
 * Recomputes ordersCount, totalSpent and lastOrderAt of a customer from the
 * orders (cancelled/failed orders don't count, totalSpent = paid minus refunds).
 */
export async function syncCustomerStats(customerId: string | null | undefined, tx?: Tx) {
  if (!customerId) return;
  const q = tx ?? db;
  const [s] = await q
    .select({
      count: sql<number>`count(*) filter (where ${orders.status} not in ('cancelled','failed'))::int`,
      spent: sql<number>`coalesce(sum(${orders.total} - ${orders.refundedTotal}) filter (where ${orders.paymentStatus} in ('paid','partially_refunded','refunded')), 0)::int`,
      last: sql<Date | null>`max(${orders.createdAt}) filter (where ${orders.status} not in ('cancelled','failed'))`,
    })
    .from(orders)
    .where(eq(orders.customerId, customerId));
  await q
    .update(customers)
    .set({ ordersCount: s?.count ?? 0, totalSpent: s?.spent ?? 0, lastOrderAt: s?.last ? new Date(s.last) : null, updatedAt: new Date() })
    .where(eq(customers.id, customerId));
}

/** Puts stock back for the given quantities (only variants that track inventory). */
export async function restock(lines: { variantId: string | null; quantity: number }[], reason: "cancel" | "refund" | "return", opts: { tx: Tx; reference: string; userId?: string | null }) {
  const ids = lines.map((l) => l.variantId).filter((x): x is string => Boolean(x));
  if (!ids.length) return;
  const tracked = await opts.tx.select({ id: productVariants.id, track: productVariants.trackInventory }).from(productVariants).where(inArray(productVariants.id, ids));
  for (const l of lines) {
    if (!l.variantId || l.quantity <= 0 || !tracked.find((t) => t.id === l.variantId)?.track) continue;
    await adjustStock(l.variantId, l.quantity, reason, { tx: opts.tx, reference: opts.reference, userId: opts.userId ?? undefined });
  }
}

/** Takes stock for order lines; returns the variant ids whose stock changed (for the low-stock check). */
export async function takeStock(lines: { variantId: string | null; quantity: number }[], opts: { tx: Tx; reference: string; userId?: string | null }) {
  const ids = lines.map((l) => l.variantId).filter((x): x is string => Boolean(x));
  if (!ids.length) return [] as string[];
  const tracked = await opts.tx.select({ id: productVariants.id, track: productVariants.trackInventory }).from(productVariants).where(inArray(productVariants.id, ids));
  const changed: string[] = [];
  for (const l of lines) {
    if (!l.variantId || l.quantity <= 0 || !tracked.find((t) => t.id === l.variantId)?.track) continue;
    await adjustStock(l.variantId, -l.quantity, "order", { tx: opts.tx, reference: opts.reference, userId: opts.userId ?? undefined });
    changed.push(l.variantId);
  }
  return changed;
}

/** Gives a coupon use back (cancelled or failed order). */
export async function releaseCoupon(code: string | null | undefined, tx: Tx) {
  if (!code) return;
  await tx
    .update(coupons)
    .set({ usedCount: sql`greatest(${coupons.usedCount} - 1, 0)`, updatedAt: new Date() })
    .where(sql`upper(${coupons.code}) = upper(${code})`);
}

/**
 * Low stock: emits `stock.low`, notifies staff and mails the addresses in
 * email.notifyLowStock for variants at or below the threshold.
 */
export async function checkLowStock(variantIds: string[]) {
  if (!variantIds.length) return;
  const { lowStockThreshold } = await getSettings("shop");
  const low = await db
    .select({ id: productVariants.id, stock: productVariants.stock, sku: productVariants.sku, title: productVariants.title, productId: products.id, name: products.name })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(inArray(productVariants.id, [...new Set(variantIds)]), eq(productVariants.trackInventory, true), sql`${productVariants.stock} <= ${lowStockThreshold}`));
  for (const v of low) {
    const name = v.title ? `${v.name} (${v.title})` : v.name;
    await emit("stock.low", { variantId: v.id, productId: v.productId, sku: v.sku, name, stock: v.stock, threshold: lowStockThreshold });
    await notify({
      type: "stock.low",
      title: v.stock <= 0 ? `Ausverkauft: ${name}` : `Lagerbestand niedrig: ${name}`,
      body: `Noch ${v.stock} Stück${v.sku ? ` · SKU ${v.sku}` : ""}`,
      href: `/madexadm/produkte/${v.productId}`,
      permission: "products.manage",
    });
  }
  if (low.length) {
    const { sendLowStockEmail } = await import("@/server/mail/templates/orders");
    await sendLowStockEmail(low.map((v) => ({ name: v.title ? `${v.name} (${v.title})` : v.name, sku: v.sku, stock: v.stock }))).catch(() => {});
  }
}

/** Status after a payment arrived: completed when everything is shipped, otherwise processing. */
export function statusAfterPayment(o: Pick<OrderRow, "fulfillmentStatus">): OrderRow["status"] {
  return o.fulfillmentStatus === "fulfilled" ? "completed" : "processing";
}

/**
 * Marks an order as paid (provider webhook or staff). Idempotent: a second
 * call for an already paid order only records a new payment row when the
 * provider reference is new.
 */
export async function markOrderPaid(
  orderId: string,
  input: { provider: string; providerRef?: string | null; amount?: number; raw?: Record<string, unknown>; actor?: Actor; note?: string; paymentReference?: string | null },
): Promise<{ order: OrderRow; changed: boolean }> {
  const result = await db.transaction(async (tx) => {
    const o = await loadOrder(orderId, tx, { lock: true });
    if (!o) throw new Error("Bestellung nicht gefunden");
    const amount = input.amount ?? o.total - o.refundedTotal;
    // payment row (pending row of the provider → succeeded)
    const [existing] = input.providerRef
      ? await tx
          .select()
          .from(payments)
          .where(and(eq(payments.orderId, o.id), eq(payments.provider, input.provider), eq(payments.providerRef, input.providerRef)))
      : [];
    if (existing?.status === "succeeded" && ["paid", "partially_refunded", "refunded"].includes(o.paymentStatus)) return { order: o, changed: false, revived: false };
    if (existing) await tx.update(payments).set({ status: "succeeded", amount, raw: input.raw ?? existing.raw, updatedAt: new Date() }).where(eq(payments.id, existing.id));
    else await tx.insert(payments).values({ orderId: o.id, provider: input.provider, providerRef: input.providerRef ?? null, kind: "charge", status: "succeeded", amount, currency: o.currency, raw: input.raw ?? {} });
    if (["paid", "partially_refunded", "refunded"].includes(o.paymentStatus)) {
      await addOrderEvent(o.id, "payment", `Weitere Zahlung über ${money(amount)} erfasst (${paymentMethodLabel(input.provider)}).`, { tx, userId: input.actor?.id, data: { provider: input.provider, providerRef: input.providerRef, amount } });
      return { order: o, changed: false, revived: false };
    }
    // order was given up (payment expired/cancelled) – take the stock again
    const revived = o.status === "failed" || o.status === "cancelled";
    if (revived) {
      const items = await loadOrderItems(o.id, tx);
      await takeStock(
        items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        { tx, reference: `#${o.number}`, userId: input.actor?.id },
      );
      if (o.couponCode) await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(sql`upper(${coupons.code}) = upper(${o.couponCode})`);
    }
    const [updated] = await tx
      .update(orders)
      .set({
        paymentStatus: "paid",
        status: statusAfterPayment(o),
        paidAt: new Date(),
        cancelledAt: null,
        paymentReference: input.paymentReference ?? o.paymentReference,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, o.id))
      .returning();
    const who = input.actor ? ` von ${input.actor.name || input.actor.email}` : "";
    await addOrderEvent(
      o.id,
      "payment",
      input.actor ? `Als bezahlt markiert${who} (${money(amount)}).${input.note ? ` ${input.note}` : ""}` : `Zahlung über ${money(amount)} erhalten (${paymentMethodLabel(input.provider)}).`,
      { tx, userId: input.actor?.id, data: { provider: input.provider, providerRef: input.providerRef, amount } },
    );
    if (revived) await addOrderEvent(o.id, "stock", "Die Bestellung war bereits abgebrochen. Lagerbestand wurde erneut abgebucht – bitte Verfügbarkeit prüfen.", { tx });
    return { order: updated, changed: true, revived };
  });
  if (result.changed) {
    await syncCustomerStats(result.order.customerId);
    await emit("order.paid", { id: result.order.id, number: result.order.number, total: result.order.total, paymentMethod: result.order.paymentMethod, provider: input.provider });
    const { announceOrder } = await import("./order-notify");
    await announceOrder(result.order.id).catch(() => {});
  }
  return { order: result.order, changed: result.changed };
}

/**
 * A payment attempt failed or the payment session expired. With `giveUp` the
 * order becomes "failed": stock is put back and the coupon use released.
 */
export async function markOrderPaymentFailed(orderId: string, input: { provider: string; providerRef?: string | null; reason: string; raw?: Record<string, unknown>; giveUp: boolean }) {
  return db.transaction(async (tx) => {
    const o = await loadOrder(orderId, tx, { lock: true });
    if (!o) return null;
    if (input.providerRef) {
      await tx
        .update(payments)
        .set({ status: input.giveUp ? "cancelled" : "failed", raw: input.raw ?? {}, updatedAt: new Date() })
        .where(and(eq(payments.orderId, o.id), eq(payments.provider, input.provider), eq(payments.providerRef, input.providerRef), eq(payments.status, "pending")));
    }
    // never undo a successful payment, and only give up orders still waiting for it
    if (["paid", "partially_refunded", "refunded"].includes(o.paymentStatus) || o.status !== "pending") {
      await addOrderEvent(o.id, "payment", input.reason, { tx, data: { provider: input.provider, providerRef: input.providerRef } });
      return o;
    }
    if (!input.giveUp) {
      await addOrderEvent(o.id, "payment", input.reason, { tx, data: { provider: input.provider, providerRef: input.providerRef } });
      return o;
    }
    const items = await loadOrderItems(o.id, tx);
    await restock(
      items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      "cancel",
      { tx, reference: `#${o.number}` },
    );
    await releaseCoupon(o.couponCode, tx);
    const [updated] = await tx.update(orders).set({ status: "failed", paymentStatus: "failed", cancelledAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, o.id)).returning();
    await addOrderEvent(o.id, "status", `${input.reason} Bestellung als fehlgeschlagen markiert, Lager zurückgebucht.`, { tx, data: { provider: input.provider } });
    await syncCustomerStats(o.customerId, tx);
    return updated;
  });
}

/**
 * Refund made outside the dashboard (e.g. in the Stripe or Payrexx backend),
 * reported by a webhook. Only the part not yet recorded is added.
 */
export async function recordExternalRefund(orderId: string, input: { provider: string; providerRef?: string | null; refundedTotal: number; raw?: Record<string, unknown> }) {
  const res = await db.transaction(async (tx) => {
    const o = await loadOrder(orderId, tx, { lock: true });
    if (!o) return null;
    const delta = Math.min(input.refundedTotal, o.total) - o.refundedTotal;
    if (delta <= 0) return null;
    await tx.insert(payments).values({ orderId: o.id, provider: input.provider, providerRef: input.providerRef ?? null, kind: "refund", status: "succeeded", amount: delta, currency: o.currency, raw: input.raw ?? {} });
    await tx.insert(refunds).values({ orderId: o.id, amount: delta, reason: `Beim Zahlungsanbieter erstattet (${paymentMethodLabel(input.provider)})`, restock: false, providerRef: input.providerRef ?? null });
    const refundedTotal = o.refundedTotal + delta;
    const full = refundedTotal >= o.total;
    const [updated] = await tx
      .update(orders)
      .set({ refundedTotal, paymentStatus: full ? "refunded" : "partially_refunded", status: full ? "refunded" : o.status, updatedAt: new Date() })
      .where(eq(orders.id, o.id))
      .returning();
    await addOrderEvent(o.id, "refund", `${money(delta)} beim Zahlungsanbieter rückerstattet${full ? " (vollständig)" : ""}. Lager wurde nicht verändert.`, { tx, data: { provider: input.provider, amount: delta } });
    return { order: updated, amount: delta };
  });
  if (res) {
    await syncCustomerStats(res.order.customerId);
    await emit("order.refunded", { id: res.order.id, number: res.order.number, amount: res.amount, refundedTotal: res.order.refundedTotal, source: input.provider });
  }
  return res;
}

/** Staff notification for a new order. */
export async function notifyStaffNewOrder(o: OrderRow) {
  const label = await orderLabel(o);
  const name = [o.billingAddress.firstName, o.billingAddress.lastName].filter(Boolean).join(" ") || o.email;
  await notify({ type: "order.created", title: `Neue Bestellung ${label}`, body: `${name} · ${money(o.total)} · ${paymentMethodLabel(o.paymentMethod)}`, href: `/madexadm/bestellungen/${o.id}`, permission: "orders.view" });
}
