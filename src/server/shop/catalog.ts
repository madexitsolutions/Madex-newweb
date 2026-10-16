/**
 * Product catalogue: products with variants, images and category links.
 *
 * Every product has at least one variant. Without options it is a "simple"
 * product with exactly one variant (optionValues = []); with options (e.g.
 * Grösse × Farbe) there is one variant per combination. products.priceMin /
 * priceMax are a cache of the active variants' prices and are kept in sync here.
 * Stock changes always go through adjustStock() so the movement history stays complete.
 */
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/server/db";
import { categories, media, productCategories, productImages, products, productVariants, stockMovements, taxClasses, users } from "@/server/db/schema";
import { audit, type Actor } from "@/server/audit";
import { emit } from "@/server/events";
import { notify } from "@/server/notifications";
import { getSettings } from "@/server/settings";
import { mediaPath } from "@/server/media/store";
import { sanitizeHtml } from "@/server/lib/sanitize";
import { slugify } from "@/lib/format";
import { PRODUCT_STATUS, PRODUCT_TYPES, STATUS_LABEL, variantCombinations, variantKey, variantTitle, type ProductOption, type ProductStatus } from "@/lib/catalog";
import { adjustStock } from "./inventory";
import { descendantIds, loadCategories } from "./categories";
import { fromZod, InputError } from "./errors";

/* ------------------------------------------------------------------ input */

const MAX_MONEY = 100_000_000; // CHF 1 Mio. per unit is plenty
const money = z.number({ invalid_type_error: "Bitte einen Betrag eingeben." }).int().min(0, "Der Betrag darf nicht negativ sein.").max(MAX_MONEY, "Der Betrag ist zu hoch.");
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const variantInputSchema = z.object({
  id: z.string().uuid().optional(),
  optionValues: z.array(z.string().trim().min(1).max(100)).max(3).default([]),
  sku: optText(100),
  barcode: optText(100),
  price: money,
  compareAtPrice: money.nullish().transform((v) => v ?? null),
  costPrice: money.nullish().transform((v) => v ?? null),
  trackInventory: z.boolean().default(true),
  stock: z.number().int().min(-1_000_000).max(10_000_000).default(0),
  /** stock value the editor was loaded with; only the difference is applied (orders may have changed it meanwhile) */
  stockOriginal: z.number().int().nullish(),
  allowBackorder: z.boolean().default(false),
  weightGrams: z.number().int().min(0).max(10_000_000).nullish().transform((v) => v ?? null),
  imageId: z.string().uuid().nullish().transform((v) => v ?? null),
  active: z.boolean().default(true),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Produktnamen eingeben.").max(200, "Der Name ist zu lang (höchstens 200 Zeichen)."),
  slug: z.string().trim().max(120, "Die Adresse ist zu lang.").default(""),
  status: z.enum(PRODUCT_STATUS).default("draft"),
  type: z.enum(PRODUCT_TYPES).default("physical"),
  shortDescription: z.string().trim().max(1000, "Die Kurzbeschreibung ist zu lang (höchstens 1000 Zeichen).").default(""),
  description: z.string().max(200_000, "Die Beschreibung ist zu lang.").default(""),
  vendor: z.string().trim().max(120).default(""),
  tags: z.array(z.string().trim().min(1).max(60)).max(50, "Höchstens 50 Schlagwörter.").default([]),
  featured: z.boolean().default(false),
  taxClassId: z.string().uuid().nullish().transform((v) => v ?? null),
  seoTitle: optText(200),
  seoDescription: optText(400),
  categoryIds: z.array(z.string().uuid()).max(100).default([]),
  images: z.array(z.object({ mediaId: z.string().uuid(), alt: z.string().trim().max(300).default("") })).max(50, "Höchstens 50 Bilder pro Produkt.").default([]),
  options: z
    .array(z.object({ name: z.string().trim().min(1, "Bitte der Option einen Namen geben.").max(50), values: z.array(z.string().trim().min(1).max(100)).min(1, "Jede Option braucht mindestens einen Wert.").max(50) }))
    .max(3, "Höchstens 3 Optionen (z. B. Grösse, Farbe, Material).")
    .default([]),
  variants: z.array(variantInputSchema).min(1, "Das Produkt braucht mindestens eine Variante.").max(250, "Höchstens 250 Varianten pro Produkt."),
});

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductData = z.output<typeof productInputSchema>;
export type VariantInput = z.input<typeof variantInputSchema>;

