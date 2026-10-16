/**
 * Customer administration: list/search, detail with orders, edit, notes and
 * tags, GDPR/DSG data export, anonymisation and deletion, CSV export.
 *
 * Orders must be kept for bookkeeping (OR 958f: 10 years), so a customer with
 * orders is anonymised instead of deleted: personal data disappears from the
 * customer and their orders, amounts and items stay.
 */
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { carts, customerAddresses, customers, customerSessions, orderItems, orders, type Address } from "@/server/db/schema";
import { audit, type Actor } from "@/server/audit";
import { emit } from "@/server/events";
import { fromZod, InputError } from "./errors";
import { toCsv } from "@/server/lib/csv";

export type Customer = typeof customers.$inferSelect;

export const CUSTOMER_SORTS = {
  recent: "Neueste zuerst",
  name: "Name A–Z",
  spent: "Umsatz absteigend",
  orders: "Anzahl Bestellungen",
  last_order: "Letzte Bestellung",
} as const;
export type CustomerSort = keyof typeof CUSTOMER_SORTS;

export type CustomerListParams = { q?: string; account?: "konto" | "gast" | ""; newsletter?: "ja" | "nein" | ""; tag?: string; sort?: CustomerSort; page?: number; perPage?: number };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const ANON_DOMAIN = "anonymisiert.invalid";
export const isAnonymised = (c: Pick<Customer, "email">) => c.email.endsWith(`@${ANON_DOMAIN}`);

function listWhere(p: CustomerListParams) {
  const q = p.q?.trim();
  const like = q ? `%${escapeLike(q)}%` : "";
  return and(
    q ? or(ilike(customers.email, like), ilike(customers.firstName, like), ilike(customers.lastName, like), ilike(customers.phone, like), sql`(${customers.firstName} || ' ' || ${customers.lastName}) ilike ${like}`) : undefined,
    p.account === "konto" ? isNotNull(customers.passwordHash) : p.account === "gast" ? isNull(customers.passwordHash) : undefined,
    p.newsletter === "ja" ? eq(customers.acceptsMarketing, true) : p.newsletter === "nein" ? eq(customers.acceptsMarketing, false) : undefined,
    p.tag ? sql`${customers.tags} @> ${JSON.stringify([p.tag])}::jsonb` : undefined,
  );
}

function listOrder(sort?: CustomerSort) {
  if (sort === "name") return [asc(customers.lastName), asc(customers.firstName), asc(customers.email)];
  if (sort === "spent") return [desc(customers.totalSpent), asc(customers.email)];
  if (sort === "orders") return [desc(customers.ordersCount), asc(customers.email)];
  if (sort === "last_order") return [sql`${customers.lastOrderAt} desc nulls last`, asc(customers.email)];
  return [desc(customers.createdAt)];
}

export async function listCustomers(p: CustomerListParams) {
  const perPage = p.perPage ?? 25;
  const page = Math.max(1, p.page ?? 1);
  const where = listWhere(p);
  const [rows, [{ total }], [totals]] = await Promise.all([
    db
      .select({
        id: customers.id,
        email: customers.email,
        firstName: customers.firstName,
        lastName: customers.lastName,
        phone: customers.phone,
        hasAccount: sql<boolean>`${customers.passwordHash} is not null`,
        acceptsMarketing: customers.acceptsMarketing,
        tags: customers.tags,
        ordersCount: customers.ordersCount,
        totalSpent: customers.totalSpent,
        lastOrderAt: customers.lastOrderAt,
        disabled: customers.disabled,
        createdAt: customers.createdAt,
        city: sql<string | null>`${customers.defaultAddress}->>'city'`,
      })
      .from(customers)
      .where(where)
      .orderBy(...listOrder(p.sort))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ total: count() }).from(customers).where(where),
    db
      .select({
        all: count(),
        accounts: sql<number>`count(*) filter (where ${customers.passwordHash} is not null)`.mapWith(Number),
        newsletter: sql<number>`count(*) filter (where ${customers.acceptsMarketing})`.mapWith(Number),
      })
      .from(customers),
  ]);
  return { rows, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)), totals };
}

/** All tags in use (for filters and suggestions). */
export async function customerTags() {
  const rows = await db.execute<{ tag: string }>(sql`select distinct jsonb_array_elements_text(tags) as tag from customers order by 1 limit 200`);
  const list = (Array.isArray(rows) ? rows : (rows as { rows: { tag: string }[] }).rows) as { tag: string }[];
  return list.map((r) => r.tag);
}

