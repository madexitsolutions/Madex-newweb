/**
 * Loads what the price engine and the cart need about variants (product,
 * categories, VAT rate, image, stock) and the shipping configuration.
 */
import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import { coupons, media, orders, productCategories, productImages, products, productVariants, shippingMethods, shippingZones, taxClasses } from "@/server/db/schema";
import type { CouponInput, ShippingMethodInput, ShippingZoneInput } from "./pricing";

export type VariantInfo = {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  productStatus: "draft" | "active" | "archived";
  productType: "physical" | "digital" | "service";
  variantTitle: string;
  variantActive: boolean;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  trackInventory: boolean;
  stock: number;
  allowBackorder: boolean;
  weightGrams: number | null;
  taxRateBp: number;
  categoryIds: string[];
  /** /uploads/… path of the variant image or the first product image */
  image: string | null;
};

/** Variant can be bought at all (product active, variant active). */
export const isPurchasable = (v: VariantInfo) => v.productStatus === "active" && v.variantActive;

/** Highest quantity that can be ordered (null = unlimited). */
export const maxQuantity = (v: VariantInfo) => (v.trackInventory && !v.allowBackorder ? Math.max(0, v.stock) : null);

export async function loadVariants(variantIds: string[], tx?: Tx, opts: { lock?: boolean } = {}): Promise<Map<string, VariantInfo>> {
  const out = new Map<string, VariantInfo>();
  const ids = [...new Set(variantIds)];
  if (!ids.length) return out;
  const q = tx ?? db;
  if (opts.lock && tx) {
    // row locks in a stable order so concurrent checkouts can't deadlock
    await tx.select({ id: productVariants.id }).from(productVariants).where(inArray(productVariants.id, ids)).orderBy(asc(productVariants.id)).for("update");
  }
  const rows = await q
    .select({
      v: productVariants,
      p: { id: products.id, slug: products.slug, name: products.name, status: products.status, type: products.type, taxClassId: products.taxClassId },
      vImage: media.path,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(media, eq(productVariants.imageId, media.id))
    .where(inArray(productVariants.id, ids));
  if (!rows.length) return out;
  const productIds = [...new Set(rows.map((r) => r.p.id))];
  const [cats, imgs, classes] = await Promise.all([
    q.select().from(productCategories).where(inArray(productCategories.productId, productIds)),
    q
      .select({ productId: productImages.productId, path: media.path, sort: productImages.sort })
      .from(productImages)
      .innerJoin(media, eq(productImages.mediaId, media.id))
      .where(inArray(productImages.productId, productIds))
      .orderBy(asc(productImages.sort)),
    q.select().from(taxClasses),
  ]);
  const defaultRate = classes.find((c) => c.isDefault)?.rateBp ?? 0;
  const rateOf = (id: string | null) => (id ? (classes.find((c) => c.id === id)?.rateBp ?? defaultRate) : defaultRate);
  for (const r of rows) {
    const firstImage = imgs.find((i) => i.productId === r.p.id)?.path ?? null;
    const path = r.vImage ?? firstImage;
    out.set(r.v.id, {
      variantId: r.v.id,
      productId: r.p.id,
      productSlug: r.p.slug,
      productName: r.p.name,
      productStatus: r.p.status,
      productType: r.p.type,
      variantTitle: r.v.title,
      variantActive: r.v.active,
      sku: r.v.sku,
      price: r.v.price,
      compareAtPrice: r.v.compareAtPrice,
      trackInventory: r.v.trackInventory,
      stock: r.v.stock,
      allowBackorder: r.v.allowBackorder,
      weightGrams: r.v.weightGrams,
      taxRateBp: rateOf(r.p.taxClassId),
      categoryIds: cats.filter((c) => c.productId === r.p.id).map((c) => c.categoryId),
      image: path ? `/uploads/${path}` : null,
    });
  }
  return out;
}

/** Shipping zones and methods (with the VAT rate of the method's tax class). */
export async function loadShipping(tx?: Tx): Promise<{ zones: ShippingZoneInput[]; methods: ShippingMethodInput[]; defaultTaxRateBp: number }> {
  const q = tx ?? db;
  const [zones, methods, classes] = await Promise.all([q.select().from(shippingZones).orderBy(asc(shippingZones.sort)), q.select().from(shippingMethods).orderBy(asc(shippingMethods.sort)), q.select().from(taxClasses)]);
  const defaultTaxRateBp = classes.find((c) => c.isDefault)?.rateBp ?? 810;
  return {
    zones: zones.map((z) => ({ id: z.id, name: z.name, countries: z.countries, sort: z.sort })),
    methods: methods.map((m) => ({
      ...m,
      taxRateBp: m.taxClassId ? (classes.find((c) => c.id === m.taxClassId)?.rateBp ?? null) : null,
    })),
    defaultTaxRateBp,
  };
}

/** Coupon by code (case-insensitive). */
export async function findCoupon(code: string, tx?: Tx, opts: { lock?: boolean } = {}) {
  const clean = code.trim();
  if (!clean) return null;
  const q = (tx ?? db).select().from(coupons).where(sql`upper(${coupons.code}) = upper(${clean})`);
  const [c] = opts.lock && tx ? await q.for("update") : await q;
  return c ?? null;
}

export type CouponRow = NonNullable<Awaited<ReturnType<typeof findCoupon>>>;

export const toCouponInput = (c: CouponRow): CouponInput => c;

/** How often a customer (by account or e-mail) used a coupon in orders that still count. */
export async function couponUsesBy(code: string, who: { customerId?: string | null; email?: string | null }, tx?: Tx) {
  const conds = [];
  if (who.customerId) conds.push(eq(orders.customerId, who.customerId));
  if (who.email) conds.push(sql`lower(${orders.email}) = lower(${who.email})`);
  if (!conds.length) return 0;
  const [row] = await (tx ?? db)
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(sql`upper(${orders.couponCode}) = upper(${code})`, ne(orders.status, "cancelled"), ne(orders.status, "failed"), or(...conds)));
  return row?.n ?? 0;
}