/**
 * Validates and normalises a product (no database access): options and
 * variants must match, combinations are unique, compare-at prices are above
 * the price, SKUs are unique within the product. Throws InputError.
 */
export function validateProduct(input: ProductInput): ProductData {
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) throw fromZod(parsed.error);
  const p = parsed.data;
  const errors: Record<string, string> = {};

  p.tags = [...new Map(p.tags.map((t) => [t.toLowerCase(), t])).values()];
  p.categoryIds = [...new Set(p.categoryIds)];
  const seenMedia = new Set<string>();
  p.images = p.images.filter((i) => !seenMedia.has(i.mediaId) && seenMedia.add(i.mediaId));

  const optionNames = new Set<string>();
  p.options.forEach((o, i) => {
    const key = o.name.toLowerCase();
    if (optionNames.has(key)) errors[`options.${i}.name`] = `Die Option «${o.name}» gibt es zweimal.`;
    optionNames.add(key);
    const seen = new Set<string>();
    o.values = o.values.filter((v) => !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()));
  });
  const combos = variantCombinations(p.options).length;
  if (p.options.length && combos > 250) errors.options = `Diese Optionen ergeben ${combos} Varianten, möglich sind höchstens 250.`;

  if (!p.options.length) {
    if (p.variants.length !== 1) errors.variants = "Ein Produkt ohne Optionen hat genau eine Variante. Legen Sie Optionen an, um mehrere Varianten zu verwalten.";
    p.variants.forEach((v) => (v.optionValues = []));
  } else {
    const keys = new Set<string>();
    p.variants.forEach((v, i) => {
      if (v.optionValues.length !== p.options.length) {
        errors[`variants.${i}.optionValues`] = "Die Variante passt nicht zu den Optionen. Erzeugen Sie die Varianten neu.";
        return;
      }
      v.optionValues = v.optionValues.map((val, k) => p.options[k].values.find((x) => x.toLowerCase() === val.toLowerCase()) ?? val);
      const unknown = v.optionValues.find((val, k) => !p.options[k].values.includes(val));
      if (unknown) errors[`variants.${i}.optionValues`] = `Der Wert «${unknown}» gehört zu keiner Option.`;
      const key = variantKey(v.optionValues);
      if (keys.has(key)) errors[`variants.${i}.optionValues`] = `Die Variante «${variantTitle(v.optionValues)}» gibt es zweimal.`;
      keys.add(key);
    });
  }

  const skus = new Map<string, number>();
  p.variants.forEach((v, i) => {
    if (v.compareAtPrice !== null && v.compareAtPrice <= v.price) errors[`variants.${i}.compareAtPrice`] = "Der Vergleichspreis (früherer Preis) muss höher sein als der Preis – oder leer bleiben.";
    if (v.sku) {
      const k = v.sku.toLowerCase();
      if (skus.has(k)) errors[`variants.${i}.sku`] = `Die Artikelnummer ${v.sku} ist doppelt.`;
      skus.set(k, i);
    }
    if (!v.trackInventory) v.allowBackorder = false;
  });

  if (Object.keys(errors).length) {
    const first = Object.values(errors)[0];
    throw new InputError(Object.keys(errors).length === 1 ? first : "Bitte prüfen Sie die markierten Felder.", errors);
  }
  return p;
}

/** Lowest and highest price of the active variants (all variants when none is active). */
export function priceRange(variants: { price: number; active: boolean }[]) {
  const pool = variants.some((v) => v.active) ? variants.filter((v) => v.active) : variants;
  if (!pool.length) return { priceMin: 0, priceMax: 0 };
  const prices = pool.map((v) => v.price);
  return { priceMin: Math.min(...prices), priceMax: Math.max(...prices) };
}

/** Recomputes products.priceMin/priceMax from the variants. */
export async function syncPriceRange(productId: string, tx?: Tx) {
  const t = tx ?? db;
  const vs = await t.select({ price: productVariants.price, active: productVariants.active }).from(productVariants).where(eq(productVariants.productId, productId));
  const range = priceRange(vs);
  await t.update(products).set(range).where(eq(products.id, productId));
  return range;
}

/* ------------------------------------------------------------------ slugs */

