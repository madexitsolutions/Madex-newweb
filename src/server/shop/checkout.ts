/**
 * Checkout: turns a cart into an order and starts the payment.
 *
 *   const res = await placeOrder(cartToken, input, { customerId, ip, source: "storefront" });
 *   if (res.payment.type === "redirect") redirect(res.payment.url);
 *   else show res.payment.instructions (thank-you page /bestellung/<id>?token=<accessToken>)
 *
 * Everything that matters is re-checked server-side in ONE transaction:
 * prices, coupon, shipping method, payment method and stock (row locks).
 * A cart can become only one order – a double submit returns the existing
 * order (`existing: true`) instead of creating a second one.
 */
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { cartItems, carts, coupons, customers, orderEvents, orderItems, orders, payments, type Address } from "@/server/db/schema";
import { emit } from "@/server/events";
import { randomToken } from "@/server/lib/crypto";
import { getSettings } from "@/server/settings";
import { getProvider, type PaymentStart, type ReturnUrls } from "@/server/payments";
import { defaultReturnUrls } from "@/server/payments/urls";
import { buildCartView, cartIdFor, createCart, type CartView } from "./cart";
import { ShopError } from "./errors";
import { couponUsesBy, findCoupon, isPurchasable, loadShipping, loadVariants, maxQuantity } from "./lines";
import { addOrderEvent, checkLowStock, loadOrder, loadOrderItems, markOrderPaymentFailed, orderLabel, syncCustomerStats, takeStock, type OrderRow } from "./order-core";
import { nextOrderNumber } from "./sequence";
import { priceCart } from "./pricing";

/* ------------------------------------------------------------ validation */

const text = (max: number, msg: string) => z.string({ required_error: msg }).trim().min(1, msg).max(max, `Höchstens ${max} Zeichen.`);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .optional()
    .transform((v) => v || undefined);

export const addressSchema = z
  .object({
    firstName: text(80, "Bitte geben Sie den Vornamen an."),
    lastName: text(80, "Bitte geben Sie den Nachnamen an."),
    company: optText(120),
    street: text(120, "Bitte geben Sie Strasse und Hausnummer an."),
    street2: optText(120),
    zip: text(12, "Bitte geben Sie die PLZ an."),
    city: text(80, "Bitte geben Sie den Ort an."),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Bitte wählen Sie ein Land."),
    phone: optText(40),
  })
  .superRefine((a, ctx) => {
    if ((a.country === "CH" || a.country === "LI") && !/^\d{4}$/.test(a.zip)) ctx.addIssue({ code: "custom", path: ["zip"], message: "Die PLZ besteht aus 4 Ziffern." });
  });

export const checkoutSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Bitte geben Sie eine gültige E-Mail-Adresse ein.").max(200),
    phone: optText(40),
    billingAddress: addressSchema,
    shipToDifferentAddress: z.boolean().default(false),
    shippingAddress: addressSchema.optional(),
    shippingMethodId: z.string().uuid("Bitte wählen Sie eine Versandart.").optional(),
    paymentMethod: z.string().min(1, "Bitte wählen Sie eine Zahlungsart.").max(40),
    acceptTerms: z.boolean().default(false),
    customerNote: optText(2000),
    acceptsMarketing: z.boolean().default(false),
    /** total the customer saw; when it differs the checkout stops with `price_changed` */
    expectedTotal: z.number().int().nonnegative().optional(),
    /** optional client key; the same key never creates two orders */
    idempotencyKey: optText(100),
  })
  .superRefine((v, ctx) => {
    if (v.shipToDifferentAddress && !v.shippingAddress) ctx.addIssue({ code: "custom", path: ["shippingAddress"], message: "Bitte geben Sie die Lieferadresse an." });
  });

export type CheckoutInput = z.input<typeof checkoutSchema>;

