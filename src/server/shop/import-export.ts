/**
 * Product CSV export and import.
 *
 * Two import formats are recognised automatically:
 * - our own format (one row per variant, grouped by "handle" = slug), written by exportProductsCsv()
 * - the WooCommerce product export (English or German headers): simple and
 *   variable products with "Parent" + "Attribute n name / value(s)", categories
 *   as "A > B, C", images as URLs, regular/sale price, stock and backorders.
 *
 * planImport() is a dry run that reports errors per row; runImport() applies the
 * same plan (products with errors are skipped). Images are downloaded into the
 * media library; failures only produce a warning.
 */
import { randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { categories, media, productCategories, productImages, products, productVariants, taxClasses } from "@/server/db/schema";
import { audit, type Actor } from "@/server/audit";
import { emit } from "@/server/events";
import { ALLOWED, MAX_UPLOAD_BYTES, mediaUrl, saveUpload } from "@/server/media/store";
import { parseCsv, toCsv } from "@/server/lib/csv";
import { slugify } from "@/lib/format";
import { PRODUCT_STATUS, PRODUCT_TYPES, variantKey, type ProductOption, type ProductStatus, type ProductType } from "@/lib/catalog";
import { buildTree, ensureCategoryPath } from "./categories";
import { productPayload, saveProduct, validateProduct, type ProductInput, type VariantInput } from "./catalog";
import { InputError } from "./errors";

/* ================================================================ helpers */

/** Splits "a, b\, c" on unescaped commas (WooCommerce escapes commas in names with a backslash). */
export function splitList(value: string) {
  if (!value?.trim()) return [];
  return value
    .split(/(?<!\\),/)
    .map((s) => s.replace(/\\,/g, ",").trim())
    .filter(Boolean);
}
const joinList = (items: string[]) => items.map((s) => s.replace(/,/g, "\\,")).join(", ");

/** "19.90", "19,90", "1'234.50", "CHF 5" → Rappen; "" → null; invalid → NaN */
export function parsePrice(value: string): number | null {
  const v = String(value ?? "").trim().replace(/^CHF\s*/i, "").replace(/[’'\s]/g, "");
  if (!v) return null;
  const norm = /^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(v) ? v.replace(/\./g, "").replace(",", ".") : v.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(norm)) return NaN;
  return Math.round(Number(norm) * 100);
}

function parseIntStrict(value: string): number | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  if (!/^-?\d+(\.0+)?$/.test(v)) return NaN;
  return Math.round(Number(v));
}

const truthy = (v: string) => ["1", "yes", "ja", "true", "wahr", "x", "y"].includes(String(v ?? "").trim().toLowerCase());

/** Woo exports line breaks as literal "\n"; plain text becomes paragraphs. */
function wooText(value: string) {
  const t = String(value ?? "").replace(/\\r\\n|\\n/g, "\n").replace(/\r\n/g, "\n").trim();
  if (!t) return "";
  if (/<(p|br|ul|ol|h[1-6]|div|table|blockquote)\b/i.test(t)) return t;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return t
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const plain = (value: string) => wooText(value).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

/* ================================================================ export */

/** CSV of all products in our own format (one row per variant). */
export async function exportProductsCsv(filter: { ids?: string[] } = {}) {
  const [rows, vars, imgs, links, cats, taxes] = await Promise.all([
    filter.ids?.length ? db.select().from(products).where(inArray(products.id, filter.ids)).orderBy(asc(products.name)) : db.select().from(products).orderBy(asc(products.name)),
    db.select().from(productVariants).orderBy(asc(productVariants.sort)),
    db.select({ productId: productImages.productId, path: media.path, alt: productImages.alt, mediaId: media.id }).from(productImages).innerJoin(media, eq(media.id, productImages.mediaId)).orderBy(asc(productImages.sort)),
    db.select().from(productCategories),
    db.select().from(categories),
    db.select().from(taxClasses),
  ]);
  const tree = buildTree(cats);
  const catPath = new Map(tree.map((c) => [c.id, c.path.join(" > ")]));
  const taxName = new Map(taxes.map((t) => [t.id, t.name]));
  const mediaPathById = new Map(imgs.map((i) => [i.mediaId, i.path]));
  const extraMedia = vars.filter((v) => v.imageId && !mediaPathById.has(v.imageId)).map((v) => v.imageId!);
  if (extraMedia.length) for (const m of await db.select({ id: media.id, path: media.path }).from(media).where(inArray(media.id, extraMedia))) mediaPathById.set(m.id, m.path);

  const out: (string | number | null)[][] = [EXPORT_HEADERS];
  for (const p of rows) {
    const pv = vars.filter((v) => v.productId === p.id);
    const opts = p.options;
    pv.forEach((v, i) => {
      const first = i === 0;
      const optCols: (string | null)[] = [];
      for (let k = 0; k < 3; k++) optCols.push(opts[k]?.name ?? "", v.optionValues[k] ?? "");
      out.push([
        p.slug,
        first ? p.name : "",
        first ? p.status : "",
        first ? p.type : "",
        first ? p.shortDescription : "",
        first ? p.description : "",
        first ? p.vendor : "",
        first ? joinList(p.tags) : "",
        first ? joinList(links.filter((l) => l.productId === p.id).map((l) => catPath.get(l.categoryId)).filter((x): x is string => Boolean(x))) : "",
        first ? (p.featured ? 1 : 0) : "",
        first ? (p.taxClassId ? (taxName.get(p.taxClassId) ?? "") : "") : "",
        first ? (p.seoTitle ?? "") : "",
        first ? (p.seoDescription ?? "") : "",
        first ? joinList(imgs.filter((x) => x.productId === p.id).map((x) => mediaUrl(x.path))) : "",
        ...optCols,
        v.sku ?? "",
        v.barcode ?? "",
        (v.price / 100).toFixed(2),
        v.compareAtPrice !== null ? (v.compareAtPrice / 100).toFixed(2) : "",
        v.costPrice !== null ? (v.costPrice / 100).toFixed(2) : "",
        v.trackInventory ? v.stock : "",
        v.trackInventory ? 1 : 0,
        v.allowBackorder ? 1 : 0,
        v.weightGrams ?? "",
        v.active ? 1 : 0,
        v.imageId && mediaPathById.has(v.imageId) ? mediaUrl(mediaPathById.get(v.imageId)!) : "",
      ]);
    });
  }
  return toCsv(out, { bom: true });
}

export const EXPORT_HEADERS = [
  "handle",
  "name",
  "status",
  "type",
  "short_description",
  "description",
  "vendor",
  "tags",
  "categories",
  "featured",
  "tax_class",
  "seo_title",
  "seo_description",
  "images",
  "option1_name",
  "option1_value",
  "option2_name",
  "option2_value",
  "option3_name",
  "option3_value",
  "sku",
  "barcode",
  "price",
  "compare_at_price",
  "cost_price",
  "stock",
  "track_inventory",
  "allow_backorder",
  "weight_grams",
  "variant_active",
  "variant_image",
];

/* ================================================================ plan */

export type ImportFormat = "predashboard" | "woocommerce";

export type PlannedProduct = {
  key: string;
  /** CSV line numbers (the header is line 1) */
  lines: number[];
  name: string;
  action: "create" | "update" | "skip";
  existingId: string | null;
  input: ProductInput;
  imageUrls: string[];
  /** image URL per variant index */
  variantImageUrls: (string | null)[];
  categoryPaths: string[][];
  keepImages: boolean;
  keepCategories: boolean;
  errors: string[];
  warnings: string[];
};

export type ImportPlan = {
  format: ImportFormat;
  rows: number;
  products: PlannedProduct[];
  /** problems that don't belong to a product (unknown rows, unsupported types) */
  issues: { line: number; level: "error" | "warning"; message: string }[];
  summary: { create: number; update: number; skip: number; variants: number; images: number; categories: number };
};

type Row = { line: number; get: (field: string) => string; has: (field: string) => boolean; raw: Record<string, string> };

const MAX_ROWS = 20_000;

function makeRows(text: string, aliases: Record<string, string[]>): { rows: Row[]; headers: string[] } {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], headers: [] };
  const headers = table[0].map((h) => h.trim());
  const norm = headers.map((h) => h.toLowerCase().replace(/\s+/g, " "));
  const index = new Map<string, number>();
  for (const [field, names] of Object.entries(aliases)) {
    const i = norm.findIndex((h) => names.includes(h));
    if (i >= 0) index.set(field, i);
  }
  // attribute columns: "attribute 1 name" / "attribut 1 name" / "attribute 1 value(s)" / "attribut 1 wert(e)"
  norm.forEach((h, i) => {
    let m = h.match(/^attribut(?:e)? (\d+) name$/);
    if (m) index.set(`attr${m[1]}_name`, i);
    m = h.match(/^attribut(?:e)? (\d+) (?:value\(s\)|values?|wert\(e\)|werte?)$/);
    if (m) index.set(`attr${m[1]}_value`, i);
  });
  const rows = table.slice(1, MAX_ROWS + 1).map((cells, r) => {
    const raw = Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
    return {
      line: r + 2,
      raw,
      has: (f: string) => index.has(f),
      get: (f: string) => {
        const i = index.get(f);
        return i === undefined ? "" : String(cells[i] ?? "").trim();
      },
    };
  });
  return { rows, headers };
}