/** Free product slug based on `base` ("t-shirt", "t-shirt-2", …). */
export async function uniqueProductSlug(base: string, excludeId?: string, tx?: Tx) {
  const root = slugify(base).slice(0, 90) || "produkt";
  const rows = await (tx ?? db)
    .select({ slug: products.slug })
    .from(products)
    .where(and(or(eq(products.slug, root), ilike(products.slug, `${root}-%`)), excludeId ? ne(products.id, excludeId) : undefined));
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(root)) return root;
  for (let i = 2; ; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
}

/* ------------------------------------------------------------------ save */

type SavedProduct = typeof products.$inferSelect;
type StockChange = { variantId: string; before: number; after: number };

/**
 * Creates (id = null) or replaces a product with all its parts: fields,
 * categories, images, options and variants. Variants are matched by id; new
 * ones are created, missing ones removed. Stock changes are recorded as
 * movements (reason "manual" or the given reason).
 */
export async function saveProduct(id: string | null, input: ProductInput, actor: Actor, opts: { stockReason?: "manual" | "import"; quiet?: boolean } = {}): Promise<SavedProduct> {
  const p = validateProduct(input);
  const reason = opts.stockReason ?? "manual";
  const existing = id ? (await db.select().from(products).where(eq(products.id, id)))[0] : undefined;
  if (id && !existing) throw new InputError("Das Produkt wurde nicht gefunden. Es wurde vielleicht gelöscht.");

  // slug: explicit ones must be free, otherwise derive a free one from the name
  let slug = slugify(p.slug);
  if (p.slug && !slug) throw new InputError("Die Adresse darf nur Buchstaben, Ziffern und Bindestriche enthalten.", { slug: "Nur Buchstaben, Ziffern und Bindestriche." });
  if (slug) {
    const [clash] = await db.select({ id: products.id, name: products.name }).from(products).where(and(eq(products.slug, slug), id ? ne(products.id, id) : undefined));
    if (clash) throw new InputError(`Die Adresse «${slug}» verwendet bereits «${clash.name}».`, { slug: `Bereits vergeben durch «${clash.name}». Wählen Sie eine andere Adresse.` });
  } else slug = await uniqueProductSlug(p.name, id ?? undefined);

  // SKUs must be unique across the shop (orders, imports and the API look them up)
  const skus = p.variants.map((v) => v.sku).filter((s): s is string => Boolean(s));
  if (skus.length) {
    const clashes = await db
      .select({ sku: productVariants.sku, name: products.name })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(inArray(productVariants.sku, skus), id ? ne(productVariants.productId, id) : undefined));
    if (clashes.length) {
      const fields: Record<string, string> = {};
      p.variants.forEach((v, i) => {
        const c = clashes.find((x) => x.sku === v.sku);
        if (c) fields[`variants.${i}.sku`] = `Wird bereits von «${c.name}» verwendet.`;
      });
      throw new InputError(`Die Artikelnummer ${clashes[0].sku} wird bereits von «${clashes[0].name}» verwendet.`, fields);
    }
  }

  if (p.taxClassId) {
    const [t] = await db.select({ id: taxClasses.id }).from(taxClasses).where(eq(taxClasses.id, p.taxClassId));
    if (!t) p.taxClassId = null;
  }
  const validCats = p.categoryIds.length ? (await db.select({ id: categories.id }).from(categories).where(inArray(categories.id, p.categoryIds))).map((c) => c.id) : [];
  const mediaIds = [...new Set([...p.images.map((i) => i.mediaId), ...p.variants.map((v) => v.imageId).filter((x): x is string => Boolean(x))])];
  const validMedia = new Set(mediaIds.length ? (await db.select({ id: media.id }).from(media).where(inArray(media.id, mediaIds))).map((m) => m.id) : []);

  const now = new Date();
  const changes: StockChange[] = [];
  const saved = await db.transaction(async (tx) => {
    const values = {
      slug,
      name: p.name,
      status: p.status,
      type: p.type,
      shortDescription: p.shortDescription,
      description: sanitizeHtml(p.description),
      vendor: p.vendor,
      tags: p.tags,
      options: p.options,
      taxClassId: p.taxClassId,
      featured: p.featured,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      updatedAt: now,
      publishedAt: p.status === "active" ? (existing?.publishedAt ?? now) : (existing?.publishedAt ?? null),
    };
    const [row] = existing ? await tx.update(products).set(values).where(eq(products.id, existing.id)).returning() : await tx.insert(products).values(values).returning();

    await tx.delete(productCategories).where(eq(productCategories.productId, row.id));
    if (validCats.length) await tx.insert(productCategories).values(validCats.map((categoryId) => ({ productId: row.id, categoryId })));

    await tx.delete(productImages).where(eq(productImages.productId, row.id));
    const imgs = p.images.filter((i) => validMedia.has(i.mediaId));
    if (imgs.length) await tx.insert(productImages).values(imgs.map((i, sort) => ({ productId: row.id, mediaId: i.mediaId, alt: i.alt, sort })));

    const current = await tx.select().from(productVariants).where(eq(productVariants.productId, row.id));
    const byId = new Map(current.map((v) => [v.id, v]));
    // a simple product keeps its single variant even when the client did not send the id
    if (!p.options.length && current.length === 1 && !p.variants[0].id) p.variants[0].id = current[0].id;
    // variants without id are matched by option values (e.g. after "Varianten erzeugen")
    for (const v of p.variants) {
      if (v.id && byId.has(v.id)) continue;
      const match = current.find((c) => variantKey(c.optionValues) === variantKey(v.optionValues) && !p.variants.some((o) => o.id === c.id));
      v.id = match?.id;
    }
    const keep = new Set(p.variants.map((v) => v.id).filter(Boolean));
    const removed = current.filter((v) => !keep.has(v.id)).map((v) => v.id);
    if (removed.length) await tx.delete(productVariants).where(inArray(productVariants.id, removed));

    for (const [sort, v] of p.variants.entries()) {
      const fields = {
        title: variantTitle(v.optionValues),
        optionValues: v.optionValues,
        sku: v.sku,
        barcode: v.barcode,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        costPrice: v.costPrice,
        trackInventory: v.trackInventory,
        allowBackorder: v.allowBackorder,
        weightGrams: v.weightGrams,
        imageId: v.imageId && validMedia.has(v.imageId) ? v.imageId : null,
        active: v.active,
        sort,
        updatedAt: now,
      };
      const old = v.id ? byId.get(v.id) : undefined;
      if (old) {
        await tx.update(productVariants).set(fields).where(eq(productVariants.id, old.id));
        const delta = v.stockOriginal !== undefined && v.stockOriginal !== null ? v.stock - v.stockOriginal : v.stock - old.stock;
        if (delta !== 0) {
          const after = await adjustStock(old.id, delta, reason, { userId: actor?.id, tx, reference: "Produkt bearbeitet" });
          changes.push({ variantId: old.id, before: after - delta, after });
        }
      } else {
        const [nv] = await tx.insert(productVariants).values({ ...fields, productId: row.id, stock: 0 }).returning({ id: productVariants.id });
        if (v.stock !== 0) {
          const after = await adjustStock(nv.id, v.stock, reason, { userId: actor?.id, tx, reference: existing ? "Neue Variante" : "Produkt erstellt" });
          changes.push({ variantId: nv.id, before: 0, after });
        }
      }
    }
    const range = await syncPriceRange(row.id, tx);
    return { ...row, ...range };
  });

  if (!opts.quiet) {
    await audit(actor, existing ? "product.updated" : "product.created", { entityType: "product", entityId: saved.id, summary: `${existing ? "Produkt bearbeitet" : "Produkt erstellt"}: ${saved.name}` });
    await emit(existing ? "product.updated" : "product.created", await productPayload(saved.id));
  }
  await notifyLowStock(changes);
  return saved;
}