/** FormData (names like billing.firstName, shipping.city …) → CheckoutInput, for HTML forms. */
export function checkoutInputFromForm(f: FormData): CheckoutInput {
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const addr = (p: string) => ({ firstName: s(`${p}.firstName`), lastName: s(`${p}.lastName`), company: s(`${p}.company`), street: s(`${p}.street`), street2: s(`${p}.street2`), zip: s(`${p}.zip`), city: s(`${p}.city`), country: s(`${p}.country`) || "CH", phone: s(`${p}.phone`) });
  const b = (k: string) => ["on", "true", "1"].includes(s(k));
  const total = s("expectedTotal");
  return {
    email: s("email"),
    phone: s("phone"),
    billingAddress: addr("billing"),
    shipToDifferentAddress: b("shipToDifferentAddress"),
    shippingAddress: b("shipToDifferentAddress") ? addr("shipping") : undefined,
    shippingMethodId: s("shippingMethodId") || undefined,
    paymentMethod: s("paymentMethod"),
    acceptTerms: b("acceptTerms"),
    customerNote: s("customerNote"),
    acceptsMarketing: b("acceptsMarketing"),
    expectedTotal: total && /^\d+$/.test(total) ? Number(total) : undefined,
    idempotencyKey: s("idempotencyKey") || undefined,
  };
}

/* --------------------------------------------------------------- results */

export type OrderSummary = {
  id: string;
  number: number;
  label: string;
  accessToken: string;
  status: OrderRow["status"];
  paymentStatus: OrderRow["paymentStatus"];
  paymentMethod: string;
  email: string;
  total: number;
  currency: string;
};

export type PlaceOrderResult = { order: OrderSummary; payment: PaymentStart; existing: boolean };

export type CheckoutContext = {
  /** signed-in customer */
  customerId?: string | null;
  ip?: string;
  /** "storefront", "api", "admin" … */
  source?: string;
  /** where the payment provider sends the customer back (default: built-in storefront) */
  returnUrls?: ReturnUrls;
};

async function summary(o: OrderRow): Promise<OrderSummary> {
  return { id: o.id, number: o.number, label: await orderLabel(o), accessToken: o.accessToken, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod, email: o.email, total: o.total, currency: o.currency };
}

const cleanAddress = (a: z.infer<typeof addressSchema>): Address => ({
  firstName: a.firstName,
  lastName: a.lastName,
  ...(a.company ? { company: a.company } : {}),
  street: a.street,
  ...(a.street2 ? { street2: a.street2 } : {}),
  zip: a.zip,
  city: a.city,
  country: a.country,
  ...(a.phone ? { phone: a.phone } : {}),
});

async function findOrderByEvent(key: "cartId" | "idempotencyKey", value: string) {
  const [e] = await db
    .select({ orderId: orderEvents.orderId })
    .from(orderEvents)
    .where(and(eq(orderEvents.type, "created"), sql`${orderEvents.data}->>${key} = ${value}`))
    .limit(1);
  return e ? loadOrder(e.orderId) : null;
}

/** Payment state of an existing order (for double submits): the pending redirect or the instructions. */
async function resumePayment(o: OrderRow): Promise<PaymentStart> {
  const provider = getProvider(o.paymentMethod);
  const s = await getSettings("payments");
  if (provider && !provider.online && provider.instructions) {
    const i = await provider.instructions(o, s);
    if (i) return { type: "instructions", instructions: i };
  }
  if (o.status === "pending" && o.paymentStatus !== "paid") {
    const rows = await db.select().from(payments).where(and(eq(payments.orderId, o.id), eq(payments.status, "pending")));
    const last = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const url = (last?.raw.url ?? last?.raw.link) as string | undefined;
    if (url) return { type: "redirect", url, providerRef: last.providerRef ?? undefined };
  }
  return { type: "error", message: "Diese Bestellung wurde bereits aufgegeben." };
}

/* ------------------------------------------------------------------ main */

/**
 * Places the order for the cart of `cartToken`. Throws ShopError
 * (validation, cart_empty, out_of_stock, coupon_invalid, shipping_unavailable,
 * payment_unavailable, price_changed, forbidden) with a German message.
 */
