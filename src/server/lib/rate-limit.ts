/** Fixed-window counters stored in the database (works across server restarts and instances). */
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { rateLimits } from "@/server/db/schema";

export async function hit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} < now() then ${resetAt.toISOString()}::timestamptz else ${rateLimits.resetAt} end`,
      },
    })
    .returning();
  return { allowed: row.count <= limit, remaining: Math.max(0, limit - row.count), resetAt: row.resetAt };
}

export async function clear(key: string) {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

export async function prune() {
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, new Date()));
}