/** Partial update (API, bulk tools): unspecified fields keep their current value. */
export async function patchProduct(id: string, patch: Partial<ProductInput>, actor: Actor) {
  const current = await productAsInput(id);
  if (!current) throw new InputError("Das Produkt wurde nicht gefunden.");
  return saveProduct(id, { ...current, ...patch }, actor);
}

/** Current product as ProductInput (for patching, duplicating and the editor). */
export async function productAsInput(id: string): Promise<ProductInput | null> {
  const full = await getProduct(id);
  if (!full) return null;
  const { product: p } = full;
  return {
    name: p.name,
    slug: p.slug,
    status: p.status,
    type: p.type,
    shortDescription: p.shortDescription,
    description: p.description,
    vendor: p.vendor,
    tags: p.tags,
    featured: p.featured,
    taxClassId: p.taxClassId,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    categoryIds: full.categoryIds,
    images: full.images.map((i) => ({ mediaId: i.mediaId, alt: i.alt })),
    options: p.options,
    variants: full.variants.map((v) => ({
      id: v.id,
      optionValues: v.optionValues,
      sku: v.sku,
      barcode: v.barcode,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      costPrice: v.costPrice,
      trackInventory: v.trackInventory,
      stock: v.stock,
      stockOriginal: v.stock,
      allowBackorder: v.allowBackorder,
      weightGrams: v.weightGrams,
      imageId: v.imageId,
      active: v.active,
    })),
  };
}

