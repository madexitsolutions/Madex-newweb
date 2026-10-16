/**
 * Carts for the built-in storefront and the public API.
 *
 * A cart is identified by a random token held by the client (cookie or
 * `X-Cart-Token` header); only its sha256 hash is stored as `carts.id`, so a
 * database leak does not expose usable cart tokens.
 *
 * Every function returns a fully priced `CartView` (via pricing.ts) and throws
 * `ShopError` with a German message on invalid input.
 *
 *   const { token, cart } = await createCart();
 *   await addToCart(token, variantId, 2);
 *   await applyCoupon(token, "SOMMER10");
 *   const view = await getCart(token, { country: "CH", shippingMethodId });
 */
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { cartItems, carts } from "@/server/db/schema";
import { randomToken, sha256 } from "@/server/lib/crypto";
import { getSettings } from "@/server/settings";
import { ShopError } from "./errors";
import { couponUsesBy, findCoupon, isPurchasable, loadShipping, loadVariants, maxQuantity, type VariantInfo } from "./lines";
import { priceCart, type PricingResult } from "./pricing";

export const MAX_LINE_QUANTITY = 999;

export type CartOptions = {
  /** destination country for shipping (default: first country of shop.shipToCountries) */
  country?: string | null;
  /** chosen shipping method; without it the first available method is used as estimate */
  shippingMethodId?: string | null;
};

export type CartItemView = {
  id: string;
  variantId: string;
  productId: string;
  productSlug: string;
  name: string;
  variantTitle: string;
  sku: string | null;
  image: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  /** null = unlimited */
  maxQuantity: number | null;
  available: boolean;
  /** problem that blocks the checkout, as a German message */
  problem: string | null;
  subtotal: number;
  discount: number;
  total: number;
  taxRateBp: number;
};

export type CartView = {
  id: string;
  customerId: string | null;
  email: string | null;
  couponCode: string | null;
  items: CartItemView[];
  itemCount: number;
  /** false when an item is unavailable or exceeds the stock */
  checkoutReady: boolean;
  pricing: PricingResult;
  /** true when no shipping method was chosen and the first one is shown as estimate */
  shippingEstimated: boolean;
  updatedAt: Date;
};

export const cartIdFor = (token: string) => sha256(token);

async function cartRow(token: string) {
  if (!token || token.length < 16 || token.length > 200) return null;
  const [c] = await db.select().from(carts).where(eq(carts.id, cartIdFor(token)));
  return c ?? null;
}

async function requireCart(token: string) {
  const c = await cartRow(token);
  if (!c) throw new ShopError("not_found", "Der Warenkorb wurde nicht gefunden oder ist abgelaufen.");
  return c;
}

const touch = (id: string) => db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, id));

function itemProblem(v: VariantInfo | undefined, quantity: number): string | null {
  if (!v || !isPurchasable(v)) return "Dieser Artikel ist nicht mehr erhältlich. Bitte entfernen Sie ihn aus dem Warenkorb.";
  const max = maxQuantity(v);
  if (max !== null && quantity > max) return max === 0 ? "Dieser Artikel ist ausverkauft." : `Nur noch ${max} Stück verfügbar. Bitte reduzieren Sie die Menge.`;
  return null;
}

