/** Data for the dashboard start page: KPIs, to-dos, setup checklist, latest activity, notifications. */
import { and, count, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { apiKeys, auditLog, inquiries, media, notifications, orders, pages, posts, productVariants, products, users } from "@/server/db/schema";
import type { CurrentUser } from "@/server/auth/session";
import { smtpConfig } from "@/server/mail/mailer";
import { getSettings } from "@/server/settings";
import { websiteEditing } from "@/modules/registry";
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
      out.push({ key: "fulfil", tone: "warn", icon: "cart", title: `${toShip.n} Bestellung${toShip.n === 1 ? "" : "en"} zu bearbeiten`, text: "In Bearbeitung oder zurückgestellt – bereit zum Versand?", href: "/madexadm/bestellungen?status=offen", action: "Bestellungen" });
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
        href: "/madexadm/bestellungen?zahlung=offen",
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
      out.push({ key: "stock", tone: "warn", icon: "box", title: `${low.n} Variante${low.n === 1 ? "" : "n"} mit tiefem Lagerbestand`, text: `Bestand ${lowStockThreshold} oder weniger – nachbestellen oder Bestand anpassen.`, href: "/madexadm/produkte?lager=tief", action: "Lager" });
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
    { key: "smtp", ok: smtp.configured, title: "E-Mail-Versand eingerichtet", text: smtp.configured ? "Benachrichtigungen werden verschickt." : "Ohne SMTP gehen keine Bestätigungen und Hinweise raus.", href: "/madexadm/einstellungen?tab=email" },
  ];
  if (modules.shop) {
    const anyPay = pay.stripeEnabled || pay.payrexxEnabled || pay.invoiceEnabled || pay.bankTransferEnabled || pay.pickupPaymentEnabled;
    checks.push({ key: "payment", ok: anyPay, title: "Zahlungsart aktiviert", text: anyPay ? "Kundinnen und Kunden können bezahlen." : "Aktivieren Sie mindestens eine Zahlungsart.", href: "/madexadm/shop-einstellungen?tab=zahlung" });
  }
  const [general, legal] = await Promise.all([getSettings("general"), db.select({ slug: pages.slug }).from(pages).where(and(inArray(pages.slug, ["impressum", "datenschutz"]), eq(pages.status, "published")))]);
  const company = Boolean(general.companyName && general.email && general.city);
  checks.unshift({ key: "company", ok: company, title: "Firmendaten erfasst", text: company ? "Erscheinen in Fusszeile, Impressum, E-Mails und Rechnungen." : "Name, Adresse und E-Mail für Fusszeile, Impressum und Rechnungen.", href: "/madexadm/einstellungen" });
  if (websiteEditing) checks.push({ key: "legal", ok: legal.length === 2, title: "Impressum und Datenschutz veröffentlicht", text: legal.length === 2 ? "Beide Seiten sind online – bitte Texte prüfen." : "Gesetzlich nötig. Vorlagen liegen unter Website → Seiten.", href: "/madexadm/seiten" });
  checks.push({ key: "logo", ok: Boolean(brand.logoUrl), title: "Logo hinterlegt", text: brand.logoUrl ? "Erscheint im Dashboard und in E-Mails." : "Für Dashboard, E-Mails und Rechnungen.", href: "/madexadm/einstellungen?tab=branding" });
  checks.push({
    key: "2fa",
    ok: unsecured[0].n === 0,
    title: "Alle Benutzer mit 2FA",
    text: unsecured[0].n === 0 ? "Alle aktiven Konten sind zusätzlich geschützt." : `${unsecured[0].n} aktive${unsecured[0].n === 1 ? "s Konto" : " Konten"} ohne Zwei-Faktor-Anmeldung.`,
    href: "/madexadm/benutzer",
  });
  if (!modules.storefront) checks.push({ key: "apikey", ok: keys[0].n > 0, title: "API-Schlüssel erstellt", text: keys[0].n > 0 ? "Die Website ist verbunden." : "Ohne Schlüssel kann die Website keine Daten abrufen.", href: "/madexadm/integrationen" });
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

/** Counts for "Auf einen Blick" (only what the active plugins bring). */
export async function atAGlance(modules: { shop: boolean; blog: boolean; inquiries: boolean }) {
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0].n;
  const [pagesN, mediaN, usersN, postsN, productsN, ordersN, inquiriesN] = await Promise.all([
    n(db.select({ n: count() }).from(pages).where(eq(pages.status, "published"))),
    n(db.select({ n: count() }).from(media)),
    n(db.select({ n: count() }).from(users).where(eq(users.status, "active"))),
    modules.blog ? n(db.select({ n: count() }).from(posts)) : Promise.resolve(null),
    modules.shop ? n(db.select({ n: count() }).from(products).where(eq(products.status, "active"))) : Promise.resolve(null),
    modules.shop ? n(db.select({ n: count() }).from(orders)) : Promise.resolve(null),
    modules.inquiries ? n(db.select({ n: count() }).from(inquiries)) : Promise.resolve(null),
  ]);
  return { pages: pagesN, media: mediaN, users: usersN, posts: postsN, products: productsN, orders: ordersN, inquiries: inquiriesN };
}

/** Latest changes from the audit log (who changed what). */
export async function recentActivity(limit = 6) {
  return db
    .select({ id: auditLog.id, summary: auditLog.summary, action: auditLog.action, createdAt: auditLog.createdAt, name: users.name, email: auditLog.userEmail })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(and(ne(auditLog.summary, ""), sql`${auditLog.action} not like 'auth.%' and ${auditLog.action} not like 'login%'`))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}
