/** Data for the dashboard start page: KPIs, to-dos, setup checklist, latest activity, notifications. */
import { and, count, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { apiKeys, inquiries, notifications, orders, productVariants, products, users } from "@/server/db/schema";
import type { CurrentUser } from "@/server/auth/session";
import { smtpConfig } from "@/server/mail/mailer";
import { getSettings } from "@/server/settings";
import { addDays, dayStart, zurichDay } from "@/lib/tz";
import { loadSales, seriesOf, totalsOf } from "./sales";

/** Revenue (paid, net of refunds) for today, 7 and 30 days with the period before each. */
export async function revenueKpis(now = new Date()) {
  const today = zurichDay(now);
  const from = dayStart(addDays(today, -59));
  const to = dayStart(addDays(today, 1));
  const rows = await loadSales(from, to);
  const sum = (fromDay: string, toDay: string) => {
    const a = dayStart(fromDay).getTime();
    const b = dayStart(addDays(toDay, 1)).getTime();
    return totalsOf(rows.filter((r) => r.createdAt.getTime() >= a && r.createdAt.getTime() < b));
  };
  return {
    today: { current: sum(today, today), previous: sum(addDays(today, -1), addDays(today, -1)) },
    week: { current: sum(addDays(today, -6), today), previous: sum(addDays(today, -13), addDays(today, -7)) },
    month: { current: sum(addDays(today, -29), today), previous: sum(addDays(today, -59), addDays(today, -30)) },
    series: seriesOf(rows, addDays(today, -29), today, "day"),
    ordersWeek: rows.filter((r) => r.createdAt >= dayStart(addDays(today, -6))).length,
    ordersPrevWeek: rows.filter((r) => r.createdAt >= dayStart(addDays(today, -13)) && r.createdAt < dayStart(addDays(today, -6))).length,
  };
}

export async function openOrderCount() {
  const [r] = await db.select({ n: count() }).from(orders).where(inArray(orders.status, ["processing", "on_hold"]));
  return r.n;
}

export async function newInquiryCount() {
  const [r] = await db.select({ n: count() }).from(inquiries).where(eq(inquiries.status, "new"));
  return r.n;
}

export type Todo = { key: string; tone: "warn" | "info"; icon: "cart" | "card" | "box" | "inbox"; title: string; text: string; href: string; action: string };

export async function shopTodos(user: CurrentUser, now = new Date()): Promise<Todo[]> {
  const out: Todo[] = [];
  if (user.permissions.has("orders.view")) {
    const [toShip] = await db.select({ n: count() }).from(orders).where(inArray(orders.status, ["processing", "on_hold"]));
    if (toShip.n)
      out.push({ key: "fulfil", tone: "warn", icon: "cart", title: `${toShip.n} Bestellung${toShip.n === 1 ? "" : "en"} zu bearbeiten`, text: "In Bearbeitung oder zurückgestellt – bereit zum Versand?", href: "/admin/bestellungen?status=offen", action: "Bestellungen" });
    const { invoiceDueDays } = await getSettings("payments");
    const due = new Date(now.getTime() - invoiceDueDays * 86_400_000);
    const [unpaid] = await db
      .select({ n: count(), sum: sql<number>`coalesce(sum(${orders.total}), 0)`.mapWith(Number) })
      .from(orders)
      .where(and(eq(orders.paymentMethod, "invoice"), inArray(orders.paymentStatus, ["unpaid", "pending"]), lt(orders.createdAt, due), ne(orders.status, "cancelled"), ne(orders.status, "failed")));
    if (unpaid.n)
      out.push({
        key: "unpaid",
        tone: "warn",
        icon: "card",
        title: `${unpaid.n} Rechnung${unpaid.n === 1 ? "" : "en"} überfällig`,
        text: `Älter als ${invoiceDueDays} Tage und noch nicht bezahlt – Zahlung prüfen oder mahnen.`,
        href: "/admin/bestellungen?zahlung=offen",
        action: "Ansehen",
      });
  }
  if (user.permissions.has("products.view")) {
    const { lowStockThreshold } = await getSettings("shop");
    const [low] = await db
      .select({ n: count() })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(eq(productVariants.trackInventory, true), eq(productVariants.active, true), lte(productVariants.stock, lowStockThreshold), ne(products.status, "archived")));
    if (low.n)
      out.push({ key: "stock", tone: "warn", icon: "box", title: `${low.n} Variante${low.n === 1 ? "" : "n"} mit tiefem Lagerbestand`, text: `Bestand ${lowStockThreshold} oder weniger – nachbestellen oder Bestand anpassen.`, href: "/admin/produkte?lager=tief", action: "Lager" });
  }
  return out;
}