/** Builds the priced view of a cart (also used by the checkout page). */
export async function buildCartView(cartId: string, opts: CartOptions = {}): Promise<CartView | null> {
  const [c] = await db.select().from(carts).where(eq(carts.id, cartId));
  if (!c) return null;
  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cartId)).orderBy(asc(cartItems.createdAt));
  const [variants, shipping, shop] = await Promise.all([loadVariants(items.map((i) => i.variantId)), loadShipping(), getSettings("shop")]);
  const coupon = c.couponCode ? await findCoupon(c.couponCode) : null;
  const customerUses = coupon ? await couponUsesBy(coupon.code, { customerId: c.customerId, email: c.email }) : 0;
  const country = (opts.country ?? shop.shipToCountries[0] ?? null)?.toUpperCase() ?? null;

  const priced = items.filter((i) => {
    const v = variants.get(i.variantId);
    return v && isPurchasable(v);
  });
  const run = (shippingMethodId: string | null) =>
    priceCart({
      lines: priced.map((i) => {
        const v = variants.get(i.variantId)!;
        return { key: i.id, productId: v.productId, variantId: v.variantId, categoryIds: v.categoryIds, unitPrice: v.price, quantity: i.quantity, taxRateBp: v.taxRateBp, weightGrams: v.weightGrams, requiresShipping: v.productType === "physical" };
      }),
      pricesIncludeTax: shop.pricesIncludeTax,
      coupon: c.couponCode ? (coupon ?? { code: c.couponCode, type: "fixed", value: 0, active: false }) : null,
      couponCustomerUses: customerUses,
      country,
      shippingMethodId,
      zones: shipping.zones,
      methods: shipping.methods,
      defaultTaxRateBp: shipping.defaultTaxRateBp,
    });
  let pricing = run(opts.shippingMethodId ?? null);
  let shippingEstimated = false;
  if (!opts.shippingMethodId && pricing.shipping.methods.length) {
    pricing = run(pricing.shipping.methods[0].id);
    shippingEstimated = true;
  }

  const view: CartItemView[] = items.map((i) => {
    const v = variants.get(i.variantId);
    const line = pricing.lines.find((l) => l.key === i.id);
    return {
      id: i.id,
      variantId: i.variantId,
      productId: v?.productId ?? "",
      productSlug: v?.productSlug ?? "",
      name: v?.productName ?? "Artikel nicht mehr verfügbar",
      variantTitle: v?.variantTitle ?? "",
      sku: v?.sku ?? null,
      image: v?.image ?? null,
      unitPrice: v?.price ?? 0,
      compareAtPrice: v?.compareAtPrice ?? null,
      quantity: i.quantity,
      maxQuantity: v ? maxQuantity(v) : 0,
      available: Boolean(v && isPurchasable(v)),
      problem: itemProblem(v, i.quantity),
      subtotal: line?.subtotal ?? 0,
      discount: line?.discount ?? 0,
      total: line?.total ?? 0,
      taxRateBp: v?.taxRateBp ?? 0,
    };
  });
  return {
    id: c.id,
    customerId: c.customerId,
    email: c.email,
    couponCode: c.couponCode,
    items: view,
    itemCount: view.reduce((a, i) => a + i.quantity, 0),
    checkoutReady: view.length > 0 && view.every((i) => !i.problem),
    pricing,
    shippingEstimated,
    updatedAt: c.updatedAt,
  };
}

/** Creates an empty cart. The token is returned once – store it in a cookie / the client. */
export async function createCart(opts: { customerId?: string | null; email?: string | null } = {}): Promise<{ token: string; cart: CartView }> {
  const token = randomToken(24);
  const id = cartIdFor(token);
  await db.insert(carts).values({ id, customerId: opts.customerId ?? null, email: opts.email?.trim().toLowerCase() || null });
  return { token, cart: (await buildCartView(id))! };
}

export async function getCart(token: string, opts: CartOptions = {}): Promise<CartView | null> {
  const c = await cartRow(token);
  return c ? buildCartView(c.id, opts) : null;
}

/** Existing cart for the token, or a new one (returns the token to keep using). */
export async function getOrCreateCart(token: string | null | undefined, opts: CartOptions & { customerId?: string | null } = {}) {
  if (token) {
    const c = await cartRow(token);
    if (c) return { token, cart: (await buildCartView(c.id, opts))!, created: false };
  }
  const res = await createCart({ customerId: opts.customerId });
  return { ...res, created: true };
}

const qty = z.number().int().min(1).max(MAX_LINE_QUANTITY);

