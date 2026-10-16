/** Catalogue helpers shared by server and client (labels, variant combinations, coupon codes). */

export const PRODUCT_STATUS = ["active", "draft", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUS)[number];
export const STATUS_LABEL: Record<ProductStatus, string> = { active: "Aktiv", draft: "Entwurf", archived: "Archiviert" };
export const STATUS_PILL: Record<ProductStatus, string> = { active: "ok", draft: "muted", archived: "warn" };

export const PRODUCT_TYPES = ["physical", "digital", "service"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export const TYPE_LABEL: Record<ProductType, string> = { physical: "Physisches Produkt", digital: "Digitales Produkt", service: "Dienstleistung" };

export type ProductOption = { name: string; values: string[] };

/** All combinations of the option values, in option order: [["S","Rot"],["S","Blau"],…]. */
export function variantCombinations(options: ProductOption[]): string[][] {
  const opts = options.filter((o) => o.name.trim() && o.values.length);
  if (!opts.length) return [[]];
  return opts.reduce<string[][]>((acc, o) => acc.flatMap((combo) => o.values.map((v) => [...combo, v])), [[]]);
}

export const variantTitle = (values: string[]) => values.join(" / ");
/** Stable key for matching variants by their option values (case-insensitive). */
export const variantKey = (values: string[]) => values.map((v) => v.trim().toLowerCase()).join("\u0001");

export const COUPON_TYPES = ["percent", "fixed", "free_shipping"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];
export const COUPON_TYPE_LABEL: Record<CouponType, string> = { percent: "Prozent", fixed: "Fester Betrag", free_shipping: "Gratisversand" };

/** Characters that can't be confused when read aloud or typed (no 0/O, 1/I/L). */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Random coupon code, e.g. "SOMMER-7KQ4MZ". Works in the browser and in Node. */
export function generateCouponCode(length = 8, prefix = "") {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
  const p = prefix.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return p ? `${p}-${body}` : body;
}