export function detectFormat(text: string): ImportFormat | null {
  const head = (parseCsv(text.slice(0, 20_000))[0] ?? []).map((h) => h.trim().toLowerCase());
  if (head.includes("handle") && (head.includes("price") || head.includes("name"))) return "predashboard";
  const woo = ["type", "typ", "regular price", "regulärer preis", "sku", "artikelnummer", "parent", "übergeordnetes produkt"];
  if (head.filter((h) => woo.includes(h)).length >= 2 && (head.includes("name") || head.includes("produktname"))) return "woocommerce";
  return null;
}

type Ctx = {
  taxByKey: Map<string, string>;
  defaultTaxId: string | null;
  bySlug: Map<string, { id: string; name: string }>;
  bySku: Map<string, { productId: string; variantId: string }>;
  existing: Map<string, { options: ProductOption[]; variants: { id: string; sku: string | null; optionValues: string[]; stock: number; trackInventory: boolean }[]; images: number; categories: number }>;
};

async function loadContext(): Promise<Ctx> {
  const [taxes, prods, vars, imgCounts, catCounts] = await Promise.all([
    db.select().from(taxClasses),
    db.select({ id: products.id, slug: products.slug, name: products.name, options: products.options }).from(products),
    db.select({ id: productVariants.id, productId: productVariants.productId, sku: productVariants.sku, optionValues: productVariants.optionValues, stock: productVariants.stock, trackInventory: productVariants.trackInventory }).from(productVariants).orderBy(asc(productVariants.sort)),
    db.select({ productId: productImages.productId }).from(productImages),
    db.select({ productId: productCategories.productId }).from(productCategories),
  ]);
  const taxByKey = new Map<string, string>();
  for (const t of taxes) {
    taxByKey.set(t.name.toLowerCase(), t.id);
    taxByKey.set(slugify(t.name), t.id);
  }
  // WooCommerce standard slugs
  const reduced = taxes.filter((t) => t.rateBp > 0 && !t.isDefault).sort((a, b) => a.rateBp - b.rateBp)[0];
  const zero = taxes.find((t) => t.rateBp === 0);
  if (reduced) ["reduced-rate", "reduced rate", "reduzierter-steuersatz", "ermässigter-steuersatz", "ermaessigter-steuersatz"].forEach((k) => !taxByKey.has(k) && taxByKey.set(k, reduced.id));
  if (zero) ["zero-rate", "zero rate", "nullsatz", "steuerfrei"].forEach((k) => !taxByKey.has(k) && taxByKey.set(k, zero.id));
  const existing: Ctx["existing"] = new Map();
  for (const p of prods) existing.set(p.id, { options: p.options, variants: [], images: 0, categories: 0 });
  for (const v of vars) existing.get(v.productId)?.variants.push(v);
  for (const i of imgCounts) existing.get(i.productId)!.images++;
  for (const c of catCounts) existing.get(c.productId)!.categories++;
  return {
    taxByKey,
    defaultTaxId: taxes.find((t) => t.isDefault)?.id ?? null,
    bySlug: new Map(prods.map((p) => [p.slug, { id: p.id, name: p.name }])),
    bySku: new Map(vars.filter((v) => v.sku).map((v) => [v.sku!.toLowerCase(), { productId: v.productId, variantId: v.id }])),
    existing,
  };
}

