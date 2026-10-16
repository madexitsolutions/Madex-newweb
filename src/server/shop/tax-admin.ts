/** Tax classes (MWST-Sätze): CRUD with exactly one default class. */
import { asc, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { products, productVariants, shippingMethods, taxClasses } from "@/server/db/schema";
import { audit, type Actor } from "@/server/audit";
import { fromZod, InputError } from "./errors";

export const taxClassInputSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben, z. B. «Normalsatz».").max(80),
  /** basis points: 8.1 % = 810 */
  rateBp: z.number({ invalid_type_error: "Bitte einen Steuersatz in Prozent eingeben, z. B. 8.1." }).int().min(0, "Der Steuersatz darf nicht negativ sein.").max(10_000, "Der Steuersatz darf höchstens 100 % sein."),
  isDefault: z.boolean().default(false),
});
export type TaxClassInput = z.input<typeof taxClassInputSchema>;

/** Tax classes with the number of products and shipping methods using them. */
export async function listTaxClasses() {
  const [rows, used, ship] = await Promise.all([
    db.select().from(taxClasses).orderBy(asc(taxClasses.rateBp), asc(taxClasses.name)),
    db.select({ id: products.taxClassId, n: count() }).from(products).groupBy(products.taxClassId),
    db.select({ id: shippingMethods.taxClassId, n: count() }).from(shippingMethods).groupBy(shippingMethods.taxClassId),
  ]);
  const p = new Map(used.map((u) => [u.id, u.n]));
  const s = new Map(ship.map((u) => [u.id, u.n]));
  return rows.map((r) => ({ ...r, products: p.get(r.id) ?? 0, shippingMethods: s.get(r.id) ?? 0, defaultProducts: r.isDefault ? (p.get(null) ?? 0) : 0 }));
}

export async function saveTaxClass(id: string | null, input: TaxClassInput, actor: Actor) {
  const r = taxClassInputSchema.safeParse(input);
  if (!r.success) throw fromZod(r.error);
  const t = r.data;
  const row = await db.transaction(async (tx) => {
    const all = await tx.select().from(taxClasses);
    const existing = id ? all.find((x) => x.id === id) : undefined;
    if (id && !existing) throw new InputError("Die Steuerklasse wurde nicht gefunden.");
    if (all.some((x) => x.id !== id && x.name.toLowerCase() === t.name.toLowerCase())) throw new InputError(`Die Steuerklasse «${t.name}» gibt es bereits.`, { name: "Name bereits vergeben." });
    // the first class is always the default; the default can only be moved, not removed
    const makeDefault = t.isDefault || all.filter((x) => x.id !== id).length === 0 || (existing?.isDefault ?? false);
    if (makeDefault) await tx.update(taxClasses).set({ isDefault: false }).where(id ? ne(taxClasses.id, id) : undefined);
    const values = { name: t.name, rateBp: t.rateBp, isDefault: makeDefault };
    const [saved] = existing ? await tx.update(taxClasses).set(values).where(eq(taxClasses.id, existing.id)).returning() : await tx.insert(taxClasses).values(values).returning();
    return saved;
  });
  await audit(actor, id ? "tax_class.updated" : "tax_class.created", { entityType: "tax_class", entityId: row.id, summary: `Steuerklasse ${id ? "bearbeitet" : "erstellt"}: ${row.name} (${row.rateBp / 100} %)` });
  return row;
}

export async function setDefaultTaxClass(id: string, actor: Actor) {
  const row = await db.transaction(async (tx) => {
    const [t] = await tx.select().from(taxClasses).where(eq(taxClasses.id, id));
    if (!t) throw new InputError("Die Steuerklasse wurde nicht gefunden.");
    await tx.update(taxClasses).set({ isDefault: false }).where(ne(taxClasses.id, id));
    await tx.update(taxClasses).set({ isDefault: true }).where(eq(taxClasses.id, id));
    return t;
  });
  await audit(actor, "tax_class.default", { entityType: "tax_class", entityId: id, summary: `Standard-Steuerklasse: ${row.name}` });
  return row;
}

/** Deletes a tax class. The default class can't be deleted; products using it fall back to the default. */
export async function deleteTaxClass(id: string, actor: Actor) {
  const [t] = await db.select().from(taxClasses).where(eq(taxClasses.id, id));
  if (!t) return null;
  if (t.isDefault) throw new InputError("Die Standard-Steuerklasse kann nicht gelöscht werden. Bestimmen Sie zuerst eine andere Klasse als Standard.");
  await db.delete(taxClasses).where(eq(taxClasses.id, id));
  await audit(actor, "tax_class.deleted", { entityType: "tax_class", entityId: id, summary: `Steuerklasse gelöscht: ${t.name}` });
  return t;
}

/** Number of variants that would change their tax when a class is deleted (for the confirm text). */
export async function taxClassUsage(id: string) {
  const [p] = await db.select({ n: count() }).from(products).where(eq(products.taxClassId, id));
  const [v] = await db.select({ n: count() }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).where(eq(products.taxClassId, id));
  return { products: p.n, variants: v.n };
}
