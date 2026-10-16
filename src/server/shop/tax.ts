/**
 * Swiss VAT maths. Prices are usually entered including VAT (B2C), so the tax
 * is extracted: tax = gross × rate / (1 + rate). All values in Rappen.
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { taxClasses } from "@/server/db/schema";

/** VAT contained in a gross amount (prices incl. tax), rounded to the Rappen. */
export function taxFromGross(gross: number, rateBp: number) {
  if (!rateBp) return 0;
  return Math.round((gross * rateBp) / (10_000 + rateBp));
}

/** VAT on top of a net amount (prices excl. tax). */
export function taxOnNet(net: number, rateBp: number) {
  return Math.round((net * rateBp) / 10_000);
}

/** Swiss cash rounding to 5 Rappen (used for invoice/QR totals when wanted). */
export const roundTo5 = (cents: number) => Math.round(cents / 5) * 5;

export async function taxRateFor(taxClassId: string | null | undefined): Promise<number> {
  if (taxClassId) {
    const [t] = await db.select({ rateBp: taxClasses.rateBp }).from(taxClasses).where(eq(taxClasses.id, taxClassId));
    if (t) return t.rateBp;
  }
  const [d] = await db.select({ rateBp: taxClasses.rateBp }).from(taxClasses).where(eq(taxClasses.isDefault, true));
  return d?.rateBp ?? 0;
}

export async function allTaxClasses() {
  return db.select().from(taxClasses).orderBy(taxClasses.rateBp);
}