function resolveTax(ctx: Ctx, value: string, warnings: string[]): string | null {
  const v = value.trim().toLowerCase();
  if (!v || v === "standard" || v === "normalsatz" || v === "parent") return null;
  const id = ctx.taxByKey.get(v) ?? ctx.taxByKey.get(slugify(v));
  if (!id) warnings.push(`Steuerklasse «${value}» ist unbekannt – die Standard-Steuerklasse wird verwendet.`);
  return id === ctx.defaultTaxId ? null : (id ?? null);
}

/**
 * For updates: matches imported variants to existing ones (SKU, then option
 * values), sets stockOriginal so stock is applied as an absolute count and
 * keeps existing variants that are not in the file when the options match.
 */
function mergeWithExisting(ctx: Ctx, plan: PlannedProduct) {
  if (!plan.existingId) return;
  const ex = ctx.existing.get(plan.existingId);
  if (!ex) return;
  const input = plan.input;
  const opts = input.options ?? [];
  const sameOptions = ex.options.length === opts.length && ex.options.every((o, i) => o.name.toLowerCase() === opts[i].name.toLowerCase());
  const used = new Set<string>();
  for (const v of input.variants) {
    const bySku = v.sku ? ex.variants.find((e) => e.sku?.toLowerCase() === v.sku!.toLowerCase() && !used.has(e.id)) : undefined;
    const byOpt = !bySku && sameOptions ? ex.variants.find((e) => variantKey(e.optionValues) === variantKey(v.optionValues ?? []) && !used.has(e.id)) : undefined;
    const simple = !bySku && !byOpt && !opts.length && ex.variants.length === 1 && !ex.options.length ? ex.variants[0] : undefined;
    const match = bySku ?? byOpt ?? simple;
    if (match) {
      used.add(match.id);
      v.id = match.id;
      v.stockOriginal = match.stock;
      if (v.stock === undefined) {
        v.stock = match.stock;
        v.trackInventory = match.trackInventory;
      }
    }
  }
  if (sameOptions && opts.length) {
    const rest = ex.variants.filter((e) => !used.has(e.id));
    if (rest.length) {
      // keep variants that are not in the file; their option values join the option lists
      for (const e of rest) {
        e.optionValues.forEach((val, k) => {
          if (opts[k] && !opts[k].values.some((x) => x.toLowerCase() === val.toLowerCase())) opts[k].values.push(val);
        });
      }
      input.variants.push(...rest.map((e) => ({ id: e.id, keepExisting: true }) as unknown as VariantInput));
      plan.warnings.push(`${rest.length} bestehende Variante${rest.length === 1 ? " bleibt" : "n bleiben"} unverändert, weil sie nicht in der Datei ${rest.length === 1 ? "steht" : "stehen"}.`);
    }
  } else if (ex.variants.length > used.size) {
    plan.warnings.push("Die Optionen weichen vom bestehenden Produkt ab – die bisherigen Varianten werden durch die Varianten aus der Datei ersetzt.");
  }
  plan.keepImages = !plan.imageUrls.length || ex.images > 0;
  if (plan.imageUrls.length && ex.images > 0) plan.warnings.push("Das Produkt hat bereits Bilder – die Bilder aus der Datei werden nicht erneut geladen.");
  plan.keepCategories = !plan.categoryPaths.length;
}

/** Fills placeholders for kept variants with their current data (only needed when applying). */
async function hydrateKeptVariants(input: ProductInput) {
  const kept = input.variants.filter((v) => (v as unknown as { keepExisting?: boolean }).keepExisting);
  if (!kept.length) return;
  const rows = await db.select().from(productVariants).where(inArray(productVariants.id, kept.map((k) => k.id!)));
  input.variants = input.variants.map((v) => {
    if (!(v as unknown as { keepExisting?: boolean }).keepExisting) return v;
    const r = rows.find((x) => x.id === v.id)!;
    return { id: r.id, optionValues: r.optionValues, sku: r.sku, barcode: r.barcode, price: r.price, compareAtPrice: r.compareAtPrice, costPrice: r.costPrice, trackInventory: r.trackInventory, stock: r.stock, stockOriginal: r.stock, allowBackorder: r.allowBackorder, weightGrams: r.weightGrams, imageId: r.imageId, active: r.active };
  });
}

/** Dry-run validation without database writes (variants are checked like in the editor). */
function checkPlan(plan: PlannedProduct) {
  if (plan.errors.length) return;
  try {
    // kept variants are already valid in the database; validate only the imported ones
    const imported = plan.input.variants.filter((v) => !(v as unknown as { keepExisting?: boolean }).keepExisting);
    if (imported.length) validateProduct({ ...plan.input, images: [], categoryIds: [], variants: plan.input.options?.length ? imported : imported.slice(0, 1) });
  } catch (e) {
    if (e instanceof InputError) {
      const fields = Object.entries(e.fieldErrors ?? {});
      if (fields.length)
        for (const [k, msg] of fields) {
          const m = k.match(/^variants\.(\d+)\./);
          const v = m ? plan.input.variants[Number(m[1])] : null;
          plan.errors.push(v && (v.optionValues?.length || v.sku) ? `${v.optionValues?.join(" / ") || v.sku}: ${msg}` : msg);
        }
      else plan.errors.push(e.message);
    } else throw e;
  }
}

