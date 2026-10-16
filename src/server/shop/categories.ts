/**
 * Product categories as a tree (parentId). Moving a category below itself or
 * one of its descendants is refused; deleting one moves its children up one
 * level and keeps the products (only the link is removed).
 */
import { and, asc, count, eq, ilike, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/server/db";
import { categories, media, productCategories } from "@/server/db/schema";
import { audit, type Actor } from "@/server/audit";
import { mediaPath } from "@/server/media/store";
import { sanitizeHtml } from "@/server/lib/sanitize";
import { slugify } from "@/lib/format";
import { fromZod, InputError } from "./errors";

export type CategoryRow = typeof categories.$inferSelect;
export type CategoryNode = CategoryRow & { depth: number; path: string[]; productCount: number; childCount: number; imageUrl: string | null };

export async function loadCategories(tx?: Tx) {
  return (tx ?? db).select().from(categories).orderBy(asc(categories.sort), asc(categories.name));
}

/** All ids below `id` (children, grandchildren …). */
export function descendantIds(all: { id: string; parentId: string | null }[], id: string): string[] {
  const out: string[] = [];
  const queue = [id];
  const seen = new Set([id]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const c of all) {
      if (c.parentId === cur && !seen.has(c.id)) {
        seen.add(c.id);
        out.push(c.id);
        queue.push(c.id);
      }
    }
  }
  return out;
}

/** True if making `parentId` the parent of `id` would create a loop. */
export function wouldCreateCycle(all: { id: string; parentId: string | null }[], id: string | null, parentId: string | null) {
  if (!id || !parentId) return false;
  if (id === parentId) return true;
  return descendantIds(all, id).includes(parentId);
}

/** Depth-first ordered list (parents before children, siblings by sort/name) with depth and path. */
export function buildTree<T extends { id: string; parentId: string | null; name: string; sort: number }>(rows: T[]): (T & { depth: number; path: string[] })[] {
  const ids = new Set(rows.map((r) => r.id));
  const children = new Map<string | null, T[]>();
  for (const r of rows) {
    const parent = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(r);
  }
  for (const list of children.values()) list.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "de-CH"));
  const out: (T & { depth: number; path: string[] })[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number, path: string[]) => {
    for (const r of children.get(parent) ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const p = [...path, r.name];
      out.push({ ...r, depth, path: p });
      walk(r.id, depth + 1, p);
    }
  };
  walk(null, 0, []);
  // rows that are only reachable through a loop (should not exist) are appended at the top level
  for (const r of rows) if (!seen.has(r.id)) out.push({ ...r, depth: 0, path: [r.name] });
  return out;
}

/** Tree with product counts and image URLs for the dashboard and pickers. */
export async function categoryTree(): Promise<CategoryNode[]> {
  const [rows, counts, imgs] = await Promise.all([
    loadCategories(),
    db.select({ id: productCategories.categoryId, n: count() }).from(productCategories).groupBy(productCategories.categoryId),
    db.select({ id: media.id, path: media.path }).from(media).innerJoin(categories, eq(categories.imageId, media.id)),
  ]);
  const n = new Map(counts.map((c) => [c.id, c.n]));
  const img = new Map(imgs.map((i) => [i.id, mediaPath(i.path)]));
  return buildTree(rows).map((r) => ({
    ...r,
    productCount: n.get(r.id) ?? 0,
    childCount: rows.filter((c) => c.parentId === r.id).length,
    imageUrl: r.imageId ? (img.get(r.imageId) ?? null) : null,
  }));
}

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(120, "Der Name ist zu lang (höchstens 120 Zeichen)."),
  slug: z.string().trim().max(120).default(""),
  parentId: z.string().uuid().nullish().transform((v) => v ?? null),
  description: z.string().max(20_000).default(""),
  imageId: z.string().uuid().nullish().transform((v) => v ?? null),
  sort: z.number({ invalid_type_error: "Die Reihenfolge ist eine ganze Zahl." }).int("Die Reihenfolge ist eine ganze Zahl.").min(-10_000).max(10_000).default(0),
  seoTitle: z.string().trim().max(200).nullish().transform((v) => v || null),
  seoDescription: z.string().trim().max(400).nullish().transform((v) => v || null),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

