/** Formatting shared by server and client (Swiss German conventions). */
const TZ = "Europe/Zurich";

/** 123450 → "CHF 1’234.50" */
export function money(cents: number | null | undefined, currency = "CHF") {
  const v = (cents ?? 0) / 100;
  return new Intl.NumberFormat("de-CH", { style: "currency", currency, minimumFractionDigits: 2 }).format(v);
}

/** Amount without currency: 123450 → "1’234.50" */
export function amount(cents: number | null | undefined) {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((cents ?? 0) / 100);
}

/** "12.50" / "12,50" / "12" → 1250 (null if not a valid amount) */
export function parseMoney(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const clean = String(input).trim().replace(/[’'\s]/g, "").replace(/^CHF/i, "").replace(",", ".");
  if (clean === "") return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export function centsToInput(cents: number | null | undefined) {
  return cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);
}

export const percent = (bp: number) => `${(bp / 100).toLocaleString("de-CH", { maximumFractionDigits: 2 })} %`;

export const number = (n: number) => new Intl.NumberFormat("de-CH").format(n);

const asDate = (d: Date | string | null | undefined) => (d ? (d instanceof Date ? d : new Date(d)) : null);

export function dateTime(d: Date | string | null | undefined) {
  const x = asDate(d);
  return x ? x.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }) : "–";
}

export function date(d: Date | string | null | undefined) {
  const x = asDate(d);
  return x ? x.toLocaleDateString("de-CH", { dateStyle: "medium", timeZone: TZ }) : "–";
}

/** "vor 5 Minuten", "gestern", … */
export function relative(d: Date | string | null | undefined, now = Date.now()) {
  const x = asDate(d);
  if (!x) return "–";
  const s = Math.round((x.getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("de-CH", { numeric: "auto" });
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(s, "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return date(x);
}

/** YYYY-MM-DD in Swiss time (for grouping per day) */
export function dayKey(d: Date) {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** "Über uns – Grösse & Mass" → "ueber-uns-groesse-mass" */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function orderNumber(n: number, prefix = "") {
  return `${prefix}${n}`;
}

export function fullName(a: { firstName?: string; lastName?: string } | null | undefined) {
  return [a?.firstName, a?.lastName].filter(Boolean).join(" ");
}