export async function placeOrder(cartToken: string, rawInput: CheckoutInput, ctx: CheckoutContext = {}): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    throw new ShopError("validation", parsed.error.issues[0]?.message ?? "Bitte prüfen Sie Ihre Angaben.", { fieldErrors });
  }
  const input = parsed.data;
  const cartId = cartIdFor(cartToken);
  const [shop, paySettings] = await Promise.all([getSettings("shop"), getSettings("payments")]);

  if (input.idempotencyKey) {
    const prev = await findOrderByEvent("idempotencyKey", input.idempotencyKey);
    if (prev) return { order: await summary(prev), payment: await resumePayment(prev), existing: true };
  }
  if (!ctx.customerId && !shop.guestCheckout) throw new ShopError("forbidden", "Bitte melden Sie sich an oder erstellen Sie ein Kundenkonto, um zu bestellen.");
  if (shop.requireTerms && !input.acceptTerms) throw new ShopError("validation", "Bitte akzeptieren Sie die AGB.", { fieldErrors: { acceptTerms: "Bitte akzeptieren Sie die AGB." } });

  const billing = cleanAddress(input.billingAddress);
  const shippingAddr = input.shipToDifferentAddress && input.shippingAddress ? cleanAddress(input.shippingAddress) : null;
  const destination = (shippingAddr ?? billing).country;
  const provider = getProvider(input.paymentMethod);
  if (!provider) throw new ShopError("payment_unavailable", "Diese Zahlungsart ist nicht verfügbar.");

  const outcome = await db.transaction(async (tx) => {
    const [cart] = await tx.select().from(carts).where(eq(carts.id, cartId)).for("update");
    if (!cart) return { existingCart: true as const };
    const items = await tx.select().from(cartItems).where(eq(cartItems.cartId, cartId));
    if (!items.length) throw new ShopError("cart_empty", "Ihr Warenkorb ist leer.");
    const variants = await loadVariants(
      items.map((i) => i.variantId),
      tx,
      { lock: true },
    );

    // availability and stock
    const problems: string[] = [];
    for (const i of items) {
      const v = variants.get(i.variantId);
      const name = v ? (v.variantTitle ? `${v.productName} (${v.variantTitle})` : v.productName) : "Ein Artikel";
      if (!v || !isPurchasable(v)) problems.push(`${name} ist nicht mehr erhältlich.`);
      else {
        const max = maxQuantity(v);
        if (max !== null && i.quantity > max) problems.push(max === 0 ? `${name} ist ausverkauft.` : `Von ${name} sind nur noch ${max} Stück verfügbar.`);
      }
    }
    if (problems.length) throw new ShopError("out_of_stock", problems.join(" "), { problems });

    // customer
    let customerId = ctx.customerId ?? null;
    let hasAccount = false;
    if (customerId) {
      const [c] = await tx.select().from(customers).where(eq(customers.id, customerId));
      if (!c || c.disabled) throw new ShopError("forbidden", "Ihr Kundenkonto ist nicht aktiv. Bitte kontaktieren Sie uns.");
      hasAccount = Boolean(c.passwordHash);
    }

    // coupon (locked: usage limits hold even with parallel checkouts)
    const coupon = cart.couponCode ? await findCoupon(cart.couponCode, tx, { lock: true }) : null;
    if (cart.couponCode && !coupon) throw new ShopError("coupon_invalid", "Der Gutschein im Warenkorb ist nicht mehr gültig. Bitte entfernen Sie ihn.");
    const customerUses = coupon ? await couponUsesBy(coupon.code, { customerId, email: input.email }, tx) : 0;

    const shipping = await loadShipping(tx);
    const pricing = priceCart({
      lines: items.map((i) => {
        const v = variants.get(i.variantId)!;
        return { key: i.variantId, productId: v.productId, variantId: v.variantId, categoryIds: v.categoryIds, unitPrice: v.price, quantity: i.quantity, taxRateBp: v.taxRateBp, weightGrams: v.weightGrams, requiresShipping: v.productType === "physical" };
      }),
      pricesIncludeTax: shop.pricesIncludeTax,
      coupon,
      couponCustomerUses: customerUses,
      country: destination,
      shippingMethodId: input.shippingMethodId ?? null,
      zones: shipping.zones,
      methods: shipping.methods,
      defaultTaxRateBp: shipping.defaultTaxRateBp,
    });
    if (pricing.coupon?.error) throw new ShopError("coupon_invalid", pricing.coupon.error);
    if (pricing.requiresShipping) {
      if (shop.shipToCountries.length && !shop.shipToCountries.includes(destination)) throw new ShopError("shipping_unavailable", "In dieses Land liefern wir leider nicht.");
      if (pricing.shipping.error) throw new ShopError("shipping_unavailable", pricing.shipping.error);
      if (!pricing.shipping.selected) throw new ShopError("shipping_unavailable", "Bitte wählen Sie eine Versandart.", { fieldErrors: { shippingMethodId: "Bitte wählen Sie eine Versandart." } });
    }
    if (input.expectedTotal !== undefined && input.expectedTotal !== pricing.total)
      throw new ShopError("price_changed", "Der Gesamtbetrag hat sich geändert. Bitte prüfen Sie die Bestellung und bestätigen Sie erneut.", { total: pricing.total });

    // settings were read before the transaction (PGlite: no second connection inside it)
    if (!provider.isAvailable(paySettings, { total: pricing.total, country: destination, hasAccount, shippingMethodType: pricing.shipping.selected?.type ?? null })) throw new ShopError("payment_unavailable", "Diese Zahlungsart ist für diese Bestellung nicht verfügbar. Bitte wählen Sie eine andere.");

    // upsert customer by account or e-mail
    if (!customerId) {
      const [existing] = await tx
        .select()
        .from(customers)
        .where(sql`lower(${customers.email}) = ${input.email}`);
      if (existing) customerId = existing.id;
      else {
        const [c] = await tx
          .insert(customers)
          .values({ email: input.email, firstName: billing.firstName, lastName: billing.lastName, phone: input.phone ?? billing.phone ?? "", acceptsMarketing: input.acceptsMarketing, defaultAddress: shippingAddr ?? billing })
          .returning({ id: customers.id });
        customerId = c.id;
      }
    }
    const [cust] = await tx.select().from(customers).where(eq(customers.id, customerId));
    await tx
      .update(customers)
      .set({
        firstName: cust.firstName || billing.firstName,
        lastName: cust.lastName || billing.lastName,
        phone: cust.phone || input.phone || billing.phone || "",
        acceptsMarketing: cust.acceptsMarketing || input.acceptsMarketing,
        defaultAddress: cust.defaultAddress ?? shippingAddr ?? billing,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));

    // order
    const number = await nextOrderNumber(tx);
    const [order] = await tx
      .insert(orders)
      .values({
        number,
        accessToken: randomToken(24),
        customerId,
        email: input.email,
        phone: input.phone ?? billing.phone ?? "",
        status: provider.initial.status,
        paymentStatus: provider.initial.paymentStatus,
        currency: "CHF",
        pricesIncludeTax: shop.pricesIncludeTax,
        subtotal: pricing.subtotal,
        discountTotal: pricing.discountTotal,
        shippingTotal: pricing.shippingTotal,
        taxTotal: pricing.taxTotal,
        total: pricing.total,
        couponCode: pricing.coupon?.valid ? pricing.coupon.code : null,
        shippingMethodId: pricing.shipping.selected?.id ?? null,
        shippingMethodName: pricing.shipping.selected?.name ?? "",
        billingAddress: billing,
        shippingAddress: pricing.requiresShipping ? (shippingAddr ?? billing) : shippingAddr,
        customerNote: input.customerNote ?? "",
        paymentMethod: provider.key,
        source: ctx.source ?? "storefront",
        ip: ctx.ip ?? "",
      })
      .returning();
    await tx.insert(orderItems).values(
      pricing.lines.map((l) => {
        const v = variants.get(l.key)!;
        return {
          orderId: order.id,
          productId: v.productId,
          variantId: v.variantId,
          name: v.productName,
          variantTitle: v.variantTitle,
          sku: v.sku,
          imagePath: v.image,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          discount: l.discount,
          taxRateBp: l.taxRateBp,
          taxAmount: l.tax,
          total: l.total,
        };
      }),
    );
    const changed = await takeStock(
      items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      { tx, reference: `#${number}` },
    );
    if (coupon && pricing.coupon?.valid) await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1`, updatedAt: new Date() }).where(eq(coupons.id, coupon.id));
    await addOrderEvent(order.id, "created", `Bestellung aufgegeben (${provider.label}).`, { tx, internal: false, data: { cartId, idempotencyKey: input.idempotencyKey ?? null, source: ctx.source ?? "storefront", taxes: pricing.taxes, shippingTax: pricing.shipping.tax } });
    await tx.delete(carts).where(eq(carts.id, cartId));
    await syncCustomerStats(customerId, tx);
    return { existingCart: false as const, order, changed };
  });

  if (outcome.existingCart) {
    const prev = await findOrderByEvent("cartId", cartId);
    if (!prev) throw new ShopError("not_found", "Der Warenkorb wurde nicht gefunden oder ist abgelaufen.");
    return { order: await summary(prev), payment: await resumePayment(prev), existing: true };
  }

  const { order, changed } = outcome;
  await emit("order.created", { id: order.id, number: order.number, total: order.total, email: order.email, status: order.status, paymentMethod: order.paymentMethod });
  await checkLowStock(changed).catch(() => {});

  const payment = await startPayment(order, provider.key, paySettings, ctx.returnUrls);
  if (!provider.online) {
    const { announceOrder } = await import("./order-notify");
    await announceOrder(order.id).catch((e) => console.error("[checkout] mail", e));
  }
  const fresh = (await loadOrder(order.id)) ?? order;
  return { order: await summary(fresh), payment, existing: false };
}

async function startPayment(order: OrderRow, providerKey: string, settings: Awaited<ReturnType<typeof getSettings<"payments">>>, urls?: ReturnUrls): Promise<PaymentStart> {
  const provider = getProvider(providerKey)!;
  try {
    const items = await loadOrderItems(order.id);
    return await provider.start(order, items, settings, urls ?? (await defaultReturnUrls(order)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await addOrderEvent(order.id, "payment", `Zahlung konnte nicht gestartet werden: ${msg}`);
    return { type: "error", message: "Die Zahlung konnte nicht gestartet werden. Bitte versuchen Sie es erneut oder wählen Sie eine andere Zahlungsart." };
  }
}

/** Verifies the access token of an order (customer links). */
export async function orderForToken(orderId: string, token: string | null | undefined) {
  if (!token) return null;
  const o = await loadOrder(orderId);
  if (!o) return null;
  const { safeEqual } = await import("@/server/lib/crypto");
  return safeEqual(o.accessToken, token) ? o : null;
}

/** "Pay again" for an order still waiting for its online payment. */
export async function retryPayment(orderId: string, token: string, returnUrls?: ReturnUrls): Promise<PaymentStart> {
  const o = await orderForToken(orderId, token);
  if (!o) throw new ShopError("not_found", "Bestellung nicht gefunden.");
  if (o.status !== "pending" || o.paymentStatus === "paid") throw new ShopError("conflict", "Für diese Bestellung ist keine Zahlung mehr offen.");
  return startPayment(o, o.paymentMethod, await getSettings("payments"), returnUrls);
}

/**
 * Customer cancelled the online payment and wants to change the cart: the
 * waiting order is given up (stock and coupon released) and a new cart with
 * the same items is created.
 */
export async function restoreCartFromOrder(orderId: string, token: string): Promise<{ token: string; cart: CartView }> {
  const o = await orderForToken(orderId, token);
  if (!o) throw new ShopError("not_found", "Bestellung nicht gefunden.");
  if (o.status !== "pending" || o.paymentStatus === "paid") throw new ShopError("conflict", "Diese Bestellung kann nicht mehr geändert werden.");
  await markOrderPaymentFailed(o.id, { provider: o.paymentMethod, reason: "Zahlung abgebrochen, Warenkorb wiederhergestellt.", giveUp: true });
  const items = await loadOrderItems(o.id);
  const res = await createCart({ customerId: o.customerId, email: o.email });
  for (const i of items) if (i.variantId) await db.insert(cartItems).values({ cartId: res.cart.id, variantId: i.variantId, quantity: i.quantity }).onConflictDoNothing();
  if (o.couponCode) await db.update(carts).set({ couponCode: o.couponCode }).where(eq(carts.id, res.cart.id));
  return { token: res.token, cart: (await buildCartView(res.cart.id))! };
}