function summarise(format: ImportFormat, rows: number, list: PlannedProduct[], issues: ImportPlan["issues"]): ImportPlan {
  for (const p of list) {
    if (p.errors.length) p.action = "skip";
  }
  const cats = new Set(list.filter((p) => p.action !== "skip").flatMap((p) => p.categoryPaths.map((c) => c.join(" > ").toLowerCase())));
  return {
    format,
    rows,
    products: list,
    issues,
    summary: {
      create: list.filter((p) => p.action === "create").length,
      update: list.filter((p) => p.action === "update").length,
      skip: list.filter((p) => p.action === "skip").length,
      variants: list.filter((p) => p.action !== "skip").reduce((n, p) => n + p.input.variants.length, 0),
      images: list.filter((p) => p.action !== "skip" && !p.keepImages).reduce((n, p) => n + p.imageUrls.length, 0),
      categories: cats.size,
    },
  };
}

/* ---------------------------------------------------------------- own format */

const OWN_ALIASES: Record<string, string[]> = Object.fromEntries(EXPORT_HEADERS.map((h) => [h, [h, h.replace(/_/g, " ")]]));

function statusFrom(v: string): ProductStatus | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  const map: Record<string, ProductStatus> = { aktiv: "active", entwurf: "draft", archiviert: "archived", publish: "active", published: "active" };
  if ((PRODUCT_STATUS as readonly string[]).includes(s)) return s as ProductStatus;
  return map[s] ?? null;
}
function typeFrom(v: string): ProductType | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  const map: Record<string, ProductType> = { physisch: "physical", digital: "digital", dienstleistung: "service", virtual: "service" };
  if ((PRODUCT_TYPES as readonly string[]).includes(s)) return s as ProductType;
  return map[s] ?? null;
}

function planOwn(rows: Row[], ctx: Ctx): ImportPlan {
  const issues: ImportPlan["issues"] = [];
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const handle = slugify(r.get("handle") || r.get("name"));
    if (!handle) {
      issues.push({ line: r.line, level: "error", message: "Zeile ohne «handle» und ohne Namen – übersprungen." });
      continue;
    }
    if (!groups.has(handle)) groups.set(handle, []);
    groups.get(handle)!.push(r);
  }
  const list: PlannedProduct[] = [];
  for (const [handle, group] of groups) {
    const first = group.find((r) => r.get("name")) ?? group[0];
    const errors: string[] = [];
    const warnings: string[] = [];
    const status = statusFrom(first.get("status"));
    if (first.get("status") && !status) errors.push(`Zeile ${first.line}: Status «${first.get("status")}» ist unbekannt (active, draft oder archived).`);
    const type = typeFrom(first.get("type"));
    if (first.get("type") && !type) errors.push(`Zeile ${first.line}: Typ «${first.get("type")}» ist unbekannt (physical, digital oder service).`);
    const options: ProductOption[] = [];
    for (let k = 1; k <= 3; k++) {
      const name = first.get(`option${k}_name`);
      if (name) options.push({ name, values: [] });
    }
    const variants: VariantInput[] = [];
    const variantImageUrls: (string | null)[] = [];
    for (const r of group) {
      const values = options.map((_, k) => r.get(`option${k + 1}_value`));
      values.forEach((val, k) => {
        if (val && !options[k].values.includes(val)) options[k].values.push(val);
      });
      if (options.length && values.some((v) => !v)) {
        errors.push(`Zeile ${r.line}: Wert für «${options[values.findIndex((v) => !v)].name}» fehlt.`);
        continue;
      }
      const price = parsePrice(r.get("price"));
      const compare = parsePrice(r.get("compare_at_price"));
      const cost = parsePrice(r.get("cost_price"));
      const stock = parseIntStrict(r.get("stock"));
      const weight = parseIntStrict(r.get("weight_grams"));
      if (price === null) errors.push(`Zeile ${r.line}: Preis fehlt.`);
      if (Number.isNaN(price) || Number.isNaN(compare) || Number.isNaN(cost)) errors.push(`Zeile ${r.line}: Preis ist keine gültige Zahl (z. B. 19.90).`);
      if (Number.isNaN(stock)) errors.push(`Zeile ${r.line}: Lagerbestand «${r.get("stock")}» ist keine ganze Zahl.`);
      if (Number.isNaN(weight)) errors.push(`Zeile ${r.line}: Gewicht «${r.get("weight_grams")}» ist keine ganze Zahl (Gramm).`);
      const track = r.has("track_inventory") && r.get("track_inventory") !== "" ? truthy(r.get("track_inventory")) : stock !== null;
      variants.push({
        optionValues: values,
        sku: r.get("sku") || null,
        barcode: r.get("barcode") || null,
        price: price && !Number.isNaN(price) ? price : 0,
        compareAtPrice: compare && !Number.isNaN(compare) ? compare : null,
        costPrice: cost !== null && !Number.isNaN(cost) ? cost : null,
        trackInventory: track,
        stock: stock !== null && !Number.isNaN(stock) ? stock : track ? undefined : 0,
        allowBackorder: truthy(r.get("allow_backorder")),
        weightGrams: weight !== null && !Number.isNaN(weight) ? weight : null,
        active: r.get("variant_active") === "" ? true : truthy(r.get("variant_active")),
      });
      variantImageUrls.push(r.get("variant_image") || null);
    }
    const existing = ctx.bySlug.get(handle);
    const plan: PlannedProduct = {
      key: handle,
      lines: group.map((r) => r.line),
      name: first.get("name") || existing?.name || handle,
      action: existing ? "update" : "create",
      existingId: existing?.id ?? null,
      input: {
        name: first.get("name") || existing?.name || handle,
        slug: handle,
        status: status ?? "draft",
        type: type ?? "physical",
        shortDescription: first.get("short_description"),
        description: first.get("description"),
        vendor: first.get("vendor"),
        tags: splitList(first.get("tags")),
        featured: truthy(first.get("featured")),
        taxClassId: resolveTax(ctx, first.get("tax_class"), warnings),
        seoTitle: first.get("seo_title") || null,
        seoDescription: first.get("seo_description") || null,
        options,
        variants,
      },
      imageUrls: splitList(first.get("images")),
      variantImageUrls,
      categoryPaths: splitList(first.get("categories")).map((c) => c.split(">").map((s) => s.trim()).filter(Boolean)),
      keepImages: false,
      keepCategories: false,
      errors,
      warnings,
    };
    if (!first.get("name") && !existing) errors.push(`Zeile ${first.line}: Name fehlt.`);
    if (!variants.length && !errors.length) errors.push("Keine gültige Variante.");
    mergeWithExisting(ctx, plan);
    for (const v of plan.input.variants) if (v.stock === undefined) v.stock = 0;
    checkPlan(plan);
    list.push(plan);
  }
  return summarise("predashboard", rows.length, list, issues);
}

