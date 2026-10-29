/** Media library queries: listing, where a file is used, alt text. */
import { and, count, desc, eq, ilike, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { categories, media, posts, productImages, productVariants, products, seoEntries } from "@/server/db/schema";
import { getSettings } from "@/server/settings";
import { mediaPath } from "./store";

export type Media = typeof media.$inferSelect;
export type MediaType = "all" | "image" | "pdf";

export function mediaWhere(opts: { q?: string; type?: MediaType }): SQL | undefined {
  const conds: SQL[] = [];
  if (opts.type === "image") conds.push(like(media.mime, "image/%"));
  if (opts.type === "pdf") conds.push(eq(media.mime, "application/pdf"));
  if (opts.q) {
    const q = `%${opts.q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    conds.push(or(ilike(media.filename, q), ilike(media.alt, q))!);
  }
  return conds.length ? and(...conds) : undefined;
}

export async function listMedia(opts: { q?: string; type?: MediaType }, page: number, perPage = 40) {
  const where = mediaWhere(opts);
  const [{ n }] = await db.select({ n: count() }).from(media).where(where);
  const rows = await db
    .select()
    .from(media)
    .where(where)
    .orderBy(desc(media.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);
  return { rows, total: n };
}

export async function mediaTypeCounts(q?: string) {
  const [r] = await db
    .select({
      all: count(),
      image: sql<number>`count(*) filter (where ${media.mime} like 'image/%')`.mapWith(Number),
      pdf: sql<number>`count(*) filter (where ${media.mime} = 'application/pdf')`.mapWith(Number),
    })
    .from(media)
    .where(mediaWhere({ q }));
  return r;
}

export type MediaUsage = { kind: "product" | "variant" | "category" | "post" | "post_body" | "branding" | "seo"; label: string; href?: string };

/** Every place a file is referenced (shown before deleting). */
export async function mediaUsage(m: Pick<Media, "id" | "path">): Promise<MediaUsage[]> {
  const url = mediaPath(m.path);
  const pattern = `%${url.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
  const [imgs, variants, cats, covers, bodies, seo, branding] = await Promise.all([
    db.selectDistinct({ id: products.id, name: products.name }).from(productImages).innerJoin(products, eq(productImages.productId, products.id)).where(eq(productImages.mediaId, m.id)),
    db
      .select({ id: products.id, name: products.name, title: productVariants.title })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(productVariants.imageId, m.id)),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.imageId, m.id)),
    db.select({ id: posts.id, title: posts.title }).from(posts).where(eq(posts.coverId, m.id)),
    db.select({ id: posts.id, title: posts.title }).from(posts).where(ilike(posts.body, pattern)),
    db.select({ path: seoEntries.path }).from(seoEntries).where(ilike(seoEntries.ogImage, pattern)),
    getSettings("branding"),
  ]);
  const out: MediaUsage[] = [];
  for (const p of imgs) out.push({ kind: "product", label: `Produkt «${p.name}»`, href: `/madexadm/produkte/${p.id}` });
  for (const v of variants) out.push({ kind: "variant", label: `Variante «${v.title || "Standard"}» von «${v.name}»`, href: `/madexadm/produkte/${v.id}` });
  for (const c of cats) out.push({ kind: "category", label: `Kategorie «${c.name}»`, href: `/madexadm/kategorien?bearbeiten=${c.id}` });
  for (const p of covers) out.push({ kind: "post", label: `Titelbild von «${p.title}»`, href: `/madexadm/beitraege/${p.id}` });
  for (const p of bodies) out.push({ kind: "post_body", label: `Im Text von «${p.title}»`, href: `/madexadm/beitraege/${p.id}` });
  for (const s of seo) out.push({ kind: "seo", label: `Vorschaubild der Seite ${s.path}`, href: `/madexadm/seo?bearbeiten=${encodeURIComponent(s.path)}` });
  const brandFields: [keyof typeof branding, string][] = [
    ["logoUrl", "Logo"],
    ["logoDarkUrl", "Logo (dunkler Hintergrund)"],
    ["faviconUrl", "Favicon"],
  ];
  for (const [k, label] of brandFields) if (String(branding[k] ?? "").includes(url)) out.push({ kind: "branding", label: `Branding: ${label}`, href: "/madexadm/einstellungen" });
  return out;
}

export async function updateAlt(id: string, alt: string) {
  const [row] = await db.update(media).set({ alt: alt.trim().slice(0, 300) }).where(eq(media.id, id)).returning();
  return row ?? null;
}

export async function getMedia(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(media).where(eq(media.id, id));
  return row ?? null;
}

/** Serialisable media reference for client components (picker). */
export type MediaRef = { id: string; path: string; url: string; alt: string; filename: string; mime: string; width: number | null; height: number | null; size: number };

export const toRef = (m: Media): MediaRef => ({ id: m.id, path: m.path, url: mediaPath(m.path), alt: m.alt, filename: m.filename, mime: m.mime, width: m.width, height: m.height, size: m.size });