export async function getCustomer(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  if (!customer) return null;
  const [addresses, orderRows] = await Promise.all([
    db.select().from(customerAddresses).where(eq(customerAddresses.customerId, id)).orderBy(desc(customerAddresses.isDefault), asc(customerAddresses.createdAt)),
    db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        total: orders.total,
        refundedTotal: orders.refundedTotal,
        currency: orders.currency,
        createdAt: orders.createdAt,
        linked: sql<boolean>`${orders.customerId} = ${id}`,
      })
      .from(orders)
      .where(or(eq(orders.customerId, id), sql`lower(${orders.email}) = lower(${customer.email})`))
      .orderBy(desc(orders.createdAt))
      .limit(200),
  ]);
  const paid = orderRows.filter((o) => ["paid", "partially_refunded", "refunded"].includes(o.paymentStatus));
  const spent = paid.reduce((n, o) => n + o.total - o.refundedTotal, 0);
  const counted = orderRows.filter((o) => !["cancelled", "failed"].includes(o.status));
  const stats = {
    orders: counted.length,
    spent,
    average: paid.length ? Math.round(spent / paid.length) : 0,
    firstOrderAt: orderRows.length ? orderRows[orderRows.length - 1].createdAt : null,
    lastOrderAt: orderRows[0]?.createdAt ?? null,
  };
  const { passwordHash, ...safe } = customer;
  return { customer: { ...safe, hasAccount: passwordHash !== null }, addresses, orders: orderRows, stats };
}

/** Recomputes ordersCount / totalSpent / lastOrderAt from the orders (for consistency checks). */
export async function refreshCustomerStats(id: string) {
  const [s] = await db
    .select({
      n: sql<number>`count(*) filter (where ${orders.status} not in ('cancelled','failed'))`.mapWith(Number),
      spent: sql<number>`coalesce(sum(${orders.total} - ${orders.refundedTotal}) filter (where ${orders.paymentStatus} in ('paid','partially_refunded','refunded')), 0)`.mapWith(Number),
      last: sql<Date | null>`max(${orders.createdAt})`,
    })
    .from(orders)
    .where(eq(orders.customerId, id));
  await db
    .update(customers)
    .set({ ordersCount: s.n, totalSpent: s.spent, lastOrderAt: s.last ? new Date(s.last) : null })
    .where(eq(customers.id, id));
}

const addressSchema = z.object({
  firstName: z.string().trim().min(1, "Vorname der Adresse fehlt.").max(100),
  lastName: z.string().trim().min(1, "Nachname der Adresse fehlt.").max(100),
  company: z.string().trim().max(150).optional(),
  street: z.string().trim().min(1, "Strasse und Nr. fehlen.").max(200),
  street2: z.string().trim().max(200).optional(),
  zip: z.string().trim().min(3, "Bitte eine PLZ eingeben.").max(12),
  city: z.string().trim().min(1, "Bitte einen Ort eingeben.").max(100),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Bitte den Ländercode mit 2 Buchstaben angeben (z. B. CH)."),
  phone: z.string().trim().max(40).optional(),
});

export const customerInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse eingeben.").max(200),
  firstName: z.string().trim().max(100).default(""),
  lastName: z.string().trim().max(100).default(""),
  phone: z.string().trim().max(40).default(""),
  acceptsMarketing: z.boolean().default(false),
  note: z.string().max(5000).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  disabled: z.boolean().default(false),
  defaultAddress: addressSchema.nullish().transform((v) => v ?? null),
});
export type CustomerInput = z.input<typeof customerInputSchema>;
export { addressSchema };