/** Payload for product.* webhooks. */
export async function productPayload(id: string) {
  const full = await getProduct(id);
  if (!full) return { id };
  const { product: p } = full;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    status: p.status,
    type: p.type,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    categoryIds: full.categoryIds,
    variants: full.variants.map((v) => ({ id: v.id, title: v.title, sku: v.sku, price: v.price, stock: v.stock, trackInventory: v.trackInventory, active: v.active })),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/**
 * Raises stock.low (webhook + in-app notification) for variants whose tracked
 * stock dropped to or below the shop's threshold. Call after stock changes.
 */
export async function notifyLowStock(changes: StockChange[]) {
  const dropped = changes.filter((c) => c.after < c.before);
  if (!dropped.length) return;
  const { lowStockThreshold } = await getSettings("shop");
  const rows = await db
    .select({ id: productVariants.id, title: productVariants.title, sku: productVariants.sku, stock: productVariants.stock, track: productVariants.trackInventory, productId: products.id, name: products.name })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, dropped.map((c) => c.variantId)));
  for (const r of rows) {
    if (!r.track || r.stock > lowStockThreshold) continue;
    const label = r.title ? `${r.name} – ${r.title}` : r.name;
    await emit("stock.low", { productId: r.productId, variantId: r.id, name: r.name, variant: r.title, sku: r.sku, stock: r.stock, threshold: lowStockThreshold });
    await notify({
      type: "stock.low",
      title: r.stock <= 0 ? `Ausverkauft: ${label}` : `Lagerbestand niedrig: ${label}`,
      body: `Noch ${r.stock} an Lager${r.sku ? ` (Art.-Nr. ${r.sku})` : ""}.`,
      href: `/admin/produkte/${r.productId}`,
      permission: "products.manage",
    });
  }
}

/* ------------------------------------------------------------------ read */

export async function getProduct(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) return null;
  const [variants, images, cats] = await Promise.all([
    db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.sort), asc(productVariants.createdAt)),
    db
      .select({ id: productImages.id, mediaId: productImages.mediaId, alt: productImages.alt, sort: productImages.sort, path: media.path, width: media.width, height: media.height, filename: media.filename })
      .from(productImages)
      .innerJoin(media, eq(media.id, productImages.mediaId))
      .where(eq(productImages.productId, id))
      .orderBy(asc(productImages.sort)),
    db.select({ id: productCategories.categoryId }).from(productCategories).where(eq(productCategories.productId, id)),
  ]);
  return { product, variants, images: images.map((i) => ({ ...i, url: mediaPath(i.path) })), categoryIds: cats.map((c) => c.id) };
}

export type ProductListParams = {
  q?: string;
  status?: ProductStatus | "";
  categoryId?: string;
  stock?: "out" | "low" | "";
  sort?: ProductSort;
  page?: number;
  perPage?: number;
};
export const PRODUCT_SORTS = {
  updated: "Zuletzt bearbeitet",
  created: "Neueste zuerst",
  name: "Name A–Z",
  price_asc: "Preis aufsteigend",
  price_desc: "Preis absteigend",
  stock: "Lagerbestand aufsteigend",
} as const;
export type ProductSort = keyof typeof PRODUCT_SORTS;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const sqlList = (ids: string[]) => sql.join(ids.map((i) => sql`${i}`), sql`, `);

function listConditions(p: ProductListParams, threshold: number, catIds: string[] | null): SQL[] {
  const conds: SQL[] = [];
  const q = p.q?.trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    conds.push(
      or(
        ilike(products.name, like),
        ilike(products.slug, like),
        ilike(products.vendor, like),
        sql`exists (select 1 from product_variants v where v.product_id = ${products.id} and (v.sku ilike ${like} or v.barcode ilike ${like}))`,
      )!,
    );
  }
  if (catIds) conds.push(catIds.length ? sql`exists (select 1 from product_categories pc where pc.product_id = ${products.id} and pc.category_id in (${sqlList(catIds)}))` : sql`false`);
  if (p.stock === "out") conds.push(sql`exists (select 1 from product_variants v where v.product_id = ${products.id} and v.active and v.track_inventory and v.stock <= 0)`);
  if (p.stock === "low") conds.push(sql`exists (select 1 from product_variants v where v.product_id = ${products.id} and v.active and v.track_inventory and v.stock > 0 and v.stock <= ${threshold})`);
  return conds;
}