/** Adds a variant (or increases its quantity). Checks availability and stock. */
export async function addToCart(token: string, variantId: string, quantity = 1, opts: CartOptions = {}): Promise<CartView> {
  if (!qty.safeParse(quantity).success) throw new ShopError("validation", `Die Menge muss zwischen 1 und ${MAX_LINE_QUANTITY} liegen.`);
  const c = await requireCart(token);
  const v = (await loadVariants([variantId])).get(variantId);
  if (!v || !isPurchasable(v)) throw new ShopError("unavailable", "Dieser Artikel ist nicht erhältlich.");
  const [existing] = await db.select().from(cartItems).where(and(eq(cartItems.cartId, c.id), eq(cartItems.variantId, variantId)));
  const next = (existing?.quantity ?? 0) + quantity;
  checkStock(v, next);
  await db
    .insert(cartItems)
    .values({ cartId: c.id, variantId, quantity: next })
    .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.variantId], set: { quantity: next } });
  await touch(c.id);
  return (await buildCartView(c.id, opts))!;
}

function checkStock(v: VariantInfo, quantity: number) {
  if (quantity > MAX_LINE_QUANTITY) throw new ShopError("validation", `Pro Artikel sind höchstens ${MAX_LINE_QUANTITY} Stück möglich.`);
  const max = maxQuantity(v);
  const name = v.variantTitle ? `${v.productName} (${v.variantTitle})` : v.productName;
  if (max !== null && quantity > max)
    throw new ShopError("out_of_stock", max === 0 ? `«${name}» ist ausverkauft.` : `Von «${name}» sind nur noch ${max} Stück verfügbar.`, { variantId: v.variantId, available: max });
}

/** Sets the quantity of a cart line; 0 removes it. */
export async function updateCartItem(token: string, variantId: string, quantity: number, opts: CartOptions = {}): Promise<CartView> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_LINE_QUANTITY) throw new ShopError("validation", `Die Menge muss zwischen 0 und ${MAX_LINE_QUANTITY} liegen.`);
  const c = await requireCart(token);
  if (quantity === 0) return removeFromCart(token, variantId, opts);
  const [existing] = await db.select().from(cartItems).where(and(eq(cartItems.cartId, c.id), eq(cartItems.variantId, variantId)));
  if (!existing) throw new ShopError("not_found", "Dieser Artikel ist nicht im Warenkorb.");
  const v = (await loadVariants([variantId])).get(variantId);
  if (!v || !isPurchasable(v)) throw new ShopError("unavailable", "Dieser Artikel ist nicht mehr erhältlich. Bitte entfernen Sie ihn.");
  // lowering the quantity is always allowed, raising it only within the stock
  if (quantity > existing.quantity) checkStock(v, quantity);
  await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, existing.id));
  await touch(c.id);
  return (await buildCartView(c.id, opts))!;
}

export async function removeFromCart(token: string, variantId: string, opts: CartOptions = {}): Promise<CartView> {
  const c = await requireCart(token);
  await db.delete(cartItems).where(and(eq(cartItems.cartId, c.id), eq(cartItems.variantId, variantId)));
  await touch(c.id);
  return (await buildCartView(c.id, opts))!;
}

/** Applies a coupon code. Throws `coupon_invalid` with the reason when it can't be used. */
export async function applyCoupon(token: string, code: string, opts: CartOptions = {}): Promise<CartView> {
  const c = await requireCart(token);
  const clean = code.trim();
  if (!clean || clean.length > 64) throw new ShopError("coupon_invalid", "Bitte geben Sie einen Gutscheincode ein.");
  const coupon = await findCoupon(clean);
  if (!coupon || !coupon.active) throw new ShopError("coupon_invalid", "Dieser Gutscheincode ist ungültig.");
  await db.update(carts).set({ couponCode: coupon.code, updatedAt: new Date() }).where(eq(carts.id, c.id));
  const view = (await buildCartView(c.id, opts))!;
  if (view.pricing.coupon?.error) {
    await db.update(carts).set({ couponCode: c.couponCode }).where(eq(carts.id, c.id));
    throw new ShopError("coupon_invalid", view.pricing.coupon.error);
  }
  return view;
}

