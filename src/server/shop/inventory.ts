/** Stock changes always go through here so the movement history stays complete. */
import { eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import { productVariants, stockMovements } from "@/server/db/schema";

export type StockReason = "order" | "cancel" | "refund" | "manual" | "import" | "return";

/** Adds `delta` (negative = remove) to a variant's stock and records the movement. Returns the new stock. */
export async function adjustStock(variantId: string, delta: number, reason: StockReason, opts: { reference?: string; userId?: string; tx?: Tx } = {}) {
  const run = async (t: Tx) => {
    const [v] = await t
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${delta}`, updatedAt: new Date() })
      .where(eq(productVariants.id, variantId))
      .returning({ stock: productVariants.stock, track: productVariants.trackInventory });
    if (!v) throw new Error("Variante nicht gefunden");
    await t.insert(stockMovements).values({ variantId, delta, stockAfter: v.stock, reason, reference: opts.reference ?? "", userId: opts.userId ?? null });
    return v.stock;
  };
  return opts.tx ? run(opts.tx) : db.transaction(run);
}

/** Sets an absolute stock value (manual count) and records the difference. */
export async function setStock(variantId: string, stock: number, opts: { reference?: string; userId?: string } = {}) {
  return db.transaction(async (t) => {
    const [v] = await t.select({ stock: productVariants.stock }).from(productVariants).where(eq(productVariants.id, variantId)).for("update");
    if (!v) throw new Error("Variante nicht gefunden");
    if (v.stock === stock) return stock;
    return adjustStock(variantId, stock - v.stock, "manual", { ...opts, tx: t });
  });
}
