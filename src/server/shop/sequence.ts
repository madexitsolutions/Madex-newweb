/** Gap-free order numbers (atomic counter row per sequence). */
import { sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import { sequences } from "@/server/db/schema";
import { getSettings } from "@/server/settings";

export async function nextOrderNumber(tx?: Tx): Promise<number> {
  const start = (await getSettings("shop")).orderNumberStart;
  const [row] = await (tx ?? db)
    .insert(sequences)
    .values({ key: "order", value: start })
    .onConflictDoUpdate({ target: sequences.key, set: { value: sql`${sequences.value} + 1` } })
    .returning({ value: sequences.value });
  return row.value;
}