/** Creates (id = null) or updates a customer. */
export async function saveCustomer(id: string | null, input: CustomerInput, actor: Actor) {
  const r = customerInputSchema.safeParse(input);
  if (!r.success) throw fromZod(r.error);
  const c = r.data;
  c.tags = [...new Map(c.tags.map((t) => [t.toLowerCase(), t])).values()];
  const [clash] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.email, c.email), id ? ne(customers.id, id) : undefined));
  if (clash) throw new InputError("Zu dieser E-Mail-Adresse gibt es bereits einen Kunden.", { email: "Bereits bei einem anderen Kunden hinterlegt." });
  const values = { ...c, defaultAddress: c.defaultAddress as Address | null, updatedAt: new Date() };
  const [row] = id ? await db.update(customers).set(values).where(eq(customers.id, id)).returning() : await db.insert(customers).values(values).returning();
  if (!row) throw new InputError("Der Kunde wurde nicht gefunden.");
  if (c.defaultAddress) {
    // keep the address book in sync with the default address
    const [def] = await db.select().from(customerAddresses).where(and(eq(customerAddresses.customerId, row.id), eq(customerAddresses.isDefault, true)));
    if (def) await db.update(customerAddresses).set({ address: c.defaultAddress as Address }).where(eq(customerAddresses.id, def.id));
    else await db.insert(customerAddresses).values({ customerId: row.id, address: c.defaultAddress as Address, isDefault: true, label: "Standard" });
  }
  await audit(actor, id ? "customer.updated" : "customer.created", { entityType: "customer", entityId: row.id, summary: `Kunde ${id ? "bearbeitet" : "erfasst"}: ${row.email}` });
  if (!id) await emit("customer.created", { id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName, acceptsMarketing: row.acceptsMarketing });
  return row;
}

export async function setCustomerNote(id: string, note: string, actor: Actor) {
  const [row] = await db.update(customers).set({ note: note.slice(0, 5000), updatedAt: new Date() }).where(eq(customers.id, id)).returning({ id: customers.id, email: customers.email });
  if (row) await audit(actor, "customer.note", { entityType: "customer", entityId: id, summary: `Notiz geändert: ${row.email}` });
  return Boolean(row);
}

export async function setCustomerTags(id: string, tags: string[], actor: Actor) {
  const clean = [...new Map(tags.map((t) => t.trim().slice(0, 40)).filter(Boolean).map((t) => [t.toLowerCase(), t])).values()].slice(0, 30);
  const [row] = await db.update(customers).set({ tags: clean, updatedAt: new Date() }).where(eq(customers.id, id)).returning({ id: customers.id, email: customers.email });
  if (row) await audit(actor, "customer.tags", { entityType: "customer", entityId: id, summary: `Tags geändert: ${row.email}` });
  return Boolean(row);
}

export async function deleteCustomerAddress(customerId: string, addressId: string, actor: Actor) {
  const [row] = await db.delete(customerAddresses).where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, customerId))).returning();
  if (row?.isDefault) await db.update(customers).set({ defaultAddress: null, updatedAt: new Date() }).where(eq(customers.id, customerId));
  if (row) await audit(actor, "customer.address_deleted", { entityType: "customer", entityId: customerId, summary: "Adresse gelöscht" });
  return Boolean(row);
}

