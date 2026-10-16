/**
 * Sales figures for the overview and the statistics page.
 * Revenue counts only paid orders (paid / partially refunded) and is net of
 * refunds: total − refundedTotal, in Rappen. Days are Swiss calendar days.
 */
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { categories, orderItems, orders, productCategories } from "@/server/db/schema";
import { zurichDay } from "@/lib/tz";
import { bucketKey, bucketKeys, type Bucket, type DateRange } from "./range";

export const PAID_STATUSES = ["paid", "partially_refunded"] as const;

export function isPaid(paymentStatus: string) {
  return (PAID_STATUSES as readonly string[]).includes(paymentStatus);
}

export type SaleRow = {
  id: string;
  createdAt: Date;
  total: number;
  refundedTotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  paymentStatus: string;
  paymentMethod: string;
  couponCode: string | null;
  email: string;
};

export const netRevenue = (o: Pick<SaleRow, "total" | "refundedTotal">) => Math.max(0, o.total - o.refundedTotal);

export type Totals = { revenue: number; orders: number; aov: number; refunds: number; discounts: number; shipping: number; tax: number };

export function totalsOf(rows: SaleRow[]): Totals {
  const paid = rows.filter((r) => isPaid(r.paymentStatus));
  const revenue = paid.reduce((s, r) => s + netRevenue(r), 0);
  return {
    revenue,
    orders: paid.length,
    aov: paid.length ? Math.round(revenue / paid.length) : 0,
    refunds: paid.reduce((s, r) => s + r.refundedTotal, 0),
    discounts: paid.reduce((s, r) => s + r.discountTotal, 0),
    shipping: paid.reduce((s, r) => s + r.shippingTotal, 0),
    tax: paid.reduce((s, r) => s + r.taxTotal, 0),
  };
}

export type SeriesPoint = { key: string; revenue: number; orders: number };

/** Revenue and paid orders per bucket, with zero buckets filled in. */
export function seriesOf(rows: SaleRow[], fromDay: string, toDay: string, bucket: Bucket): SeriesPoint[] {
  const map = new Map(bucketKeys(fromDay, toDay, bucket).map((k) => [k, { key: k, revenue: 0, orders: 0 }]));
  for (const r of rows) {
    if (!isPaid(r.paymentStatus)) continue;
    const day = zurichDay(r.createdAt);
    if (day < fromDay || day > toDay) continue;
    const p = map.get(bucketKey(day, bucket));
    if (!p) continue;
    p.revenue += netRevenue(r);
    p.orders += 1;
  }
  return [...map.values()];
}

/** Relative change in percent (null when there is no base to compare with). */
export function change(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function loadSales(from: Date, to: Date): Promise<SaleRow[]> {
  return db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      total: orders.total,
      refundedTotal: orders.refundedTotal,
      discountTotal: orders.discountTotal,
      shippingTotal: orders.shippingTotal,
      taxTotal: orders.taxTotal,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      couponCode: orders.couponCode,
      email: orders.email,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, from), lt(orders.createdAt, to)));
}

export const PAYMENT_LABELS: Record<string, string> = {
  stripe: "Karte (Stripe)",
  card: "Karte",
  payrexx: "Payrexx / TWINT",
  twint: "TWINT",
  invoice: "Rechnung",
  bank_transfer: "Vorauskasse",
  banktransfer: "Vorauskasse",
  pickup: "Bei Abholung",
  cash: "Bar",
};

export const paymentLabel = (m: string) => PAYMENT_LABELS[m] ?? (m || "Unbekannt");

