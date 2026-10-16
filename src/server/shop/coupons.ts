/**
 * Coupon administration (create, edit, list, delete) and field validation.
 * Applying coupons to carts and orders lives in the commerce logic.
 * Codes are stored in upper case and are unique case-insensitively.
 */
import { and, asc, count, desc, eq, gt, ilike, isNotNull, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { coupons } from "@/server/db/schema";
import { audit, type Actor } from "@/server/audit";
import { COUPON_TYPES, generateCouponCode, type CouponType } from "@/lib/catalog";
import { fromZod, InputError } from "./errors";

export { generateCouponCode };

export type Coupon = typeof coupons.$inferSelect;

const optInt = (msg: string, min = 0) =>
  z
    .number({ invalid_type_error: msg })
    .int(msg)
    .min(min, msg)
    .max(1_000_000_000, msg)
    .nullish()
    .transform((v) => v ?? null);

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase().replace(/\s+/g, ""))
      .pipe(z.string().min(3, "Der Code braucht mindestens 3 Zeichen.").max(40, "Der Code darf höchstens 40 Zeichen haben.").regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Der Code darf nur Buchstaben (ohne Umlaute), Ziffern, - und _ enthalten.")),
    description: z.string().trim().max(500).default(""),
    type: z.enum(COUPON_TYPES, { errorMap: () => ({ message: "Bitte eine Art wählen." }) }),
    /** percent: basis points (10 % = 1000), fixed: Rappen, free_shipping: 0 */
    value: z.number({ invalid_type_error: "Bitte einen Wert eingeben." }).int().default(0),
    minSubtotal: optInt("Der Mindestbestellwert muss ein Betrag ab 0 sein."),
    usageLimit: optInt("Die Gesamtzahl muss eine ganze Zahl ab 1 sein.", 1),
    usageLimitPerCustomer: optInt("Die Anzahl pro Kunde muss eine ganze Zahl ab 1 sein.", 1),
    productIds: z.array(z.string().uuid()).max(500).default([]),
    categoryIds: z.array(z.string().uuid()).max(200).default([]),
    startsAt: z.date().nullish().transform((v) => v ?? null),
    endsAt: z.date().nullish().transform((v) => v ?? null),
    active: z.boolean().default(true),
  })
  .superRefine((c, ctx) => {
    if (c.type === "percent" && (c.value < 1 || c.value > 10_000)) ctx.addIssue({ code: "custom", path: ["value"], message: "Der Rabatt muss zwischen 0.01 und 100 % liegen." });
    if (c.type === "fixed" && c.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "Bitte einen Betrag über CHF 0.00 eingeben." });
    if (c.type === "fixed" && c.value > 100_000_000) ctx.addIssue({ code: "custom", path: ["value"], message: "Der Betrag ist zu hoch." });
    if (c.startsAt && c.endsAt && c.endsAt <= c.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Das Ende muss nach dem Beginn liegen." });
    if (c.usageLimit !== null && c.usageLimitPerCustomer !== null && c.usageLimitPerCustomer > c.usageLimit)
      ctx.addIssue({ code: "custom", path: ["usageLimitPerCustomer"], message: "Pro Kunde kann nicht öfter gelten als insgesamt." });
  })
  .transform((c) => ({ ...c, value: c.type === "free_shipping" ? 0 : c.value }));

export type CouponInput = z.input<typeof couponInputSchema>;
export type CouponData = z.output<typeof couponInputSchema>;

/** Validates coupon fields without touching the database. Throws InputError. */
export function validateCouponInput(input: CouponInput): CouponData {
  const r = couponInputSchema.safeParse(input);
  if (!r.success) throw fromZod(r.error);
  return r.data;
}

export type CouponStatus = "active" | "scheduled" | "expired" | "used_up" | "inactive";
export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = { active: "Aktiv", scheduled: "Geplant", expired: "Abgelaufen", used_up: "Aufgebraucht", inactive: "Deaktiviert" };
export const COUPON_STATUS_PILL: Record<CouponStatus, string> = { active: "ok", scheduled: "info", expired: "muted", used_up: "muted", inactive: "warn" };

export function couponStatus(c: Pick<Coupon, "active" | "startsAt" | "endsAt" | "usageLimit" | "usedCount">, now = new Date()): CouponStatus {
  if (!c.active) return "inactive";
  if (c.endsAt && c.endsAt <= now) return "expired";
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return "used_up";
  if (c.startsAt && c.startsAt > now) return "scheduled";
  return "active";
}