/* ---------------------------------------------------------------- WooCommerce */

const WOO_ALIASES: Record<string, string[]> = {
  id: ["id"],
  type: ["type", "typ"],
  sku: ["sku", "artikelnummer"],
  name: ["name", "produktname"],
  published: ["published", "veröffentlicht"],
  featured: ["is featured?", "ist hervorgehoben?", "hervorgehoben?", "hervorgehoben"],
  short: ["short description", "kurzbeschreibung"],
  description: ["description", "beschreibung"],
  taxStatus: ["tax status", "steuerstatus"],
  taxClass: ["tax class", "steuerklasse"],
  inStock: ["in stock?", "vorrätig?", "auf lager?"],
  stock: ["stock", "lager", "lagerbestand", "bestand"],
  backorders: ["backorders allowed?", "lieferrückstand erlaubt?", "rückstände erlaubt?", "lieferrückstände erlaubt?"],
  weightKg: ["weight (kg)", "gewicht (kg)"],
  weightG: ["weight (g)", "gewicht (g)"],
  weightLbs: ["weight (lbs)", "gewicht (lbs)"],
  weightOz: ["weight (oz)", "gewicht (oz)"],
  sale: ["sale price", "angebotspreis", "aktionspreis"],
  regular: ["regular price", "regulärer preis", "normalpreis"],
  categories: ["categories", "kategorien"],
  tags: ["tags", "schlagwörter", "schlagworte"],
  images: ["images", "bilder"],
  parent: ["parent", "übergeordnetes produkt", "eltern"],
  position: ["position"],
  brand: ["brands", "marken", "brand", "marke"],
  gtin: ["gtin, upc, ean, or isbn", "gtin, upc, ean oder isbn", "gtin", "ean"],
};

function wooWeight(r: Row): number | null | typeof NaN {
  const read = (f: string, factor: number) => {
    const v = r.get(f).replace(",", ".");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * factor) : NaN;
  };
  return read("weightKg", 1000) ?? read("weightG", 1) ?? read("weightLbs", 453.592) ?? read("weightOz", 28.3495);
}

function wooPrices(r: Row, errors: string[]) {
  const regular = parsePrice(r.get("regular"));
  const sale = parsePrice(r.get("sale"));
  if (Number.isNaN(regular)) errors.push(`Zeile ${r.line}: Regulärer Preis «${r.get("regular")}» ist keine gültige Zahl.`);
  if (Number.isNaN(sale)) errors.push(`Zeile ${r.line}: Angebotspreis «${r.get("sale")}» ist keine gültige Zahl.`);
  const reg = regular !== null && !Number.isNaN(regular) ? regular : null;
  const sal = sale !== null && !Number.isNaN(sale) ? sale : null;
  if (sal !== null && reg !== null && sal < reg) return { price: sal, compareAtPrice: reg, missing: false };
  if (reg !== null) return { price: reg, compareAtPrice: null, missing: false };
  if (sal !== null) return { price: sal, compareAtPrice: null, missing: false };
  return { price: 0, compareAtPrice: null, missing: true };
}

function wooStock(r: Row, errors: string[]) {
  const raw = r.get("stock");
  const stock = parseIntStrict(raw);
  if (Number.isNaN(stock)) errors.push(`Zeile ${r.line}: Lagerbestand «${raw}» ist keine ganze Zahl.`);
  const backorders = ["1", "notify", "yes", "ja"].includes(r.get("backorders").toLowerCase());
  const tracked = stock !== null && !Number.isNaN(stock);
  return { trackInventory: tracked, stock: tracked ? stock! : 0, allowBackorder: tracked && backorders, inStock: r.get("inStock") };
}

function wooAttributes(r: Row) {
  const out: { name: string; values: string[] }[] = [];
  for (let i = 1; i <= 20; i++) {
    if (!r.has(`attr${i}_name`)) continue;
    const name = r.get(`attr${i}_name`);
    if (!name) continue;
    out.push({ name: name.replace(/^pa_/, ""), values: splitList(r.get(`attr${i}_value`)) });
  }
  return out;
}

