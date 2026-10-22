/**
 * Plugin "Weiterleitungen": exact-path redirects and a log of paths that were
 * not found. Both are used by src/app/(site)/[...slug] for unknown paths.
 */
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { notFoundHits, redirects } from "@/server/db/schema";
import { normalizePath } from "@/server/content/seo";

export type Redirect = typeof redirects.$inferSelect;

export function cleanTarget(raw: string): string | null {
  const v = raw.trim();
  if (/^https?:\/\/\S+$/i.test(v)) return v;
  return normalizePath(v);
}

export async function listRedirects() {
  return db.select().from(redirects).orderBy(desc(redirects.createdAt));
}

export async function saveRedirect(input: { id?: string | null; from: string; to: string; permanent: boolean }): Promise<{ ok: true; redirect: Redirect } | { ok: false; error: string; field?: string }> {
  const from = normalizePath(input.from);
  if (!from || from === "/") return { ok: false, error: "Geben Sie die alte Adresse als Pfad ein, z. B. /alte-seite.", field: "from" };
  if (from.startsWith("/admin") || from.startsWith("/api")) return { ok: false, error: "Adressen unter /admin und /api lassen sich nicht weiterleiten.", field: "from" };
  const to = cleanTarget(input.to);
  if (!to) return { ok: false, error: "Geben Sie das Ziel als Pfad (/neue-seite) oder vollständige Adresse (https://…) ein.", field: "to" };
  if (to === from) return { ok: false, error: "Ziel und alte Adresse sind gleich – das ergäbe eine Endlosschleife.", field: "to" };
  const [taken] = await db.select({ id: redirects.id }).from(redirects).where(eq(redirects.fromPath, from));
  if (taken && taken.id !== input.id) return { ok: false, error: `Für ${from} gibt es schon eine Weiterleitung. Bearbeiten Sie diese.`, field: "from" };
  const values = { fromPath: from, toUrl: to, permanent: input.permanent };
  const [row] = input.id ? await db.update(redirects).set(values).where(eq(redirects.id, input.id)).returning() : await db.insert(redirects).values(values).returning();
  if (!row) return { ok: false, error: "Die Weiterleitung wurde nicht gefunden." };
  await db.delete(notFoundHits).where(eq(notFoundHits.path, from));
  return { ok: true, redirect: row };
}

export async function deleteRedirect(id: string) {
  const [row] = await db.delete(redirects).where(eq(redirects.id, id)).returning();
  return row ?? null;
}

/** Target for a path, counting the hit. */
export async function resolveRedirect(path: string) {
  const [row] = await db.update(redirects).set({ hits: sql`${redirects.hits} + 1`, lastHitAt: new Date() }).where(eq(redirects.fromPath, path)).returning();
  return row ?? null;
}

export async function logNotFound(path: string, referrer = "") {
  if (path.length > 300 || /\.(php|env|git|asp|cgi)/i.test(path)) return; // bots probing for weaknesses
  await db
    .insert(notFoundHits)
    .values({ path, referrer: referrer.slice(0, 300) })
    .onConflictDoUpdate({ target: notFoundHits.path, set: { hits: sql`${notFoundHits.hits} + 1`, lastAt: new Date(), referrer: referrer.slice(0, 300) || sql`${notFoundHits.referrer}` } });
}

export async function listNotFound(limit = 50) {
  return db.select().from(notFoundHits).orderBy(desc(notFoundHits.lastAt)).limit(limit);
}

export async function clearNotFound(path?: string) {
  if (path) await db.delete(notFoundHits).where(eq(notFoundHits.path, path));
  else await db.delete(notFoundHits);
}