/** Product list for the dashboard with stock summary, first image and category names. */
export async function listProducts(p: ProductListParams) {
  const perPage = p.perPage ?? 25;
  const page = Math.max(1, p.page ?? 1);
  const { lowStockThreshold } = await getSettings("shop");
  let catIds: string[] | null = null;
  if (p.categoryId) {
    const all = await loadCategories();
    catIds = all.some((c) => c.id === p.categoryId) ? [p.categoryId, ...descendantIds(all, p.categoryId)] : [];
  }
  const base = listConditions(p, lowStockThreshold, catIds);
  const where = and(...base, p.status ? eq(products.status, p.status) : undefined);

  const stockSum = sql<number>`(select coalesce(sum(v.stock), 0) from product_variants v where v.product_id = ${products.id} and v.track_inventory)`;
  const order =
    p.sort === "name"
      ? [asc(products.name)]
      : p.sort === "price_asc"
        ? [asc(products.priceMin), asc(products.name)]
        : p.sort === "price_desc"
          ? [desc(products.priceMax), asc(products.name)]
          : p.sort === "created"
            ? [desc(products.createdAt)]
            : p.sort === "stock"
              ? [asc(stockSum), asc(products.name)]
              : [desc(products.updatedAt)];

  const [rows, [{ total }], statusRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(...order)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ total: count() }).from(products).where(where),
    db.select({ status: products.status, n: count() }).from(products).where(and(...base)).groupBy(products.status),
  ]);
  const counts = { all: 0, active: 0, draft: 0, archived: 0 } as Record<"all" | ProductStatus, number>;
  for (const r of statusRows) {
    counts[r.status] = r.n;
    counts.all += r.n;
  }

  const ids = rows.map((r) => r.id);
  const [vars, imgs, cats] = ids.length
    ? await Promise.all([
        db
          .select({ productId: productVariants.productId, stock: productVariants.stock, track: productVariants.trackInventory, active: productVariants.active })
          .from(productVariants)
          .where(inArray(productVariants.productId, ids)),
        db
          .select({ productId: productImages.productId, path: media.path, alt: productImages.alt, sort: productImages.sort })
          .from(productImages)
          .innerJoin(media, eq(media.id, productImages.mediaId))
          .where(inArray(productImages.productId, ids))
          .orderBy(asc(productImages.sort)),
        db
          .select({ productId: productCategories.productId, name: categories.name, id: categories.id })
          .from(productCategories)
          .innerJoin(categories, eq(categories.id, productCategories.categoryId))
          .where(inArray(productCategories.productId, ids))
          .orderBy(asc(categories.name)),
      ])
    : [[], [], []];

  const list = rows.map((r) => {
    const vs = vars.filter((v) => v.productId === r.id);
    const tracked = vs.filter((v) => v.track && v.active);
    const img = imgs.find((i) => i.productId === r.id);
    return {
      ...r,
      image: img ? { url: mediaPath(img.path), alt: img.alt } : null,
      categories: cats.filter((c) => c.productId === r.id).map((c) => ({ id: c.id, name: c.name })),
      stock: {
        variants: vs.length,
        tracked: tracked.length,
        total: tracked.reduce((n, v) => n + v.stock, 0),
        out: tracked.filter((v) => v.stock <= 0).length,
        low: tracked.filter((v) => v.stock > 0 && v.stock <= lowStockThreshold).length,
      },
    };
  });
  return { rows: list, total, counts, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)), lowStockThreshold };
}

/** Movement history of a product's variants, newest first. */
export async function stockHistory(productId: string, opts: { variantId?: string; limit?: number } = {}) {
  return db
    .select({
      id: stockMovements.id,
      variantId: stockMovements.variantId,
      variantTitle: productVariants.title,
      sku: productVariants.sku,
      delta: stockMovements.delta,
      stockAfter: stockMovements.stockAfter,
      reason: stockMovements.reason,
      reference: stockMovements.reference,
      createdAt: stockMovements.createdAt,
      userName: users.name,
    })
    .from(stockMovements)
    .innerJoin(productVariants, eq(productVariants.id, stockMovements.variantId))
    .leftJoin(users, eq(users.id, stockMovements.userId))
    .where(and(eq(productVariants.productId, productId), opts.variantId ? eq(stockMovements.variantId, opts.variantId) : undefined))
    .orderBy(desc(stockMovements.createdAt))
    .limit(opts.limit ?? 30);
}