function planWoo(rows: Row[], ctx: Ctx): ImportPlan {
  const issues: ImportPlan["issues"] = [];
  const parents = new Map<string, { row: Row; plan: PlannedProduct; variations: Row[] }>();
  const list: PlannedProduct[] = [];
  const keyFor = (r: Row) => r.get("sku") || (r.get("id") ? `id:${r.get("id")}` : `zeile:${r.line}`);

  const baseProduct = (r: Row, errors: string[], warnings: string[]): Omit<ProductInput, "variants" | "options"> => {
    const published = r.get("published");
    const types = r.get("type").toLowerCase();
    return {
      name: r.get("name"),
      slug: "",
      status: published === "1" ? "active" : "draft",
      type: types.includes("downloadable") ? "digital" : types.includes("virtual") ? "service" : "physical",
      shortDescription: plain(r.get("short")).slice(0, 1000),
      description: wooText(r.get("description")),
      vendor: splitList(r.get("brand"))[0] ?? "",
      tags: splitList(r.get("tags")).slice(0, 50),
      featured: truthy(r.get("featured")),
      taxClassId: r.get("taxStatus").toLowerCase() === "none" ? (ctx.taxByKey.get("zero-rate") ?? null) : resolveTax(ctx, r.get("taxClass"), warnings),
      seoTitle: null,
      seoDescription: null,
    };
  };

  const existingFor = (r: Row, skus: string[]) => {
    for (const s of skus) {
      const hit = s ? ctx.bySku.get(s.toLowerCase()) : undefined;
      if (hit) return { id: hit.productId, via: "sku" as const };
    }
    const slug = slugify(r.get("name"));
    const bySlug = slug ? ctx.bySlug.get(slug) : undefined;
    return bySlug ? { id: bySlug.id, via: "name" as const } : null;
  };

  // pass 1: simple and variable products
  for (const r of rows) {
    const type = r.get("type").toLowerCase();
    if (type.includes("variation")) continue;
    const errors: string[] = [];
    const warnings: string[] = [];
    if (type.includes("grouped") || type.includes("gruppiert")) {
      issues.push({ line: r.line, level: "warning", message: `«${r.get("name") || "Ohne Namen"}» ist ein gruppiertes Produkt – solche Produkte werden nicht importiert.` });
      continue;
    }
    if (type.includes("external") || type.includes("extern")) {
      issues.push({ line: r.line, level: "warning", message: `«${r.get("name") || "Ohne Namen"}» ist ein externes Produkt (Affiliate-Link) – solche Produkte werden nicht importiert.` });
      continue;
    }
    if (!r.get("name")) errors.push(`Zeile ${r.line}: Name fehlt.`);
    const weight = wooWeight(r);
    if (Number.isNaN(weight)) errors.push(`Zeile ${r.line}: Gewicht ist keine gültige Zahl.`);
    const base = baseProduct(r, errors, warnings);
    const isVariable = type.includes("variable");
    const prices = wooPrices(r, errors);
    const stock = wooStock(r, errors);
    if (!isVariable && prices.missing) errors.push(`Zeile ${r.line}: Preis fehlt (Spalte «Regular price» bzw. «Regulärer Preis»).`);
    const plan: PlannedProduct = {
      key: keyFor(r),
      lines: [r.line],
      name: base.name || `Zeile ${r.line}`,
      action: "create",
      existingId: null,
      input: {
        ...base,
        options: [],
        variants: isVariable
          ? []
          : [
              {
                optionValues: [],
                sku: r.get("sku") || null,
                barcode: r.get("gtin") || null,
                price: prices.price,
                compareAtPrice: prices.compareAtPrice,
                trackInventory: stock.trackInventory,
                stock: stock.trackInventory ? stock.stock : undefined,
                allowBackorder: stock.allowBackorder,
                weightGrams: weight !== null && !Number.isNaN(weight) ? weight : null,
                active: true,
              },
            ],
      },
      imageUrls: splitList(r.get("images")),
      variantImageUrls: [],
      categoryPaths: splitList(r.get("categories")).map((c) => c.split(">").map((s) => s.trim()).filter(Boolean)),
      keepImages: false,
      keepCategories: false,
      errors,
      warnings,
    };
    if (!isVariable && !stock.trackInventory && stock.inStock === "0") {
      plan.input.variants[0].trackInventory = true;
      plan.input.variants[0].stock = 0;
      warnings.push("Als «nicht vorrätig» markiert – Lagerbestand 0 wird erfasst.");
    }
    list.push(plan);
    if (isVariable) {
      const entry = { row: r, plan, variations: [] as Row[] };
      if (r.get("id")) parents.set(`id:${r.get("id")}`, entry);
      if (r.get("sku")) parents.set(r.get("sku").toLowerCase(), entry);
      if (!r.get("id") && !r.get("sku")) parents.set(`name:${r.get("name").toLowerCase()}`, entry);
    }
  }

  // pass 2: attach variations to their parent
  for (const r of rows) {
    if (!r.get("type").toLowerCase().includes("variation")) continue;
    const ref = r.get("parent");
    const parent = parents.get(ref.toLowerCase()) ?? parents.get(ref.startsWith("id:") ? ref : `id:${ref}`) ?? parents.get(`name:${ref.toLowerCase()}`);
    if (!parent) {
      issues.push({ line: r.line, level: "error", message: `Variante «${r.get("name") || r.get("sku") || "ohne Namen"}»: übergeordnetes Produkt «${ref || "leer"}» ist nicht in der Datei.` });
      continue;
    }
    parent.variations.push(r);
    parent.plan.lines.push(r.line);
  }

  for (const { row, plan, variations } of parents.values()) {
    if (plan.input.variants.length) continue; // reached through several keys
    const { errors, warnings } = plan;
    if (!variations.length) {
      errors.push(`Zeile ${row.line}: Das variable Produkt hat keine Varianten in der Datei.`);
      plan.input.variants = [{ optionValues: [], price: 0 }];
      continue;
    }
    variations.sort((a, b) => (Number(a.get("position")) || 0) - (Number(b.get("position")) || 0));
    const parentAttrs = wooAttributes(row);
    // options = attributes that the variations actually use
    const used: string[] = [];
    for (const v of variations) for (const a of wooAttributes(v)) if (a.values.length && !used.some((u) => u.toLowerCase() === a.name.toLowerCase())) used.push(a.name);
    if (used.length > 3) errors.push(`Zeile ${row.line}: ${used.length} Variantenattribute – möglich sind höchstens 3.`);
    const options: ProductOption[] = used.slice(0, 3).map((name) => ({ name, values: [...(parentAttrs.find((a) => a.name.toLowerCase() === name.toLowerCase())?.values ?? [])] }));
    const unusedAttrs = parentAttrs.filter((a) => !used.some((u) => u.toLowerCase() === a.name.toLowerCase()) && a.values.length);
    if (unusedAttrs.length) warnings.push(`Attribute ohne Varianten werden nicht übernommen: ${unusedAttrs.map((a) => `${a.name} (${a.values.join(", ")})`).join("; ")}.`);
    const parentWeight = wooWeight(row);
    const parentStock = wooStock(row, errors);
    for (const v of variations) {
      const attrs = wooAttributes(v);
      const values = options.map((o) => attrs.find((a) => a.name.toLowerCase() === o.name.toLowerCase())?.values[0] ?? "");
      const missing = values.findIndex((x) => !x);
      if (missing >= 0) {
        warnings.push(`Zeile ${v.line}: Variante gilt für «beliebige ${options[missing].name}» – das wird nicht unterstützt, die Variante wird übersprungen.`);
        continue;
      }
      values.forEach((val, k) => {
        if (!options[k].values.some((x) => x.toLowerCase() === val.toLowerCase())) options[k].values.push(val);
      });
      const vErrors: string[] = [];
      const prices = wooPrices(v, vErrors);
      if (prices.missing) vErrors.push(`Zeile ${v.line}: Preis der Variante ${values.join(" / ")} fehlt.`);
      const stock = wooStock(v, vErrors);
      const weight = wooWeight(v);
      errors.push(...vErrors);
      const shared = !stock.trackInventory && parentStock.trackInventory;
      plan.input.variants.push({
        optionValues: values,
        sku: v.get("sku") || null,
        barcode: v.get("gtin") || null,
        price: prices.price,
        compareAtPrice: prices.compareAtPrice,
        trackInventory: stock.trackInventory,
        stock: stock.trackInventory ? stock.stock : undefined,
        allowBackorder: stock.allowBackorder,
        weightGrams: weight !== null && !Number.isNaN(weight) ? weight : parentWeight !== null && !Number.isNaN(parentWeight) ? parentWeight : null,
        active: v.get("published") === "" || v.get("published") === "1",
      });
      plan.variantImageUrls.push(splitList(v.get("images"))[0] ?? null);
      if (shared) warnings.push(`Zeile ${v.line}: Der Lagerbestand wird in WooCommerce beim Hauptprodukt geführt – für die Variante wird kein Bestand erfasst.`);
    }
    plan.input.options = options;
    if (!plan.input.variants.length) {
      errors.push(`Zeile ${row.line}: Keine gültige Variante.`);
      plan.input.variants = [{ optionValues: [], price: 0 }];
    }
  }

  for (const plan of list) {
    const skus = plan.input.variants.map((v) => v.sku ?? "").filter(Boolean);
    const row = rows.find((r) => r.line === plan.lines[0])!;
    const hit = existingFor(row, [row.get("sku"), ...skus]);
    if (hit) {
      plan.existingId = hit.id;
      plan.action = "update";
      plan.input.slug = [...ctx.bySlug.entries()].find(([, p]) => p.id === hit.id)?.[0] ?? "";
      if (hit.via === "name") plan.warnings.push("Ein Produkt mit gleichem Namen existiert bereits und wird aktualisiert.");
    }
    mergeWithExisting(ctx, plan);
    for (const v of plan.input.variants) if (v.stock === undefined) v.stock = 0;
    checkPlan(plan);
  }

  // the same product twice in the file
  const seen = new Map<string, PlannedProduct>();
  for (const p of list) {
    if (!p.existingId) continue;
    const prev = seen.get(p.existingId);
    if (prev) p.errors.push(`Dasselbe Produkt wie in Zeile ${prev.lines[0]} – doppelt in der Datei.`);
    else seen.set(p.existingId, p);
  }
  return summarise("woocommerce", rows.length, list, issues);
}

