/** Fixtures for shop tests (products, carts, checkout input). */
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { categories, productCategories, products, productVariants, taxClasses } from "@/server/db/schema";
import { addToCart, createCart } from "@/server/shop/cart";
import type { CheckoutInput } from "@/server/shop/checkout";
import { saveSettings } from "@/server/settings";

let n = 0;

export async function makeProduct(o: { name?: string; price?: number; stock?: number; track?: boolean; backorder?: boolean; weight?: number; type?: "physical" | "digital" | "service"; category?: string; reduced?: boolean; status?: "active" | "draft" } = {}) {
  n++;
  const taxClassId = o.reduced ? (await db.select().from(taxClasses).where(eq(taxClasses.rateBp, 260)))[0]?.id : null;
  const [p] = await db
    .insert(products)
    .values({ name: o.name ?? `Produkt ${n}`, slug: `produkt-${n}-${Math.random().toString(36).slice(2, 7)}`, status: o.status ?? "active", type: o.type ?? "physical", taxClassId, priceMin: o.price ?? 2990, priceMax: o.price ?? 2990 })
    .returning();
  const [v] = await db
    .insert(productVariants)
    .values({ productId: p.id, price: o.price ?? 2990, stock: o.stock ?? 10, trackInventory: o.track ?? true, allowBackorder: o.backorder ?? false, weightGrams: o.weight ?? 300, sku: `SKU-${n}` })
    .returning();
  if (o.category) {
    let [c] = await db.select().from(categories).where(eq(categories.slug, o.category));
    if (!c) [c] = await db.insert(categories).values({ slug: o.category, name: o.category }).returning();
    await db.insert(productCategories).values({ productId: p.id, categoryId: c.id });
  }
  return { productId: p.id, variantId: v.id };
}

export async function stockOf(variantId: string) {
  const [v] = await db.select({ stock: productVariants.stock }).from(productVariants).where(eq(productVariants.id, variantId));
  return v.stock;
}

export async function cartWith(items: [string, number][]) {
  const { token } = await createCart();
  for (const [variantId, q] of items) await addToCart(token, variantId, q);
  return token;
}

export const address = { firstName: "Anna", lastName: "Muster", street: "Bahnhofstrasse 12", zip: "8001", city: "Zürich", country: "CH" };

export function checkoutInput(over: Partial<CheckoutInput> = {}): CheckoutInput {
  return { email: "anna@example.ch", billingAddress: address, paymentMethod: "bank_transfer", acceptTerms: true, ...over };
}

export async function shippingMethodId(name = "PostPac Economy") {
  const { shippingMethods } = await import("@/server/db/schema");
  const [m] = await db.select().from(shippingMethods).where(eq(shippingMethods.name, name));
  return m.id;
}

export async function enablePayments(extra: Record<string, unknown> = {}) {
  await saveSettings("payments", { bankTransferEnabled: true, bankIban: "CH5800791123000889012", bankAccountHolder: "Muster AG", invoiceEnabled: true, pickupPaymentEnabled: true, ...extra });
  await saveSettings("general", { companyName: "Muster AG", street: "Seestrasse 5", zip: "8002", city: "Zürich", country: "CH", email: "shop@muster.ch" });
}