/** All personal data we hold about a customer (Auskunftsrecht nach DSG / Art. 15 DSGVO). */
export async function exportCustomerData(id: string) {
  const [c] = await db.select().from(customers).where(eq(customers.id, id));
  if (!c) return null;
  const { passwordHash, ...customer } = c;
  const [addresses, orderRows] = await Promise.all([
    db.select().from(customerAddresses).where(eq(customerAddresses.customerId, id)),
    db
      .select()
      .from(orders)
      .where(or(eq(orders.customerId, id), sql`lower(${orders.email}) = lower(${c.email})`))
      .orderBy(asc(orders.createdAt)),
  ]);
  const items = orderRows.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderRows.map((o) => o.id))) : [];
  return {
    exportedAt: new Date().toISOString(),
    customer: { ...customer, hasAccount: passwordHash !== null },
    addresses: addresses.map((a) => ({ label: a.label, isDefault: a.isDefault, address: a.address, createdAt: a.createdAt })),
    orders: orderRows.map((o) => ({
      number: o.number,
      createdAt: o.createdAt,
      status: o.status,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      currency: o.currency,
      subtotal: o.subtotal,
      discountTotal: o.discountTotal,
      shippingTotal: o.shippingTotal,
      taxTotal: o.taxTotal,
      total: o.total,
      refundedTotal: o.refundedTotal,
      email: o.email,
      phone: o.phone,
      billingAddress: o.billingAddress,
      shippingAddress: o.shippingAddress,
      shippingMethod: o.shippingMethodName,
      paymentMethod: o.paymentMethod,
      customerNote: o.customerNote,
      items: items.filter((i) => i.orderId === o.id).map((i) => ({ name: i.name, variant: i.variantTitle, sku: i.sku, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
    })),
  };
}

const anonAddress = (a: Address | null): Address | null => (a ? { firstName: "Anonymisiert", lastName: "", street: "", zip: "", city: "", country: a.country } : null);

/**
 * Removes all personal data of a customer and from their orders (amounts,
 * items and the country stay for bookkeeping and VAT). Cannot be undone.
 */
export async function anonymiseCustomer(id: string, actor: Actor) {
  const [c] = await db.select().from(customers).where(eq(customers.id, id));
  if (!c) throw new InputError("Der Kunde wurde nicht gefunden.");
  const placeholder = `kunde-${id.slice(0, 8)}@${ANON_DOMAIN}`;
  const n = await db.transaction(async (tx) => {
    const own = await tx
      .select({ id: orders.id, billing: orders.billingAddress, shipping: orders.shippingAddress })
      .from(orders)
      .where(or(eq(orders.customerId, id), sql`lower(${orders.email}) = lower(${c.email})`));
    for (const o of own) {
      await tx
        .update(orders)
        .set({ email: placeholder, phone: "", billingAddress: anonAddress(o.billing)!, shippingAddress: anonAddress(o.shipping), customerNote: "", ip: "", customerId: id, updatedAt: new Date() })
        .where(eq(orders.id, o.id));
    }
    await tx.delete(customerAddresses).where(eq(customerAddresses.customerId, id));
    await tx.delete(customerSessions).where(eq(customerSessions.customerId, id));
    await tx.delete(carts).where(eq(carts.customerId, id));
    await tx
      .update(customers)
      .set({ email: placeholder, firstName: "Anonymisiert", lastName: "", phone: "", passwordHash: null, acceptsMarketing: false, note: "", tags: [], defaultAddress: null, disabled: true, emailVerifiedAt: null, updatedAt: new Date() })
      .where(eq(customers.id, id));
    return own.length;
  });
  await audit(actor, "customer.anonymised", { entityType: "customer", entityId: id, summary: `Kunde anonymisiert (${n} Bestellung${n === 1 ? "" : "en"} bereinigt)` });
  return { orders: n };
}

/** Deletes a customer without orders. Customers with orders must be anonymised instead. */
export async function deleteCustomer(id: string, actor: Actor) {
  const [c] = await db.select().from(customers).where(eq(customers.id, id));
  if (!c) throw new InputError("Der Kunde wurde nicht gefunden.");
  const [{ n }] = await db
    .select({ n: count() })
    .from(orders)
    .where(or(eq(orders.customerId, id), sql`lower(${orders.email}) = lower(${c.email})`));
  if (n > 0) throw new InputError(`Der Kunde hat ${n} Bestellung${n === 1 ? "" : "en"}, die aufbewahrt werden müssen. Anonymisieren Sie ihn stattdessen.`);
  await db.delete(customers).where(eq(customers.id, id));
  await audit(actor, "customer.deleted", { entityType: "customer", entityId: id, summary: `Kunde gelöscht: ${c.email}` });
  return true;
}

/** CSV for Excel (semicolon, BOM) of the filtered customer list. */
export async function customersCsv(p: CustomerListParams) {
  const rows = await db.select().from(customers).where(listWhere(p)).orderBy(...listOrder(p.sort)).limit(50_000);
  const head = ["Vorname", "Nachname", "E-Mail", "Telefon", "Kundenkonto", "Newsletter", "Bestellungen", "Umsatz CHF", "Letzte Bestellung", "Erfasst am", "Tags", "Firma", "Strasse", "PLZ", "Ort", "Land", "Gesperrt"];
  const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  const body = rows.map((c) => [
    c.firstName,
    c.lastName,
    c.email,
    c.phone,
    c.passwordHash ? "ja" : "nein",
    c.acceptsMarketing ? "ja" : "nein",
    c.ordersCount,
    (c.totalSpent / 100).toFixed(2),
    fmt(c.lastOrderAt),
    fmt(c.createdAt),
    c.tags.join(", "),
    c.defaultAddress?.company ?? "",
    c.defaultAddress?.street ?? "",
    c.defaultAddress?.zip ?? "",
    c.defaultAddress?.city ?? "",
    c.defaultAddress?.country ?? "",
    c.disabled ? "ja" : "nein",
  ]);
  return toCsv([head, ...body], { delimiter: ";", excel: true, bom: true });
}