/** Dry run: what the import would do, with errors and warnings per product and row. */
export async function planImport(text: string): Promise<ImportPlan> {
  const format = detectFormat(text);
  if (!format) throw new InputError("Das Dateiformat wurde nicht erkannt. Verwenden Sie unsere Exportdatei (Spalte «handle») oder den Produkt-Export von WooCommerce.");
  const ctx = await loadContext();
  if (format === "predashboard") return planOwn(makeRows(text, OWN_ALIASES).rows, ctx);
  return planWoo(makeRows(text, WOO_ALIASES).rows, ctx);
}

/* ================================================================ images */

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

function isPrivateAddress(ip: string) {
  const v4 = ip.replace(/^::ffff:/, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const [a, b] = v4.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const l = ip.toLowerCase();
  return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80");
}

/** Refuses URLs that point into the server's own network (SSRF protection). */
async function assertPublicUrl(u: URL) {
  if (!/^https?:$/.test(u.protocol)) throw new Error("nur http(s)-Adressen");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new Error("interne Adresse");
  const addrs = await lookup(host, { all: true });
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new Error("interne Adresse");
}

const EXT_MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif" };

function sniffMime(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.length > 4 && buf.readUInt32BE(0) === 0x89504e47) return "image/png";
  if (buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 4, 12).includes("ftypavi")) return "image/avif";
  return null;
}

/**
 * Downloads an image into the media library. Own /uploads/ URLs are reused
 * without downloading. Redirects are followed (max. 3) with the same checks.
 */
export async function importImage(url: string, opts: { userId?: string; fetcher?: Fetcher } = {}) {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new Error("ungültige Adresse");
  }
  const own = u.pathname.match(/^\/uploads\/(.+)$/);
  if (own) {
    const [m] = await db.select().from(media).where(eq(media.path, decodeURIComponent(own[1])));
    if (m) return m;
  }
  const fetcher: Fetcher = opts.fetcher ?? ((target, init) => fetch(target, init));
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    if (!opts.fetcher) await assertPublicUrl(u);
    res = await fetcher(u.toString(), { redirect: "manual", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "Predashboard-Import/1.0", accept: "image/*" } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      u = new URL(res.headers.get("location")!, u);
      continue;
    }
    break;
  }
  if (!res || !res.ok) throw new Error(res ? `HTTP ${res.status}` : "keine Antwort");
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_UPLOAD_BYTES) throw new Error("grösser als 10 MB");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_UPLOAD_BYTES) throw new Error("grösser als 10 MB");
  const header = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = (u.pathname.split(".").pop() ?? "").toLowerCase();
  const mime = sniffMime(buf) ?? (ALLOWED[header] && header !== "application/pdf" && header !== "image/svg+xml" ? header : EXT_MIME[ext]);
  if (!mime) throw new Error("kein unterstütztes Bildformat (JPG, PNG, WebP, GIF, AVIF)");
  const name = decodeURIComponent(u.pathname.split("/").pop() || "bild").slice(0, 120) || "bild";
  const file = new File([new Uint8Array(buf)], /\.[a-z0-9]+$/i.test(name) ? name : `${name}.${ALLOWED[mime]}`, { type: mime });
  return saveUpload(file, { userId: opts.userId, folder: "produkte" });
}