/** "10 %", "CHF 20.00", "Gratisversand" */
export function couponValueLabel(c: { type: CouponType; value: number }) {
  if (c.type === "percent") return `${(c.value / 100).toLocaleString("de-CH", { maximumFractionDigits: 2 })} %`;
  if (c.type === "fixed") return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(c.value / 100);
  return "Gratisversand";
}

export async function saveCoupon(id: string | null, input: CouponInput, actor: Actor) {
  const c = validateCouponInput(input);
  const [clash] = await db
    .select({ id: coupons.id })
    .from(coupons)
    .where(and(sql`upper(${coupons.code}) = ${c.code}`, id ? ne(coupons.id, id) : undefined));
  if (clash) throw new InputError(`Den Code ${c.code} gibt es bereits.`, { code: "Dieser Code ist schon vergeben. Wählen Sie einen anderen oder erzeugen Sie einen." });
  const values = { ...c, updatedAt: new Date() };
  let row: Coupon | undefined;
  if (id) [row] = await db.update(coupons).set(values).where(eq(coupons.id, id)).returning();
  else [row] = await db.insert(coupons).values(values).returning();
  if (!row) throw new InputError("Der Gutschein wurde nicht gefunden.");
  await audit(actor, id ? "coupon.updated" : "coupon.created", { entityType: "coupon", entityId: row.id, summary: `Gutschein ${id ? "bearbeitet" : "erstellt"}: ${row.code}` });
  return row;
}

export async function deleteCoupon(id: string, actor: Actor) {
  const [row] = await db.delete(coupons).where(eq(coupons.id, id)).returning();
  if (row) await audit(actor, "coupon.deleted", { entityType: "coupon", entityId: id, summary: `Gutschein gelöscht: ${row.code}` });
  return row ?? null;
}

export async function setCouponActive(id: string, active: boolean, actor: Actor) {
  const [row] = await db.update(coupons).set({ active, updatedAt: new Date() }).where(eq(coupons.id, id)).returning();
  if (row) await audit(actor, "coupon.updated", { entityType: "coupon", entityId: id, summary: `Gutschein ${active ? "aktiviert" : "deaktiviert"}: ${row.code}` });
  return row ?? null;
}

export async function getCoupon(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(coupons).where(eq(coupons.id, id));
  return row ?? null;
}

/** A code that is not used yet. */
export async function freshCouponCode(prefix = "") {
  for (let i = 0; i < 20; i++) {
    const code = generateCouponCode(8, prefix);
    const [hit] = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.code, code));
    if (!hit) return code;
  }
  return generateCouponCode(12, prefix);
}

function statusCondition(s: CouponStatus, now: Date): SQL | undefined {
  const notExpired = or(isNull(coupons.endsAt), gt(coupons.endsAt, now));
  const notUsedUp = or(isNull(coupons.usageLimit), sql`${coupons.usedCount} < ${coupons.usageLimit}`);
  if (s === "inactive") return eq(coupons.active, false);
  if (s === "expired") return and(eq(coupons.active, true), isNotNull(coupons.endsAt), lte(coupons.endsAt, now));
  if (s === "used_up") return and(eq(coupons.active, true), notExpired, isNotNull(coupons.usageLimit), sql`${coupons.usedCount} >= ${coupons.usageLimit}`);
  if (s === "scheduled") return and(eq(coupons.active, true), notExpired, notUsedUp, gt(coupons.startsAt, now));
  return and(eq(coupons.active, true), notExpired, notUsedUp, or(isNull(coupons.startsAt), lte(coupons.startsAt, now)));
}

export async function listCoupons(p: { q?: string; status?: CouponStatus | ""; page?: number; perPage?: number } = {}) {
  const now = new Date();
  const perPage = p.perPage ?? 25;
  const page = Math.max(1, p.page ?? 1);
  const q = p.q?.trim();
  const search = q ? or(ilike(coupons.code, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`), ilike(coupons.description, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)) : undefined;
  const where = and(search, p.status ? statusCondition(p.status, now) : undefined);
  const [rows, [{ total }], ...statusCounts] = await Promise.all([
    db
      .select()
      .from(coupons)
      .where(where)
      .orderBy(desc(coupons.createdAt), asc(coupons.code))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ total: count() }).from(coupons).where(where),
    ...(["active", "scheduled", "expired", "used_up", "inactive"] as CouponStatus[]).map((s) => db.select({ n: count() }).from(coupons).where(and(search, statusCondition(s, now)))),
  ]);
  const [active, scheduled, expired, usedUp, inactive] = statusCounts.map((r) => r[0].n);
  return {
    rows: rows.map((r) => ({ ...r, status: couponStatus(r, now) })),
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
    counts: { all: active + scheduled + expired + usedUp + inactive, active, scheduled, expired, used_up: usedUp, inactive },
  };
}