export function byPaymentMethod(rows: SaleRow[]) {
  const map = new Map<string, { method: string; label: string; orders: number; revenue: number }>();
  for (const r of rows) {
    if (!isPaid(r.paymentStatus)) continue;
    const m = map.get(r.paymentMethod) ?? { method: r.paymentMethod, label: paymentLabel(r.paymentMethod), orders: 0, revenue: 0 };
    m.orders += 1;
    m.revenue += netRevenue(r);
    map.set(r.paymentMethod, m);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export function couponUsage(rows: SaleRow[]) {
  const map = new Map<string, { code: string; orders: number; discount: number; revenue: number }>();
  for (const r of rows) {
    if (!r.couponCode || !isPaid(r.paymentStatus)) continue;
    const code = r.couponCode.toUpperCase();
    const c = map.get(code) ?? { code, orders: 0, discount: 0, revenue: 0 };
    c.orders += 1;
    c.discount += r.discountTotal;
    c.revenue += netRevenue(r);
    map.set(code, c);
  }
  return [...map.values()].sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);
}

/** Customers (by e-mail) with their first paid order in the range vs. those who bought before. */
export async function newVsReturning(rows: SaleRow[], from: Date) {
  const paid = rows.filter((r) => isPaid(r.paymentStatus));
  const byEmail = new Map<string, number>();
  for (const r of paid) byEmail.set(r.email.toLowerCase(), (byEmail.get(r.email.toLowerCase()) ?? 0) + netRevenue(r));
  const emails = [...byEmail.keys()];
  const before = new Set<string>();
  for (let i = 0; i < emails.length; i += 500) {
    const chunk = emails.slice(i, i + 500);
    const hit = await db
      .selectDistinct({ e: sql<string>`lower(${orders.email})` })
      .from(orders)
      .where(and(lt(orders.createdAt, from), inArray(orders.paymentStatus, [...PAID_STATUSES]), inArray(sql`lower(${orders.email})`, chunk)));
    for (const h of hit) before.add(h.e);
  }
  const out = { newCustomers: 0, newRevenue: 0, returningCustomers: 0, returningRevenue: 0 };
  for (const [e, rev] of byEmail) {
    if (before.has(e)) {
      out.returningCustomers++;
      out.returningRevenue += rev;
    } else {
      out.newCustomers++;
      out.newRevenue += rev;
    }
  }
  return out;
}

export type TopRow = { id: string; name: string; qty: number; revenue: number };

/** Best-selling products and categories (net of refunded quantities) for paid orders in the range. */
export async function topSellers(from: Date, to: Date, limit = 10) {
  const items = await db
    .select({ productId: orderItems.productId, name: orderItems.name, quantity: orderItems.quantity, refunded: orderItems.refundedQuantity, total: orderItems.total })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(gte(orders.createdAt, from), lt(orders.createdAt, to), inArray(orders.paymentStatus, [...PAID_STATUSES])));
  const products = new Map<string, TopRow>();
  for (const it of items) {
    const qty = Math.max(0, it.quantity - it.refunded);
    const revenue = it.quantity ? Math.round((it.total * qty) / it.quantity) : 0;
    const key = it.productId ?? `name:${it.name}`;
    const p = products.get(key) ?? { id: key, name: it.name, qty: 0, revenue: 0 };
    p.qty += qty;
    p.revenue += revenue;
    products.set(key, p);
  }
  const productIds = [...products.keys()].filter((k) => !k.startsWith("name:"));
  const cats = new Map<string, TopRow>();
  if (productIds.length) {
    const links = await db
      .select({ productId: productCategories.productId, id: categories.id, name: categories.name })
      .from(productCategories)
      .innerJoin(categories, eq(productCategories.categoryId, categories.id))
      .where(inArray(productCategories.productId, productIds));
    for (const l of links) {
      const p = products.get(l.productId)!;
      const c = cats.get(l.id) ?? { id: l.id, name: l.name, qty: 0, revenue: 0 };
      c.qty += p.qty;
      c.revenue += p.revenue;
      cats.set(l.id, c);
    }
  }
  const sort = (a: TopRow, b: TopRow) => b.revenue - a.revenue || b.qty - a.qty;
  return { products: [...products.values()].sort(sort).slice(0, limit), categories: [...cats.values()].sort(sort).slice(0, limit) };
}

/** Everything the statistics page needs for one range. */
export async function salesReport(range: DateRange) {
  const [current, previous] = await Promise.all([loadSales(range.from, range.to), loadSales(range.prev.from, range.prev.to)]);
  const [top, customers] = await Promise.all([topSellers(range.from, range.to), newVsReturning(current, range.from)]);
  return {
    totals: totalsOf(current),
    previous: totalsOf(previous),
    series: seriesOf(current, range.fromDay, range.toDay, range.bucket),
    previousSeries: seriesOf(previous, range.prev.fromDay, range.prev.toDay, range.bucket),
    payments: byPaymentMethod(current),
    coupons: couponUsage(current),
    customers,
    top,
    allOrders: current.length,
  };
}

/** Daily rows for the CSV export. */
export function dailyReport(rows: SaleRow[], fromDay: string, toDay: string) {
  const days = new Map(bucketKeys(fromDay, toDay, "day").map((d) => [d, [] as SaleRow[]]));
  for (const r of rows) days.get(zurichDay(r.createdAt))?.push(r);
  return [...days.entries()].map(([day, list]) => {
    const t = totalsOf(list);
    return { day, ordersAll: list.length, ...t };
  });
}