async function uniqueCategorySlug(base: string, excludeId?: string | null, tx?: Tx) {
  const root = slugify(base).slice(0, 90) || "kategorie";
  const rows = await (tx ?? db)
    .select({ slug: categories.slug })
    .from(categories)
    .where(and(or(eq(categories.slug, root), ilike(categories.slug, `${root}-%`)), excludeId ? ne(categories.id, excludeId) : undefined));
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(root)) return root;
  for (let i = 2; ; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
}

export async function saveCategory(id: string | null, input: CategoryInput, actor: Actor) {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) throw fromZod(parsed.error);
  const c = parsed.data;
  const all = await loadCategories();
  const existing = id ? all.find((x) => x.id === id) : undefined;
  if (id && !existing) throw new InputError("Die Kategorie wurde nicht gefunden.");
  if (c.parentId && !all.some((x) => x.id === c.parentId)) throw new InputError("Die übergeordnete Kategorie gibt es nicht mehr.", { parentId: "Bitte eine andere Kategorie wählen." });
  if (wouldCreateCycle(all, id, c.parentId))
    throw new InputError("Eine Kategorie kann nicht unter sich selbst oder einer ihrer Unterkategorien liegen.", { parentId: "Wählen Sie eine Kategorie, die nicht darunter liegt." });

  let slug = slugify(c.slug);
  if (slug) {
    const clash = all.find((x) => x.slug === slug && x.id !== id);
    if (clash) throw new InputError(`Die Adresse «${slug}» verwendet bereits die Kategorie «${clash.name}».`, { slug: `Bereits vergeben durch «${clash.name}».` });
  } else slug = await uniqueCategorySlug(c.name, id);

  const values = { name: c.name, slug, parentId: c.parentId, description: sanitizeHtml(c.description), imageId: c.imageId, sort: c.sort, seoTitle: c.seoTitle, seoDescription: c.seoDescription, updatedAt: new Date() };
  const [row] = existing ? await db.update(categories).set(values).where(eq(categories.id, existing.id)).returning() : await db.insert(categories).values(values).returning();
  await audit(actor, existing ? "category.updated" : "category.created", { entityType: "category", entityId: row.id, summary: `${existing ? "Kategorie bearbeitet" : "Kategorie erstellt"}: ${row.name}` });
  return row;
}

/** Deletes a category; its children move up to its parent, products only lose the link. */
export async function deleteCategory(id: string, actor: Actor) {
  const [row] = await db.select().from(categories).where(eq(categories.id, id));
  if (!row) return null;
  await db.transaction(async (tx) => {
    await tx.update(categories).set({ parentId: row.parentId, updatedAt: new Date() }).where(eq(categories.parentId, id));
    await tx.delete(categories).where(eq(categories.id, id));
  });
  await audit(actor, "category.deleted", { entityType: "category", entityId: id, summary: `Kategorie gelöscht: ${row.name}` });
  return row;
}

/**
 * Finds or creates a category path like ["Kleidung", "T-Shirts"] (import).
 * Names are matched case-insensitively below the same parent. Returns the leaf id.
 */
export async function ensureCategoryPath(path: string[], cache?: Map<string, string>, tx?: Tx): Promise<string | null> {
  const t = tx ?? db;
  let parentId: string | null = null;
  for (const raw of path) {
    const name = raw.trim().slice(0, 120);
    if (!name) continue;
    const key: string = `${parentId ?? ""}/${name.toLowerCase()}`;
    const hit: string | undefined = cache?.get(key);
    if (hit) {
      parentId = hit;
      continue;
    }
    const siblings: { id: string; name: string }[] = await t
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId));
    let foundId: string | undefined = siblings.find((s) => s.name.toLowerCase() === name.toLowerCase())?.id;
    if (!foundId) {
      const slug: string = await uniqueCategorySlug(name, null, tx);
      const created: { id: string }[] = await t.insert(categories).values({ name, slug, parentId }).returning({ id: categories.id });
      foundId = created[0].id;
    }
    cache?.set(key, foundId);
    parentId = foundId;
  }
  return parentId;
}