/* ================================================================ run */

export type ImportResult = { created: number; updated: number; skipped: number; images: number; warnings: string[]; errors: string[] };

/** Applies an import. Products with errors are skipped; image problems become warnings. */
export async function runImport(text: string, actor: Actor, opts: { downloadImages?: boolean; fetcher?: Fetcher } = {}): Promise<ImportResult> {
  const plan = await planImport(text);
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, images: 0, warnings: [], errors: [] };
  const catCache = new Map<string, string>();
  const imgCache = new Map<string, string | null>();
  const download = opts.downloadImages ?? true;

  const fetchImage = async (url: string, label: string) => {
    if (imgCache.has(url)) return imgCache.get(url)!;
    let id: string | null = null;
    if (download) {
      try {
        id = (await importImage(url, { userId: actor?.id, fetcher: opts.fetcher })).id;
        result.images++;
      } catch (e) {
        result.warnings.push(`${label}: Bild ${url} konnte nicht geladen werden (${e instanceof Error ? e.message : "Fehler"}).`);
      }
    }
    imgCache.set(url, id);
    return id;
  };

  for (const issue of plan.issues) (issue.level === "error" ? result.errors : result.warnings).push(`Zeile ${issue.line}: ${issue.message}`);
  for (const p of plan.products) {
    if (p.action === "skip") {
      result.skipped++;
      result.errors.push(`${p.name}: ${p.errors.join(" ")}`);
      continue;
    }
    try {
      const input = p.input;
      await hydrateKeptVariants(input);
      // categories
      if (p.keepCategories && p.existingId) {
        input.categoryIds = (await db.select({ id: productCategories.categoryId }).from(productCategories).where(eq(productCategories.productId, p.existingId))).map((c) => c.id);
      } else {
        const ids: string[] = [];
        for (const path of p.categoryPaths) {
          const id = await ensureCategoryPath(path, catCache);
          if (id) ids.push(id);
        }
        input.categoryIds = ids;
      }
      // images
      if (p.keepImages && p.existingId) {
        input.images = (await db.select({ mediaId: productImages.mediaId, alt: productImages.alt }).from(productImages).where(eq(productImages.productId, p.existingId)).orderBy(asc(productImages.sort))).map((i) => ({ mediaId: i.mediaId, alt: i.alt }));
      } else {
        input.images = [];
        for (const url of p.imageUrls) {
          const id = await fetchImage(url, p.name);
          if (id && !input.images.some((i) => i.mediaId === id)) input.images.push({ mediaId: id, alt: p.name });
        }
      }
      for (const [i, url] of p.variantImageUrls.entries()) {
        if (!url || !input.variants[i]) continue;
        const id = await fetchImage(url, p.name);
        if (!id) continue;
        input.variants[i].imageId = id;
        if (!input.images.some((x) => x.mediaId === id)) input.images.push({ mediaId: id, alt: p.name });
      }
      const saved = await saveProduct(p.existingId, input, actor, { stockReason: "import", quiet: true });
      await emit(p.existingId ? "product.updated" : "product.created", await productPayload(saved.id));
      if (p.existingId) result.updated++;
      else result.created++;
      result.warnings.push(...p.warnings.map((w) => `${p.name}: ${w}`));
    } catch (e) {
      result.skipped++;
      result.errors.push(`${p.name}: ${e instanceof Error ? e.message : "Unbekannter Fehler"}`);
    }
  }
  await audit(actor, "product.imported", {
    entityType: "product",
    summary: `Produktimport (${plan.format === "woocommerce" ? "WooCommerce" : "CSV"}): ${result.created} erstellt, ${result.updated} aktualisiert, ${result.skipped} übersprungen`,
    data: { ...result, warnings: result.warnings.slice(0, 50), errors: result.errors.slice(0, 50) },
  });
  return result;
}

/* ================================================================ temp files */

/** Uploaded import files wait here between preview and import (deleted after 24 h). */
function importDir() {
  return path.resolve(process.env.DATA_DIR || ".data", "imports");
}

export async function storeImportFile(text: string) {
  const dir = importDir();
  await mkdir(dir, { recursive: true });
  // clean up old files
  for (const f of await readdir(dir).catch(() => [] as string[])) {
    const s = await stat(path.join(dir, f)).catch(() => null);
    if (s && Date.now() - s.mtimeMs > 24 * 3600_000) await rm(path.join(dir, f), { force: true });
  }
  const token = randomBytes(16).toString("hex");
  await writeFile(path.join(dir, `${token}.csv`), text, "utf8");
  return token;
}

export async function readImportFile(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  return readFile(path.join(importDir(), `${token}.csv`), "utf8").catch(() => null);
}

export async function deleteImportFile(token: string) {
  if (/^[a-f0-9]{32}$/.test(token)) await rm(path.join(importDir(), `${token}.csv`), { force: true });
}

/** The result of a finished import is kept next to the uploads so the result page survives a reload (24 h). */
export async function storeImportResult(token: string, result: ImportResult) {
  if (!/^[a-f0-9]{32}$/.test(token)) return;
  await mkdir(importDir(), { recursive: true });
  await writeFile(path.join(importDir(), `${token}.result.json`), JSON.stringify(result), "utf8");
}

export async function readImportResult(token: string): Promise<ImportResult | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const raw = await readFile(path.join(importDir(), `${token}.result.json`), "utf8").catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImportResult;
  } catch {
    return null;
  }
}