export type Check = { key: string; ok: boolean; title: string; text: string; href: string };

export async function setupChecks(modules: { shop: boolean; storefront: boolean }): Promise<Check[]> {
  const [smtp, pay, brand, unsecured, keys] = await Promise.all([
    smtpConfig(),
    getSettings("payments"),
    getSettings("branding"),
    db.select({ n: count() }).from(users).where(and(eq(users.status, "active"), eq(users.totpEnabled, false))),
    db.select({ n: count() }).from(apiKeys).where(isNull(apiKeys.revokedAt)),
  ]);
  const checks: Check[] = [
    { key: "smtp", ok: smtp.configured, title: "E-Mail-Versand eingerichtet", text: smtp.configured ? "Benachrichtigungen werden verschickt." : "Ohne SMTP gehen keine Bestätigungen und Hinweise raus.", href: "/admin/einstellungen?tab=email" },
  ];
  if (modules.shop) {
    const anyPay = pay.stripeEnabled || pay.payrexxEnabled || pay.invoiceEnabled || pay.bankTransferEnabled || pay.pickupPaymentEnabled;
    checks.push({ key: "payment", ok: anyPay, title: "Zahlungsart aktiviert", text: anyPay ? "Kundinnen und Kunden können bezahlen." : "Aktivieren Sie mindestens eine Zahlungsart.", href: "/admin/shop-einstellungen?tab=zahlung" });
  }
  checks.push({ key: "logo", ok: Boolean(brand.logoUrl), title: "Logo hinterlegt", text: brand.logoUrl ? "Erscheint im Dashboard und in E-Mails." : "Für Dashboard, E-Mails und Rechnungen.", href: "/admin/einstellungen?tab=branding" });
  checks.push({
    key: "2fa",
    ok: unsecured[0].n === 0,
    title: "Alle Benutzer mit 2FA",
    text: unsecured[0].n === 0 ? "Alle aktiven Konten sind zusätzlich geschützt." : `${unsecured[0].n} aktive${unsecured[0].n === 1 ? "s Konto" : " Konten"} ohne Zwei-Faktor-Anmeldung.`,
    href: "/admin/benutzer",
  });
  if (!modules.storefront) checks.push({ key: "apikey", ok: keys[0].n > 0, title: "API-Schlüssel erstellt", text: keys[0].n > 0 ? "Die Website ist verbunden." : "Ohne Schlüssel kann die Website keine Daten abrufen.", href: "/admin/integrationen" });
  return checks;
}

export async function latestOrders(limit = 6) {
  return db
    .select({ id: orders.id, number: orders.number, email: orders.email, billing: orders.billingAddress, total: orders.total, status: orders.status, paymentStatus: orders.paymentStatus, createdAt: orders.createdAt })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function latestInquiries(limit = 6) {
  return db
    .select({ id: inquiries.id, reference: inquiries.reference, name: inquiries.name, email: inquiries.email, subject: inquiries.subject, message: inquiries.message, status: inquiries.status, createdAt: inquiries.createdAt })
    .from(inquiries)
    .where(ne(inquiries.status, "spam"))
    .orderBy(desc(inquiries.createdAt))
    .limit(limit);
}

/* ---------- notifications ---------- */

function visibleTo(user: CurrentUser) {
  const perms = [...user.permissions];
  return or(eq(notifications.userId, user.id), and(isNull(notifications.userId), or(isNull(notifications.permission), perms.length ? inArray(notifications.permission, perms) : sql`false`)));
}

export async function userNotifications(user: CurrentUser, limit = 8, since = new Date(Date.now() - 60 * 86_400_000)) {
  const where = and(visibleTo(user), gte(notifications.createdAt, since));
  const rows = await db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(limit);
  const [unread] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(where, sql`not (${notifications.readBy} @> ${JSON.stringify([user.id])}::jsonb)`));
  return { rows: rows.map((r) => ({ ...r, read: r.readBy.includes(user.id) })), unread: unread.n };
}

export async function markNotificationsRead(user: CurrentUser, id?: string) {
  const where = and(visibleTo(user), sql`not (${notifications.readBy} @> ${JSON.stringify([user.id])}::jsonb)`, id ? eq(notifications.id, id) : undefined);
  await db
    .update(notifications)
    .set({ readBy: sql`${notifications.readBy} || ${JSON.stringify([user.id])}::jsonb` })
    .where(where);
}
