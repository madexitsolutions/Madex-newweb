/**
 * Read-only queries for the built-in shop pages of the website (plugin "Shop"):
 * active products with images, variants and categories.
 */
import { and, asc, count, desc, eq, exists, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { categories, media, productCategories, productImages, productVariants, products } from "@/server/db/schema";
import { getSettings } from "@/server/settings";

export const STORE_SORTS = {
  empfohlen: { label: "Empfohlen", order: [desc(products.featured), desc(products.publishedAt), desc(products.createdAt)] },
  neu: { label: "Neueste", order: [desc(products.publishedAt), desc(products.createdAt)] },
  "preis-auf": { label: "Preis aufsteigend", order: [asc(products.priceMin), asc(products.name)] },
  "preis-ab": { label: "Preis absteigend", order: [desc(products.priceMax), asc(products.name)] },
  name: { label: "Name A–Z", order: [asc(products.name)] },
} as const;
export type StoreSort = keyof typeof STORE_SORTS;
export const isStoreSort = (s: string): s is StoreSort => s in STORE_SORTS;

/** Active and published (no date or a date in the past). */
function visible(now = new Date()): SQL {
  return and(eq(products.status, "active"), or(isNull(products.publishedAt), lte(products.publishedAt, now)))!;
}

const inStockSql = sql<boolean>`exists (select 1 from ${productVariants} pv where pv.product_id = "products"."id" and pv.active and (not pv.track_inventory or pv.allow_backorder or pv.stock > 0))`;

export type StoreCard = { id: string; slug: string; name: string; shortDescription: string; priceMin: number; priceMax: number; compareAt: number | null; image: string | null; imageAlt: string; inStock: boolean; featured: boolean };

export async function storeProducts(opts: { categorySlug?: string; q?: string; sort?: StoreSort; page?: number; perPage?: number; featuredOnly?: boolean } = {}) {
  const shop = await getSettings("shop");
  const perPage = opts.perPage ?? shop.productsPerPage;
  const page = Math.max(1, opts.page ?? 1);
  const conds: (SQL | undefined)[] = [visible()];
  let category: typeof categories.$inferSelect | null = null;
  if (opts.categorySlug) {
    [category] = await db.select().from(categories).where(eq(categories.slug, opts.categorySlug));
    if (!category) return { category: null, rows: [], total: 0, page, pages: 1 };
    conds.push(exists(db.select({ x: sql`1` }).from(productCategories).where(and(eq(productCategories.productId, products.id), eq(productCategories.categoryId, category.id)))));
  }
  if (opts.q) conds.push(or(ilike(products.name, `%${opts.q}%`), ilike(products.shortDescription, `%${opts.q}%`), sql`${products.tags}::text ilike ${"%" + opts.q + "%"}`));
  if (opts.featuredOnly) conds.push(eq(products.featured, true));
  if (!shop.showOutOfStock) conds.push(inStockSql);
  const where = and(...conds);
  const [{ n }] = await db.select({ n: count() }).from(products).where(where);
  const rows = await db
    .select({ p: products, inStock: inStockSql })
    .from(products)
    .where(where)
    .orderBy(...STORE_SORTS[opts.sort ?? "empfohlen"].order)
    .limit(perPage)
    .offset((page - 1) * perPage);
  const cards = await withImages(rows);
  return { category, rows: cards, total: n, page, pages: Math.max(1, Math.ceil(n / perPage)) };
}

async function withImages(rows: { p: typeof products.$inferSelect; inStock: boolean }[]): Promise<StoreCard[]> {
  const ids = rows.map((r) => r.p.id);
  if (!ids.length) return [];
  const [imgs, compare] = await Promise.all([
    db
      .select({ productId: productImages.productId, path: media.path, alt: productImages.alt, mediaAlt: media.alt })
      .from(productImages)
      .innerJoin(media, eq(productImages.mediaId, media.id))
      .where(inArray(productImages.productId, ids))
      .orderBy(asc(productImages.sort)),
    db
      .select({ productId: productVariants.productId, c: sql<number | null>`max(${productVariants.compareAtPrice})` })
      .from(productVariants)
      .where(and(inArray(productVariants.productId, ids), eq(productVariants.active, true)))
      .groupBy(productVariants.productId),
  ]);
  return rows.map(({ p, inStock }) => {
    const img = imgs.find((i) => i.productId === p.id);
    const c = compare.find((x) => x.productId === p.id)?.c ?? null;
    return { id: p.id, slug: p.slug, name: p.name, shortDescription: p.shortDescription, priceMin: p.priceMin, priceMax: p.priceMax, compareAt: c && c > p.priceMin ? Number(c) : null, image: img ? `/uploads/${img.path}` : null, imageAlt: img?.alt || img?.mediaAlt || p.name, inStock: Boolean(inStock), featured: p.featured };
  });
}

/** Categories that contain at least one visible product, in tree order. */
export async function storeCategories() {
  const rows = await db
    .select({ c: categories, n: count(products.id) })
    .from(categories)
    .leftJoin(productCategories, eq(productCategories.categoryId, categories.id))
    .leftJoin(products, and(eq(products.id, productCategories.productId), visible()))
    .groupBy(categories.id)
    .orderBy(asc(categories.sort), asc(categories.name));
  return rows.filter((r) => r.n > 0).map((r) => ({ id: r.c.id, slug: r.c.slug, name: r.c.name, parentId: r.c.parentId, count: r.n }));
}

export type StoreVariant = { id: string; title: string; optionValues: string[]; price: number; compareAtPrice: number | null; available: boolean; maxQuantity: number | null; image: string | null; sku: string | null };

export async function storeProduct(slug: string) {
  const [p] = await db.select().from(products).where(and(eq(products.slug, slug), visible()));
  if (!p) return null;
  const [variants, images, cats] = await Promise.all([
    db
      .select({ v: productVariants, path: media.path })
      .from(productVariants)
      .leftJoin(media, eq(productVariants.imageId, media.id))
      .where(and(eq(productVariants.productId, p.id), eq(productVariants.active, true)))
      .orderBy(asc(productVariants.sort)),
    db
      .select({ path: media.path, alt: productImages.alt, mediaAlt: media.alt, width: media.width, height: media.height })
      .from(productImages)
      .innerJoin(media, eq(productImages.mediaId, media.id))
      .where(eq(productImages.productId, p.id))
      .orderBy(asc(productImages.sort)),
    db.select({ slug: categories.slug, name: categories.name }).from(productCategories).innerJoin(categories, eq(categories.id, productCategories.categoryId)).where(eq(productCategories.productId, p.id)),
  ]);
  const vs: StoreVariant[] = variants.map(({ v, path }) => {
    const max = v.trackInventory && !v.allowBackorder ? Math.max(0, v.stock) : null;
    return { id: v.id, title: v.title, optionValues: v.optionValues, price: v.price, compareAtPrice: v.compareAtPrice, available: max === null || max > 0, maxQuantity: max, image: path ? `/uploads/${path}` : null, sku: v.sku };
  });
  return {
    product: p,
    variants: vs,
    images: images.map((i) => ({ url: `/uploads/${i.path}`, alt: i.alt || i.mediaAlt || p.name, width: i.width, height: i.height })),
    categories: cats,
  };
}

export type StoreProduct = NonNullable<Awaited<ReturnType<typeof storeProduct>>>;

/** Other visible products of the same categories (or the newest ones). */
export async function relatedProducts(productId: string, limit = 4) {
  const catIds = (await db.select({ id: productCategories.categoryId }).from(productCategories).where(eq(productCategories.productId, productId))).map((r) => r.id);
  const conds = [visible(), sql`${products.id} <> ${productId}`];
  if (catIds.length) conds.push(exists(db.select({ x: sql`1` }).from(productCategories).where(and(eq(productCategories.productId, products.id), inArray(productCategories.categoryId, catIds)))));
  const rows = await db.select({ p: products, inStock: inStockSql }).from(products).where(and(...conds)).orderBy(desc(products.featured), desc(products.createdAt)).limit(limit);
  return withImages(rows);
}

export async function storeSitemapEntries() {
  return db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products).where(visible());
}