export const STOCK_REASON_LABEL: Record<string, string> = { order: "Bestellung", cancel: "Stornierung", refund: "Rückerstattung", manual: "Manuell", import: "Import", return: "Retoure" };

/** id + name of all products (for pickers such as coupon restrictions). */
export async function productChoices(limit = 1000) {
  return db.select({ id: products.id, name: products.name, status: products.status }).from(products).orderBy(asc(products.name)).limit(limit);
}

/* ------------------------------------------------------------------ actions */

/** Copies a product as a draft (SKUs cleared, stock 0). */
export async function duplicateProduct(id: string, actor: Actor) {
  const input = await productAsInput(id);
  if (!input) throw new InputError("Das Produkt wurde nicht gefunden.");
  const copy = await saveProduct(
    null,
    {
      ...input,
      name: `${input.name} (Kopie)`.slice(0, 200),
      slug: "",
      status: "draft",
      variants: input.variants.map((v) => ({ ...v, id: undefined, sku: null, barcode: null, stock: 0, stockOriginal: null })),
    },
    actor,
    { quiet: true },
  );
  await audit(actor, "product.created", { entityType: "product", entityId: copy.id, summary: `Produkt dupliziert: ${input.name} → ${copy.name}` });
  await emit("product.created", await productPayload(copy.id));
  return copy;
}

export async function deleteProducts(ids: string[], actor: Actor) {
  const valid = ids.filter((i) => z.string().uuid().safeParse(i).success);
  if (!valid.length) return 0;
  const rows = await db.delete(products).where(inArray(products.id, valid)).returning({ id: products.id, name: products.name, slug: products.slug });
  for (const r of rows) {
    await audit(actor, "product.deleted", { entityType: "product", entityId: r.id, summary: `Produkt gelöscht: ${r.name}` });
    await emit("product.deleted", { id: r.id, slug: r.slug, name: r.name });
  }
  return rows.length;
}

export const deleteProduct = (id: string, actor: Actor) => deleteProducts([id], actor);

export async function setProductsStatus(ids: string[], status: ProductStatus, actor: Actor) {
  const valid = ids.filter((i) => z.string().uuid().safeParse(i).success);
  if (!valid.length) return 0;
  const now = new Date();
  const rows = await db
    .update(products)
    .set({ status, updatedAt: now, ...(status === "active" ? { publishedAt: sql`coalesce(${products.publishedAt}, ${now})` } : {}) })
    .where(and(inArray(products.id, valid), ne(products.status, status)))
    .returning({ id: products.id, name: products.name });
  if (rows.length) await audit(actor, "product.status_changed", { entityType: "product", summary: `${rows.length} Produkt${rows.length === 1 ? "" : "e"} auf «${STATUS_LABEL[status]}» gesetzt`, data: { ids: rows.map((r) => r.id), status } });
  for (const r of rows) await emit("product.updated", await productPayload(r.id));
  return rows.length;
}

/** Sets the stock of one variant to an absolute value (manual count) and records the movement. */
export async function setVariantStock(variantId: string, stock: number, actor: Actor, reference = "Bestand gezählt") {
  if (!Number.isInteger(stock) || stock < -1_000_000 || stock > 10_000_000) throw new InputError("Bitte eine ganze Zahl als Lagerbestand eingeben.");
  const [v] = await db.select({ stock: productVariants.stock, productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, variantId));
  if (!v) throw new InputError("Die Variante wurde nicht gefunden.");
  const delta = stock - v.stock;
  if (!delta) return stock;
  const after = await adjustStock(variantId, delta, "manual", { userId: actor?.id, reference });
  await db.update(products).set({ updatedAt: new Date() }).where(eq(products.id, v.productId));
  await audit(actor, "stock.adjusted", { entityType: "product", entityId: v.productId, summary: `Lagerbestand ${v.stock} → ${after}` });
  await notifyLowStock([{ variantId, before: v.stock, after }]);
  return after;
}
