/**
 * Order service for the dashboard, the public API and the storefront.
 *
 * Status rules
 *   pending     waiting for an online payment (Stripe/Payrexx)
 *   on_hold     waiting for an offline payment (prepayment, invoice)
 *   processing  paid or released → to be shipped
 *   completed   paid and fully shipped
 *   cancelled   cancelled before payment (stock back, coupon released)
 *   refunded    fully refunded
 *   failed      online payment given up / expired (stock back)
 *
 * Every mutating function takes the acting staff member (`actor`, null for
 * the system/API), writes the order timeline and the audit log, emits the
 * order.* event and keeps the customer statistics in sync. Permissions are
 * checked by the caller.
 */
import { and, asc, desc, eq, gte, ilike, inArray, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { customers, orderEvents, orderItems, orders, payments, productVariants, refunds, users, type Address } from "@/server/db/schema";
import { audit } from "@/server/audit";
import { emit } from "@/server/events";
import { getSettings } from "@/server/settings";
import { getProvider } from "@/server/payments";
import { money } from "@/lib/format";
import { CARRIERS, PAYMENT_STATUS, ORDER_STATUS, FULFILLMENT_STATUS, paymentMethodLabel, trackingUrl as carrierTrackingUrl, type CarrierKey } from "@/lib/orders";
import { adjustStock } from "./inventory";
import { ShopError } from "./errors";
import { addOrderEvent, loadOrder, loadOrderItems, markOrderPaid, markOrderPaymentFailed, orderLabel, releaseCoupon, restock, syncCustomerStats, type Actor, type OrderItemRow, type OrderRow } from "./order-core";
import { distribute, type TaxLine } from "./pricing";
import { taxFromGross, taxOnNet } from "./tax";

export { markOrderPaid } from "./order-core";

/* ================================================================ list */

export const ORDER_TABS = [
  { key: "offen", label: "Zu erledigen" },
  { key: "unbezahlt", label: "Unbezahlt" },
  { key: "abgeschlossen", label: "Abgeschlossen" },
  { key: "storniert", label: "Storniert/Rückerstattet" },
  { key: "alle", label: "Alle" },
] as const;

export type OrderTab = (typeof ORDER_TABS)[number]["key"];
export const isOrderTab = (t: string): t is OrderTab => ORDER_TABS.some((x) => x.key === t);

export type OrderSort = "datum" | "nummer" | "betrag" | "kunde";

export type OrderFilter = {
  tab?: OrderTab;
  /** order number, e-mail or name */
  q?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  /** YYYY-MM-DD (Swiss time), inclusive */
  from?: string;
  to?: string;
  customerId?: string;
  sort?: OrderSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function tabCondition(tab: OrderTab): SQL | undefined {
  switch (tab) {
    case "offen":
      return inArray(orders.status, ["processing", "on_hold"]);
    case "unbezahlt":
      return and(inArray(orders.paymentStatus, ["unpaid", "pending", "authorized"]), inArray(orders.status, ["pending", "processing", "on_hold", "completed"]));
    case "abgeschlossen":
      return eq(orders.status, "completed");
    case "storniert":
      return inArray(orders.status, ["cancelled", "refunded", "failed"]);
    default:
      return undefined;
  }
}

async function baseConditions(f: OrderFilter): Promise<SQL[]> {
  const conds: SQL[] = [];
  const q = f.q?.trim();
  if (q) {
    const { orderPrefix } = await getSettings("shop");
    const numeric = (orderPrefix && q.toUpperCase().startsWith(orderPrefix.toUpperCase()) ? q.slice(orderPrefix.length) : q).replace(/^#/, "");
    const like = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    const parts: SQL[] = [ilike(orders.email, like), sql`(${orders.billingAddress}->>'firstName') || ' ' || (${orders.billingAddress}->>'lastName') ilike ${like}`, sql`${orders.billingAddress}->>'company' ilike ${like}`];
    if (/^\d{1,9}$/.test(numeric)) parts.push(eq(orders.number, Number(numeric)));
    conds.push(or(...parts)!);
  }
  if (f.paymentStatus && f.paymentStatus in PAYMENT_STATUS) conds.push(eq(orders.paymentStatus, f.paymentStatus as OrderRow["paymentStatus"]));
  if (f.paymentMethod) conds.push(eq(orders.paymentMethod, f.paymentMethod));
  if (f.from && ISO_DAY.test(f.from)) conds.push(gte(orders.createdAt, sql`(${f.from}::date)::timestamp at time zone 'Europe/Zurich'`));
  if (f.to && ISO_DAY.test(f.to)) conds.push(lt(orders.createdAt, sql`((${f.to}::date) + 1)::timestamp at time zone 'Europe/Zurich'`));
  if (f.customerId) conds.push(eq(orders.customerId, f.customerId));
  return conds;
}

export type OrderListRow = {
  id: string;
  number: number;
  label: string;
  createdAt: Date;
  email: string;
  name: string;
  company: string;
  status: OrderRow["status"];
  paymentStatus: OrderRow["paymentStatus"];
  fulfillmentStatus: OrderRow["fulfillmentStatus"];
  paymentMethod: string;
  total: number;
  refundedTotal: number;
  itemCount: number;
  shippingMethodName: string;
};

export async function listOrders(f: OrderFilter = {}) {
  const pageSize = Math.min(Math.max(f.pageSize ?? 25, 1), 500);
  const conds = await baseConditions(f);
  const t = tabCondition(f.tab ?? "alle");
  if (t) conds.push(t);
  const where = conds.length ? and(...conds) : undefined;
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(orders)
    .where(where);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(f.page ?? 1, 1), pages);
  const dir = f.dir === "asc" ? asc : desc;
  const sortCol = f.sort === "nummer" ? orders.number : f.sort === "betrag" ? orders.total : f.sort === "kunde" ? sql`lower(${orders.billingAddress}->>'lastName')` : orders.createdAt;
  const { orderPrefix } = await getSettings("shop");
  const rows = await db
    .select({
      o: orders,
      // qualified by hand: inside select fields drizzle leaves columns unqualified
      itemCount: sql<number>`(select coalesce(sum(oi.quantity),0)::int from ${orderItems} oi where oi.order_id = "orders"."id")`,
    })
    .from(orders)
    .where(where)
    .orderBy(dir(sortCol), desc(orders.number))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return {
    rows: rows.map(({ o, itemCount }): OrderListRow => ({
      id: o.id,
      number: o.number,
      label: `${orderPrefix}${o.number}`,
      createdAt: o.createdAt,
      email: o.email,
      name: [o.billingAddress.firstName, o.billingAddress.lastName].filter(Boolean).join(" "),
      company: o.billingAddress.company ?? "",
      status: o.status,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      paymentMethod: o.paymentMethod,
      total: o.total,
      refundedTotal: o.refundedTotal,
      itemCount,
      shippingMethodName: o.shippingMethodName,
    })),
    total,
    page,
    pages,
    pageSize,
    from: total ? (page - 1) * pageSize + 1 : 0,
    to: Math.min(page * pageSize, total),
  };
}

/** Count per tab for the current search/filters. */
export async function orderTabCounts(f: Omit<OrderFilter, "tab"> = {}): Promise<Record<OrderTab, number>> {
  const conds = await baseConditions(f);
  const where = conds.length ? and(...conds) : undefined;
  const [r] = await db
    .select({
      offen: sql<number>`count(*) filter (where ${tabCondition("offen")})::int`,
      unbezahlt: sql<number>`count(*) filter (where ${tabCondition("unbezahlt")})::int`,
      abgeschlossen: sql<number>`count(*) filter (where ${tabCondition("abgeschlossen")})::int`,
      storniert: sql<number>`count(*) filter (where ${tabCondition("storniert")})::int`,
      alle: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(where);
  return r;
}

/** Payment methods that occur in orders (for the filter). */
export async function usedPaymentMethods() {
  const rows = await db.selectDistinct({ m: orders.paymentMethod }).from(orders);
  return rows.map((r) => r.m).filter(Boolean);
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvAmount = (c: number) => (c / 100).toFixed(2);

/** CSV export (semicolon separated, UTF-8 with BOM – opens directly in Excel CH). */
export async function exportOrdersCsv(f: OrderFilter = {}) {
  const res = await listOrders({ ...f, page: 1, pageSize: 500 });
  let rows = res.rows;
  for (let p = 2; p <= res.pages && p <= 40; p++) rows = rows.concat((await listOrders({ ...f, page: p, pageSize: 500 })).rows);
  const ids = rows.map((r) => r.id);
  const details = ids.length ? await db.select().from(orders).where(inArray(orders.id, ids)) : [];
  const byId = new Map(details.map((d) => [d.id, d]));
  const head = ["Nummer", "Datum", "Status", "Zahlung", "Versand", "Vorname", "Nachname", "Firma", "E-Mail", "Telefon", "PLZ", "Ort", "Land", "Zahlungsart", "Versandart", "Artikel", "Zwischensumme", "Rabatt", "Gutschein", "Versandkosten", "MWST", "Total", "Rückerstattet", "Währung"];
  const lines = [head.join(";")];
  for (const r of rows) {
    const o = byId.get(r.id)!;
    const b = o.billingAddress;
    lines.push(
      [
        r.label,
        o.createdAt.toLocaleString("de-CH", { timeZone: "Europe/Zurich" }),
        ORDER_STATUS[o.status].label,
        PAYMENT_STATUS[o.paymentStatus].label,
        FULFILLMENT_STATUS[o.fulfillmentStatus].label,
        b.firstName,
        b.lastName,
        b.company ?? "",
        o.email,
        o.phone,
        b.zip,
        b.city,
        b.country,
        paymentMethodLabel(o.paymentMethod),
        o.shippingMethodName,
        r.itemCount,
        csvAmount(o.subtotal),
        csvAmount(o.discountTotal),
        o.couponCode ?? "",
        csvAmount(o.shippingTotal),
        csvAmount(o.taxTotal),
        csvAmount(o.total),
        csvAmount(o.refundedTotal),
        o.currency,
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/* ============================================================== detail */

/**
 * VAT per rate of an order (incl. shipping). Uses the summary stored at
 * checkout; for older/manual orders it is recomputed from the items.
 */
export function orderTaxes(o: OrderRow, items: OrderItemRow[], stored?: unknown): TaxLine[] {
  if (Array.isArray(stored) && stored.every((t) => typeof t?.rateBp === "number") && o.refundedTotal === 0) return stored as TaxLine[];
  const per = new Map<number, number>();
  for (const i of items) per.set(i.taxRateBp, (per.get(i.taxRateBp) ?? 0) + i.total);
  const rates = [...per.keys()];
  if (o.shippingTotal > 0) {
    const shares = distribute(
      o.shippingTotal,
      rates.map((r) => per.get(r) ?? 0),
    );
    rates.forEach((r, k) => per.set(r, (per.get(r) ?? 0) + shares[k]));
    if (!rates.length) per.set(810, o.shippingTotal);
  }
  return [...per.entries()]
    .map(([rateBp, base]) => {
      const tax = o.pricesIncludeTax ? taxFromGross(base, rateBp) : taxOnNet(base, rateBp);
      return { rateBp, tax, net: o.pricesIncludeTax ? base - tax : base, gross: o.pricesIncludeTax ? base : base + tax };
    })
    .filter((t) => t.gross !== 0)
    .sort((a, b) => b.rateBp - a.rateBp);
}

export async function getOrderDetail(id: string) {
  const o = await loadOrder(id);
  if (!o) return null;
  const [items, events, pays, refs, customer, label] = await Promise.all([
    loadOrderItems(o.id),
    db
      .select({ e: orderEvents, userName: users.name })
      .from(orderEvents)
      .leftJoin(users, eq(orderEvents.userId, users.id))
      .where(eq(orderEvents.orderId, o.id))
      .orderBy(desc(orderEvents.createdAt), desc(orderEvents.id)),
    db.select().from(payments).where(eq(payments.orderId, o.id)).orderBy(asc(payments.createdAt)),
    db.select().from(refunds).where(eq(refunds.orderId, o.id)).orderBy(asc(refunds.createdAt)),
    o.customerId ? db.select().from(customers).where(eq(customers.id, o.customerId)).then((r) => r[0] ?? null) : Promise.resolve(null),
    orderLabel(o),
  ]);
  const created = events.find((e) => e.e.type === "created");
  const provider = getProvider(o.paymentMethod);
  const paid = ["paid", "partially_refunded"].includes(o.paymentStatus);
  return {
    order: o,
    label,
    items,
    events: events.map((e) => ({ ...e.e, userName: e.userName })),
    payments: pays,
    refunds: refs,
    customer,
    taxes: orderTaxes(o, items, created?.e.data.taxes),
    provider: provider ? { key: provider.key, label: provider.label, online: provider.online, canRefund: Boolean(provider.refund && o.paymentReference && paid) } : null,
    can: {
      markPaid: !paid && !["refunded", "cancelled"].includes(o.status) && o.paymentStatus !== "refunded",
      fulfil: !["cancelled", "refunded", "failed", "pending"].includes(o.status) && items.some((i) => i.quantity - i.refundedQuantity > i.fulfilledQuantity),
      refund: paid && o.total - o.refundedTotal > 0,
      cancel: ["pending", "processing", "on_hold", "failed"].includes(o.status) && !paid,
    },
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

/** Customer view of an order (thank-you page, guest lookup) – only with the access token. */
export async function getOrderByToken(id: string, token: string) {
  const { orderForToken } = await import("./checkout");
  const o = await orderForToken(id, token);
  if (!o) return null;
  const items = await loadOrderItems(o.id);
  const [visible, label, instructions] = await Promise.all([
    db
      .select({ type: orderEvents.type, message: orderEvents.message, createdAt: orderEvents.createdAt })
      .from(orderEvents)
      .where(and(eq(orderEvents.orderId, o.id), eq(orderEvents.internal, false)))
      .orderBy(desc(orderEvents.createdAt)),
    orderLabel(o),
    import("@/server/payments").then((m) => m.paymentInstructions(o)),
  ]);
  const { accessToken: _t, ip: _ip, ...publicOrder } = o;
  void _t;
  void _ip;
  return { order: publicOrder, label, items, events: visible, paymentInstructions: ["unpaid", "pending"].includes(o.paymentStatus) ? instructions : null };
}

/* ============================================================ mutations */

async function requireOrder(id: string) {
  const o = await loadOrder(id);
  if (!o) throw new ShopError("not_found", "Bestellung nicht gefunden.");
  return o;
}

const actorName = (a: Actor) => (a ? a.name || a.email : "System");

/** Staff: payment received (invoice paid, cash at pickup …). */
export async function markPaid(orderId: string, actor: Actor, input: { reference?: string; note?: string; paidAt?: Date } = {}) {
  const o = await requireOrder(orderId);
  if (["cancelled", "refunded"].includes(o.status)) throw new ShopError("conflict", "Stornierte oder rückerstattete Bestellungen können nicht als bezahlt markiert werden.");
  if (["paid", "partially_refunded", "refunded"].includes(o.paymentStatus)) throw new ShopError("conflict", "Die Bestellung ist bereits bezahlt.");
  const res = await markOrderPaid(o.id, { provider: o.paymentMethod || "manual", providerRef: input.reference?.trim() || null, actor, note: input.note?.trim() || undefined, paymentReference: o.paymentReference });
  await audit(actor, "order.paid", { entityType: "order", entityId: o.id, summary: `Bestellung ${await orderLabel(o)} als bezahlt markiert (${money(o.total)})` });
  return res.order;
}

export type FulfilInput = {
  /** omitted = all remaining items */
  items?: { orderItemId: string; quantity: number }[];
  carrier?: CarrierKey | "" | null;
  trackingNumber?: string | null;
  /** overrides the carrier link */
  trackingUrl?: string | null;
  notify?: boolean;
};

/** Marks items as shipped (all or some), with optional tracking. */
export async function fulfilOrder(orderId: string, actor: Actor, input: FulfilInput = {}) {
  const res = await db.transaction(async (tx) => {
    const o = await loadOrder(orderId, tx, { lock: true });
    if (!o) throw new ShopError("not_found", "Bestellung nicht gefunden.");
    if (["cancelled", "refunded", "failed"].includes(o.status)) throw new ShopError("conflict", "Diese Bestellung ist storniert oder rückerstattet und kann nicht versendet werden.");
    if (o.status === "pending") throw new ShopError("conflict", "Die Online-Zahlung ist noch nicht eingegangen. Versenden Sie erst nach Zahlungseingang.");
    const items = await loadOrderItems(o.id, tx);
    const open = (i: OrderItemRow) => Math.max(0, i.quantity - i.refundedQuantity - i.fulfilledQuantity);
    const wanted = input.items?.length ? input.items.filter((x) => x.quantity > 0) : items.filter((i) => open(i) > 0).map((i) => ({ orderItemId: i.id, quantity: open(i) }));
    if (!wanted.length) throw new ShopError("validation", "Wählen Sie mindestens einen Artikel zum Versenden.");
    const shipped: { name: string; variantTitle: string; quantity: number }[] = [];
    for (const w of wanted) {
      const item = items.find((i) => i.id === w.orderItemId);
      if (!item) throw new ShopError("validation", "Ein Artikel gehört nicht zu dieser Bestellung.");
      if (!Number.isInteger(w.quantity) || w.quantity > open(item)) throw new ShopError("validation", `Von «${item.name}» sind nur noch ${open(item)} Stück offen.`);
      await tx
        .update(orderItems)
        .set({ fulfilledQuantity: item.fulfilledQuantity + w.quantity })
        .where(eq(orderItems.id, item.id));
      item.fulfilledQuantity += w.quantity;
      shipped.push({ name: item.name, variantTitle: item.variantTitle, quantity: w.quantity });
    }
    const all = items.every((i) => open(i) === 0);
    const carrier = input.carrier && input.carrier in CARRIERS ? CARRIERS[input.carrier as CarrierKey].label : null;
    const number = input.trackingNumber?.trim() || null;
    const url = input.trackingUrl?.trim() || carrierTrackingUrl(input.carrier, number);
    if (url && !/^https?:\/\//i.test(url)) throw new ShopError("validation", "Der Tracking-Link muss mit https:// beginnen.");
    const paid = ["paid", "partially_refunded"].includes(o.paymentStatus);
    const [updated] = await tx
      .update(orders)
      .set({
        fulfillmentStatus: all ? "fulfilled" : "partial",
        status: all && paid ? "completed" : o.status,
        fulfilledAt: all ? new Date() : o.fulfilledAt,
        trackingNumber: number ?? o.trackingNumber,
        trackingUrl: url ?? (number ? null : o.trackingUrl),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, o.id))
      .returning();
    const what = shipped.map((s) => `${s.quantity} × ${s.name}${s.variantTitle ? ` (${s.variantTitle})` : ""}`).join(", ");
    await addOrderEvent(o.id, "fulfilment", `${all ? "Versendet" : "Teilweise versendet"}: ${what}${carrier ? ` · ${carrier}` : ""}${number ? ` · Sendungsnummer ${number}` : ""}.`, {
      tx,
      internal: false,
      userId: actor?.id,
      data: { items: wanted, carrier: input.carrier ?? null, trackingNumber: number, trackingUrl: url },
    });
    return { order: updated, shipped, all, carrier, number, url };
  });
  const label = await orderLabel(res.order);
  await audit(actor, "order.fulfilled", { entityType: "order", entityId: res.order.id, summary: `Bestellung ${label} ${res.all ? "versendet" : "teilweise versendet"}` });
  await emit("order.fulfilled", { id: res.order.id, number: res.order.number, complete: res.all, items: res.shipped, carrier: res.carrier, trackingNumber: res.number, trackingUrl: res.url });
  if (input.notify !== false) {
    const { sendShippedEmail } = await import("@/server/mail/templates/orders");
    await sendShippedEmail(res.order.id, { trackingNumber: res.number, trackingUrl: res.url, carrier: res.carrier, items: res.shipped, partial: !res.all }).catch(() => {});
  }
  return res.order;
}

/** Cancels an unpaid order: stock back (optional), coupon released, customer informed (optional). */
export async function cancelOrder(orderId: string, actor: Actor, input: { reason?: string; restock?: boolean; notify?: boolean } = {}) {
  const res = await db.transaction(async (tx) => {
    const o = await loadOrder(orderId, tx, { lock: true });
    if (!o) throw new ShopError("not_found", "Bestellung nicht gefunden.");
    if (["cancelled", "refunded", "completed"].includes(o.status)) throw new ShopError("conflict", `Eine ${ORDER_STATUS[o.status].label.toLowerCase()}e Bestellung kann nicht storniert werden.`);
    if (["paid", "partially_refunded"].includes(o.paymentStatus))
      throw new ShopError("conflict", "Die Bestellung ist bereits bezahlt. Erstatten Sie den Betrag zurück – eine vollständige Rückerstattung schliesst die Bestellung ab.");
    const items = await loadOrderItems(o.id, tx);
    // a failed order already gave its stock and coupon back
    const alreadyReleased = o.status === "failed";
    if (input.restock !== false && !alreadyReleased) {
      const restocked = await tx.select({ items: refunds.items, restock: refunds.restock }).from(refunds).where(eq(refunds.orderId, o.id));
      const back = (id: string) => restocked.filter((r) => r.restock).reduce((a, r) => a + (r.items.find((x) => x.orderItemId === id)?.quantity ?? 0), 0);
      await restock(
        items.map((i) => ({ variantId: i.variantId, quantity: i.quantity - back(i.id) })),
        "cancel",
        { tx, reference: `#${o.number}`, userId: actor?.id },
      );
    }
    if (!alreadyReleased) await releaseCoupon(o.couponCode, tx);
    await tx
      .update(payments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(payments.orderId, o.id), eq(payments.status, "pending")));
    const [updated] = await tx
      .update(orders)
      .set({ status: "cancelled", paymentStatus: o.paymentStatus === "pending" ? "unpaid" : o.paymentStatus, cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, o.id))
      .returning();
    const restockText = input.restock === false || alreadyReleased ? "" : " Lager zurückgebucht.";
    await addOrderEvent(o.id, "cancel", `Storniert von ${actorName(actor)}.${input.reason ? ` Grund: ${input.reason}.` : ""}${restockText}`, { tx, internal: false, userId: actor?.id, data: { reason: input.reason ?? "" } });
    await syncCustomerStats(o.customerId, tx);
    return updated;
  });
  const label = await orderLabel(res);
  await audit(actor, "order.cancelled", { entityType: "order", entityId: res.id, summary: `Bestellung ${label} storniert${input.reason ? `: ${input.reason}` : ""}` });
  await emit("order.cancelled", { id: res.id, number: res.number, reason: input.reason ?? "" });
  if (input.notify !== false) {
    const { sendCancelledEmail } = await import("@/server/mail/templates/orders");
    await sendCancelledEmail(res.id, input.reason).catch(() => {});
  }
  return res;
}

export type RefundInput = {
  /** amount in Rappen (0 allowed for a return without money back) */
  amount: number;
  items?: { orderItemId: string; quantity: number }[];
  restock?: boolean;
  reason?: string;
  notify?: boolean;
  /** only record it (already paid back outside, e.g. bank transfer); default: through the provider when possible */
  manual?: boolean;
};

/** Suggested refund amount for returned items (their share of the line total incl. discount). */
export function refundAmountForItems(items: Pick<OrderItemRow, "id" | "total" | "quantity">[], wanted: { orderItemId: string; quantity: number }[]) {
  return wanted.reduce((sum, w) => {
    const i = items.find((x) => x.id === w.orderItemId);
    return i && i.quantity ? sum + Math.round((i.total * w.quantity) / i.quantity) : sum;
  }, 0);
}

/**
 * Refund (amount and/or items). Through the payment provider when it supports
 * refunds and the order was paid there, otherwise recorded as manual refund.
 * The refund is recorded first and rolled back if the provider rejects it,
 * so a provider webhook arriving meanwhile never counts it twice.
 */
export async function refundOrder(orderId: string, actor: Actor, input: RefundInput) {
  const amount = Math.round(input.amount);
  const wantedItems = (input.items ?? []).filter((i) => i.quantity > 0);
  if (!Number.isInteger(amount) || amount < 0) throw new ShopError("validation", "Der Betrag ist ungültig.");
  if (amount === 0 && !wantedItems.length) throw new ShopError("validation", "Geben Sie einen Betrag ein oder wählen Sie Artikel.");
  const settings = await getSettings("payments");
  const before = await requireOrder(orderId);
  const provider = getProvider(before.paymentMethod);
  const viaProvider = !input.manual && amount > 0 && Boolean(provider?.refund && before.paymentReference);

  const rec = await db.transaction(async (tx) => {
    const o = await loadOrder(orderId, tx, { lock: true });
    if (!o) throw new ShopError("not_found", "Bestellung nicht gefunden.");
    if (amount > 0 && !["paid", "partially_refunded"].includes(o.paymentStatus)) throw new ShopError("conflict", "Nur bezahlte Bestellungen können rückerstattet werden. Unbezahlte Bestellungen stornieren Sie.");
    const open = o.total - o.refundedTotal;
    if (amount > open) throw new ShopError("validation", `Höchstens ${money(open)} können noch rückerstattet werden.`);
    const items = await loadOrderItems(o.id, tx);
    for (const w of wantedItems) {
      const item = items.find((i) => i.id === w.orderItemId);
      if (!item) throw new ShopError("validation", "Ein Artikel gehört nicht zu dieser Bestellung.");
      const left = item.quantity - item.refundedQuantity;
      if (!Number.isInteger(w.quantity) || w.quantity > left) throw new ShopError("validation", `Von «${item.name}» können höchstens ${left} Stück zurückgenommen werden.`);
      await tx
        .update(orderItems)
        .set({ refundedQuantity: item.refundedQuantity + w.quantity })
        .where(eq(orderItems.id, item.id));
    }
    if (input.restock !== false && wantedItems.length)
      await restock(
        wantedItems.map((w) => ({ variantId: items.find((i) => i.id === w.orderItemId)!.variantId, quantity: w.quantity })),
        "refund",
        { tx, reference: `#${o.number}`, userId: actor?.id },
      );
    const [refund] = await tx
      .insert(refunds)
      .values({ orderId: o.id, amount, reason: input.reason?.trim() ?? "", restock: input.restock !== false && wantedItems.length > 0, items: wantedItems, userId: actor?.id ?? null })
      .returning();
    let paymentId: string | null = null;
    if (amount > 0) {
      const [p] = await tx
        .insert(payments)
        .values({ orderId: o.id, provider: viaProvider ? o.paymentMethod : "manual", kind: "refund", status: viaProvider ? "pending" : "succeeded", amount, currency: o.currency, raw: { refundId: refund.id } })
        .returning({ id: payments.id });
      paymentId = p.id;
    }
    const refundedTotal = o.refundedTotal + amount;
    const full = refundedTotal >= o.total && o.total > 0;
    const [updated] = await tx
      .update(orders)
      .set({
        refundedTotal,
        paymentStatus: amount > 0 ? (full ? "refunded" : "partially_refunded") : o.paymentStatus,
        status: full ? "refunded" : o.status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, o.id))
      .returning();
    const itemText = wantedItems.map((w) => `${w.quantity} × ${items.find((i) => i.id === w.orderItemId)!.name}`).join(", ");
    await addOrderEvent(
      o.id,
      "refund",
      `${amount > 0 ? `${money(amount)} rückerstattet` : "Rücknahme erfasst"}${viaProvider ? ` über ${provider!.label}` : amount > 0 ? " (manuell)" : ""}${itemText ? ` · ${itemText}` : ""}${input.restock !== false && wantedItems.length ? " · Lager zurückgebucht" : ""}${input.reason ? ` · Grund: ${input.reason}` : ""}.`,
      { tx, internal: false, userId: actor?.id, data: { refundId: refund.id, amount, items: wantedItems, viaProvider } },
    );
    await syncCustomerStats(o.customerId, tx);
    return { order: updated, previous: o, refundId: refund.id, paymentId, items };
  });

  if (viaProvider) {
    try {
      const r = await provider!.refund!(rec.previous, amount, input.reason ?? "", settings);
      await db.update(refunds).set({ providerRef: r.providerRef }).where(eq(refunds.id, rec.refundId));
      if (rec.paymentId)
        await db
          .update(payments)
          .set({ providerRef: r.providerRef, status: r.status === "succeeded" ? "succeeded" : "pending", updatedAt: new Date() })
          .where(eq(payments.id, rec.paymentId));
    } catch (e) {
      // roll back what was recorded
      await db.transaction(async (tx) => {
        const p = rec.previous;
        for (const w of wantedItems) {
          const item = rec.items.find((i) => i.id === w.orderItemId)!;
          await tx.update(orderItems).set({ refundedQuantity: item.refundedQuantity }).where(eq(orderItems.id, item.id));
          if (input.restock !== false && item.variantId) {
            const [v] = await tx.select({ track: productVariants.trackInventory }).from(productVariants).where(eq(productVariants.id, item.variantId));
            if (v?.track) await adjustStock(item.variantId, -w.quantity, "manual", { tx, reference: `#${p.number} Rückerstattung abgelehnt`, userId: actor?.id });
          }
        }
        await tx.delete(refunds).where(eq(refunds.id, rec.refundId));
        if (rec.paymentId) await tx.delete(payments).where(eq(payments.id, rec.paymentId));
        await tx.update(orders).set({ refundedTotal: p.refundedTotal, paymentStatus: p.paymentStatus, status: p.status, updatedAt: new Date() }).where(eq(orders.id, p.id));
        const msg = e instanceof Error ? e.message : String(e);
        await addOrderEvent(p.id, "refund", `Rückerstattung über ${provider!.label} abgelehnt: ${msg}. Nichts verbucht.`, { tx, userId: actor?.id });
        await syncCustomerStats(p.customerId, tx);
      });
      const msg = e instanceof Error ? e.message : String(e);
      throw new ShopError("payment_failed", `${provider!.label} hat die Rückerstattung abgelehnt (${msg}). Es wurde nichts verbucht. Erstatten Sie den Betrag allenfalls manuell und erfassen Sie ihn mit «Nur erfassen».`);
    }
  }

  const label = await orderLabel(rec.order);
  await audit(actor, "order.refunded", { entityType: "order", entityId: rec.order.id, summary: `Bestellung ${label}: ${money(amount)} rückerstattet${viaProvider ? ` über ${provider!.label}` : ""}` });
  await emit("order.refunded", { id: rec.order.id, number: rec.order.number, amount, refundedTotal: rec.order.refundedTotal, items: wantedItems, viaProvider, source: "dashboard" });
  if (input.notify !== false && amount > 0) {
    const { sendRefundedEmail } = await import("@/server/mail/templates/orders");
    await sendRefundedEmail(rec.order.id, amount, input.reason).catch(() => {});
  }
  return (await loadOrder(rec.order.id))!;
}

/** Internal note or note to the customer (optionally e-mailed). */
export async function addOrderNote(orderId: string, actor: Actor, input: { message: string; visibleToCustomer?: boolean; notify?: boolean }) {
  const o = await requireOrder(orderId);
  const message = input.message.trim();
  if (!message) throw new ShopError("validation", "Bitte schreiben Sie eine Notiz.");
  if (message.length > 5000) throw new ShopError("validation", "Die Notiz ist zu lang (höchstens 5000 Zeichen).");
  await addOrderEvent(o.id, "note", message, { internal: !input.visibleToCustomer, userId: actor?.id, data: { visible: Boolean(input.visibleToCustomer) } });
  await audit(actor, "order.note_added", { entityType: "order", entityId: o.id, summary: `Notiz zu Bestellung ${await orderLabel(o)}${input.visibleToCustomer ? " (für Kunde)" : ""}` });
  if (input.visibleToCustomer && input.notify) {
    const { sendCustomerNoteEmail } = await import("@/server/mail/templates/orders");
    return sendCustomerNoteEmail(o.id, message);
  }
  return { ok: true as const };
}

export type ResendKind = "confirmation" | "shipped" | "notice";

export async function resendOrderEmail(orderId: string, actor: Actor, kind: ResendKind) {
  const o = await requireOrder(orderId);
  const t = await import("@/server/mail/templates/orders");
  const res =
    kind === "confirmation"
      ? await t.sendOrderConfirmation(o.id)
      : kind === "notice"
        ? await t.sendNewOrderNotice(o.id)
        : await t.sendShippedEmail(o.id, { trackingNumber: o.trackingNumber, trackingUrl: o.trackingUrl });
  await audit(actor, "order.email_resent", { entityType: "order", entityId: o.id, summary: `E-Mail (${kind}) zu Bestellung ${await orderLabel(o)} erneut gesendet` });
  return res;
}

/** Contact data and addresses (validated by the caller, e.g. with addressSchema from checkout.ts). */
export async function updateOrderContact(orderId: string, actor: Actor, input: { email: string; phone: string; billingAddress: Address; shippingAddress: Address | null }) {
  const o = await requireOrder(orderId);
  const changes: string[] = [];
  if (input.email !== o.email) changes.push(`E-Mail ${o.email} → ${input.email}`);
  if (input.phone !== o.phone) changes.push("Telefon");
  if (JSON.stringify(input.billingAddress) !== JSON.stringify(o.billingAddress)) changes.push("Rechnungsadresse");
  if (JSON.stringify(input.shippingAddress) !== JSON.stringify(o.shippingAddress)) changes.push("Lieferadresse");
  if (!changes.length) return o;
  const [updated] = await db
    .update(orders)
    .set({ email: input.email, phone: input.phone, billingAddress: input.billingAddress, shippingAddress: input.shippingAddress, updatedAt: new Date() })
    .where(eq(orders.id, o.id))
    .returning();
  await addOrderEvent(o.id, "update", `Geändert von ${actorName(actor)}: ${changes.join(", ")}.`, { userId: actor?.id });
  await audit(actor, "order.updated", { entityType: "order", entityId: o.id, summary: `Bestellung ${await orderLabel(o)}: ${changes.join(", ")}` });
  await emit("order.updated", { id: o.id, number: o.number, changes });
  return updated;
}

/**
 * Housekeeping (cron): online-payment orders still "pending" after `hours`
 * are given up (stock and coupon released).
 */
export async function expireStaleOrders(hours = 48) {
  const stale = await db
    .select({ id: orders.id, method: orders.paymentMethod })
    .from(orders)
    .where(and(eq(orders.status, "pending"), ne(orders.paymentStatus, "paid"), lt(orders.createdAt, new Date(Date.now() - hours * 3_600_000))));
  for (const s of stale) await markOrderPaymentFailed(s.id, { provider: s.method, reason: `Keine Zahlung innert ${hours} Stunden.`, giveUp: true });
  return stale.length;
}

/** Small KPIs for dashboards (count of open orders, revenue of the last 30 days). */
export async function orderStats() {
  const [r] = await db
    .select({
      open: sql<number>`count(*) filter (where ${orders.status} in ('processing','on_hold'))::int`,
      unpaid: sql<number>`count(*) filter (where ${orders.paymentStatus} in ('unpaid','pending') and ${orders.status} not in ('cancelled','failed','refunded'))::int`,
      revenue30: sql<number>`coalesce(sum(${orders.total} - ${orders.refundedTotal}) filter (where ${orders.paymentStatus} in ('paid','partially_refunded') and ${orders.createdAt} > now() - interval '30 days'),0)::int`,
      orders30: sql<number>`count(*) filter (where ${orders.status} not in ('cancelled','failed') and ${orders.createdAt} > now() - interval '30 days')::int`,
    })
    .from(orders);
  return r;
}