export async function removeCoupon(token: string, opts: CartOptions = {}): Promise<CartView> {
  const c = await requireCart(token);
  await db.update(carts).set({ couponCode: null, updatedAt: new Date() }).where(eq(carts.id, c.id));
  return (await buildCartView(c.id, opts))!;
}

export async function setCartEmail(token: string, email: string, opts: CartOptions = {}): Promise<CartView> {
  const parsed = z.string().trim().toLowerCase().email().max(200).safeParse(email);
  if (!parsed.success) throw new ShopError("validation", "Bitte geben Sie eine gültige E-Mail-Adresse ein.");
  const c = await requireCart(token);
  await db.update(carts).set({ email: parsed.data, updatedAt: new Date() }).where(eq(carts.id, c.id));
  return (await buildCartView(c.id, opts))!;
}

/**
 * After a customer signs in: attaches the (guest) cart of `token` to the
 * customer and merges the items of the customer's older carts into it
 * (quantities are added, capped at the available stock). The older carts are
 * deleted, the token stays valid.
 */
export async function mergeCustomerCart(token: string, customerId: string, opts: CartOptions = {}): Promise<CartView> {
  const c = await requireCart(token);
  await db.transaction(async (tx) => {
    const others = await tx
      .select({ id: carts.id, couponCode: carts.couponCode })
      .from(carts)
      .where(and(eq(carts.customerId, customerId), sql`${carts.id} <> ${c.id}`));
    if (others.length) {
      const otherItems = await tx
        .select()
        .from(cartItems)
        .where(
          inArray(
            cartItems.cartId,
            others.map((o) => o.id),
          ),
        );
      const mine = await tx.select().from(cartItems).where(eq(cartItems.cartId, c.id));
      const variants = await loadVariants(
        otherItems.map((i) => i.variantId),
        tx,
      );
      const wanted = new Map<string, number>();
      for (const i of mine) wanted.set(i.variantId, i.quantity);
      for (const i of otherItems) wanted.set(i.variantId, (wanted.get(i.variantId) ?? 0) + i.quantity);
      for (const [variantId, q] of wanted) {
        const v = variants.get(variantId);
        const own = mine.find((m) => m.variantId === variantId);
        if (!v && !own) continue;
        const max = v ? maxQuantity(v) : null;
        const capped = Math.min(q, MAX_LINE_QUANTITY, max === null ? Infinity : Math.max(max, own?.quantity ?? 0));
        if (capped <= 0) continue;
        await tx
          .insert(cartItems)
          .values({ cartId: c.id, variantId, quantity: capped })
          .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.variantId], set: { quantity: capped } });
      }
      const coupon = c.couponCode ?? others.find((o) => o.couponCode)?.couponCode ?? null;
      await tx.update(carts).set({ couponCode: coupon }).where(eq(carts.id, c.id));
      await tx.delete(carts).where(
        inArray(
          carts.id,
          others.map((o) => o.id),
        ),
      );
    }
    await tx.update(carts).set({ customerId, updatedAt: new Date() }).where(eq(carts.id, c.id));
  });
  return (await buildCartView(c.id, opts))!;
}

/** Removes all items and the coupon. */
export async function clearCart(token: string): Promise<CartView> {
  const c = await requireCart(token);
  await db.delete(cartItems).where(eq(cartItems.cartId, c.id));
  await db.update(carts).set({ couponCode: null, updatedAt: new Date() }).where(eq(carts.id, c.id));
  return (await buildCartView(c.id))!;
}

/** Housekeeping (cron): deletes carts not touched for `days` days. */
export async function purgeOldCarts(days = 60) {
  const res = await db
    .delete(carts)
    .where(lt(carts.updatedAt, new Date(Date.now() - days * 86_400_000)))
    .returning({ id: carts.id });
  return res.length;
}
