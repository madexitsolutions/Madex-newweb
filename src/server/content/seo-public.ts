/**
 * SEO overrides for the public website, managed in the dashboard (/admin/seo).
 * Never throws: without a database (e.g. during the build) the page defaults apply.
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { seoEntries } from "@/server/db/schema";

const canQuery = () => process.env.NEXT_PHASE !== "phase-production-build";

export async function seoOverride(path: string) {
  if (!canQuery()) return null;
  try {
    const [row] = await db.select().from(seoEntries).where(eq(seoEntries.path, path));
    return row ?? null;
  } catch {
    return null;
  }
}

export async function noindexPaths(): Promise<Set<string>> {
  if (!canQuery()) return new Set();
  try {
    const rows = await db.select({ path: seoEntries.path }).from(seoEntries).where(eq(seoEntries.noindex, true));
    return new Set(rows.map((r) => r.path));
  } catch {
    return new Set();
  }
}
