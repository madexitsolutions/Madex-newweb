/**
 * News/blog posts. A post is publicly visible when it is published, or
 * scheduled with a publish date that has passed (no cron needed: visibility is
 * decided at read time).
 */
import { and, count, desc, eq, ilike, isNotNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { media, posts, users } from "@/server/db/schema";
import { emit } from "@/server/events";
import { sanitizeHtml, htmlToText } from "@/server/lib/sanitize";
import { mediaUrl } from "@/server/media/store";
import { slugify } from "@/lib/format";

export type Post = typeof posts.$inferSelect;
export type PostStatus = Post["status"];
/** Status as the reader sees it: a scheduled post whose date has passed is live. */
export type EffectiveStatus = "draft" | "scheduled" | "live";

export function effectiveStatus(p: Pick<Post, "status" | "publishedAt">, now = new Date()): EffectiveStatus {
  if (p.status === "draft") return "draft";
  if (p.status === "published") return "live";
  return p.publishedAt && p.publishedAt <= now ? "live" : "scheduled";
}

export function isPostVisible(p: Pick<Post, "status" | "publishedAt">, now = new Date()) {
  return effectiveStatus(p, now) === "live";
}

/** SQL condition for "publicly visible". */
export function visibleWhere(now = new Date()): SQL {
  return or(eq(posts.status, "published"), and(eq(posts.status, "scheduled"), isNotNull(posts.publishedAt), lte(posts.publishedAt, now)))!;
}

/** SQL condition for the admin tabs. */
export function tabWhere(tab: string, now = new Date()): SQL | undefined {
  if (tab === "live") return visibleWhere(now);
  if (tab === "scheduled") return and(eq(posts.status, "scheduled"), or(sql`${posts.publishedAt} is null`, sql`${posts.publishedAt} > ${now.toISOString()}::timestamptz`));
  if (tab === "draft") return eq(posts.status, "draft");
  return undefined;
}

export const postInput = z
  .object({
    title: z.string().trim().min(1, "Bitte einen Titel eingeben.").max(200, "Der Titel ist zu lang (max. 200 Zeichen)."),
    slug: z.string().trim().max(96).optional().default(""),
    excerpt: z.string().trim().max(600, "Der Kurztext ist zu lang (max. 600 Zeichen).").default(""),
    body: z.string().max(500_000, "Der Text ist zu lang.").default(""),
    coverId: z.string().uuid().nullable().default(null),
    category: z.string().trim().max(80).default(""),
    tags: z.array(z.string().trim().min(1).max(40)).max(20, "Höchstens 20 Schlagwörter.").default([]),
    authorId: z.string().uuid().nullable().default(null),
    seoTitle: z.string().trim().max(200).default(""),
    seoDescription: z.string().trim().max(400).default(""),
    status: z.enum(["draft", "scheduled", "published"]),
    publishedAt: z.date().nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.status === "scheduled" && !v.publishedAt) ctx.addIssue({ code: "custom", path: ["publishedAt"], message: "Für einen geplanten Beitrag bitte Datum und Uhrzeit der Veröffentlichung angeben." });
  });

export type PostInput = z.input<typeof postInput>;

/** Unique slug: "mein-titel", "mein-titel-2", … */
export async function uniqueSlug(base: string, exceptId?: string) {
  const root = slugify(base) || "beitrag";
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? root : `${root.slice(0, 90)}-${i}`;
    const [hit] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(exceptId ? and(eq(posts.slug, candidate), ne(posts.id, exceptId)) : eq(posts.slug, candidate));
    if (!hit) return candidate;
  }
  return `${root.slice(0, 80)}-${Date.now().toString(36)}`;
}

export type SaveResult = { ok: true; post: Post; wentLive: boolean; slugAdjusted: boolean } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function savePost(id: string | null, raw: PostInput, now = new Date()): Promise<SaveResult> {
  const parsed = postInput.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".")] ??= i.message;
    return { ok: false, error: parsed.error.issues[0].message, fieldErrors: fe };
  }
  const v = parsed.data;
  const before = id ? (await db.select().from(posts).where(eq(posts.id, id)))[0] : undefined;
  if (id && !before) return { ok: false, error: "Der Beitrag wurde nicht gefunden – er wurde vielleicht gelöscht." };

  const wantedSlug = slugify(v.slug || v.title) || "beitrag";
  // taken slugs get a number appended ("titel-2") instead of failing the save
  const slug = await uniqueSlug(wantedSlug, id ?? undefined);

  let publishedAt = v.publishedAt;
  if (v.status === "published" && !publishedAt) publishedAt = before?.publishedAt ?? now;
  if (v.status === "draft") publishedAt = v.publishedAt;

  const values = {
    title: v.title,
    slug,
    excerpt: v.excerpt,
    body: sanitizeHtml(v.body),
    coverId: v.coverId,
    category: v.category,
    tags: [...new Set(v.tags)],
    authorId: v.authorId,
    seoTitle: v.seoTitle || null,
    seoDescription: v.seoDescription || null,
    status: v.status,
    publishedAt,
    updatedAt: now,
  };
  const [post] = before ? await db.update(posts).set(values).where(eq(posts.id, before.id)).returning() : await db.insert(posts).values(values).returning();
  const wasLive = before ? isPostVisible(before, now) : false;
  const wentLive = !wasLive && isPostVisible(post, now);
  if (wentLive) await emit("post.published", await postPayload(post));
  return { ok: true, post, wentLive, slugAdjusted: slug !== wantedSlug };
}

export async function deletePost(id: string) {
  const [row] = await db.delete(posts).where(eq(posts.id, id)).returning();
  return row ?? null;
}

export async function postCategories() {
  const rows = await db.selectDistinct({ c: posts.category }).from(posts).where(ne(posts.category, "")).orderBy(posts.category);
  return rows.map((r) => r.c);
}

export async function postTags() {
  const rows = await db.select({ tags: posts.tags }).from(posts);
  return [...new Set(rows.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, "de"));
}

/* ---------- public representation (API, webhooks) ---------- */

type CoverRow = { path: string; alt: string; width: number | null; height: number | null } | null;

function toPublic(p: Post, cover: CoverRow, author: { name: string } | null, withBody: boolean) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt || htmlToText(p.body).slice(0, 240),
    ...(withBody ? { body: p.body } : {}),
    category: p.category || null,
    tags: p.tags,
    cover: cover ? { url: mediaUrl(cover.path), alt: cover.alt, width: cover.width, height: cover.height } : null,
    author: author ? { name: author.name } : null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
    seo: { title: p.seoTitle || p.title, description: p.seoDescription || p.excerpt || htmlToText(p.body).slice(0, 160) },
  };
}

export type PublicPost = ReturnType<typeof toPublic>;

async function postPayload(p: Post) {
  const [cover] = p.coverId ? await db.select({ path: media.path, alt: media.alt, width: media.width, height: media.height }).from(media).where(eq(media.id, p.coverId)) : [];
  const [author] = p.authorId ? await db.select({ name: users.name }).from(users).where(eq(users.id, p.authorId)) : [];
  return toPublic(p, cover ?? null, author ?? null, false);
}

export async function publicPosts(opts: { category?: string; tag?: string; page?: number; limit?: number; now?: Date }) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
  const conds: SQL[] = [visibleWhere(opts.now)];
  if (opts.category) conds.push(eq(posts.category, opts.category));
  if (opts.tag) conds.push(sql`${posts.tags} @> ${JSON.stringify([opts.tag])}::jsonb`);
  const where = and(...conds);
  const [{ n }] = await db.select({ n: count() }).from(posts).where(where);
  const rows = await db
    .select({ p: posts, cover: { path: media.path, alt: media.alt, width: media.width, height: media.height }, author: { name: users.name } })
    .from(posts)
    .leftJoin(media, eq(posts.coverId, media.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(where)
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  return {
    data: rows.map((r) => toPublic(r.p, r.cover?.path ? r.cover : null, r.author?.name ? r.author : null, false)),
    pagination: { page, limit, total: n, pages: Math.max(1, Math.ceil(n / limit)) },
  };
}

export async function publicPost(slug: string, now = new Date()) {
  const [r] = await db
    .select({ p: posts, cover: { path: media.path, alt: media.alt, width: media.width, height: media.height }, author: { name: users.name } })
    .from(posts)
    .leftJoin(media, eq(posts.coverId, media.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.slug, slug), visibleWhere(now)));
  return r ? toPublic(r.p, r.cover?.path ? r.cover : null, r.author?.name ? r.author : null, true) : null;
}

/* ---------- admin list ---------- */

export async function listPosts(f: { tab: string; q?: string; category?: string }, page: number, perPage = 25, now = new Date()) {
  const conds: (SQL | undefined)[] = [tabWhere(f.tab, now)];
  if (f.category) conds.push(eq(posts.category, f.category));
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    conds.push(or(ilike(posts.title, like), ilike(posts.slug, like), ilike(posts.excerpt, like)));
  }
  const where = and(...(conds.filter(Boolean) as SQL[]));
  const [{ n }] = await db.select({ n: count() }).from(posts).where(where);
  const rows = await db
    .select({ p: posts, coverPath: media.path, author: users.name })
    .from(posts)
    .leftJoin(media, eq(posts.coverId, media.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(where)
    .orderBy(sql`coalesce(${posts.publishedAt}, ${posts.updatedAt}) desc`)
    .limit(perPage)
    .offset((page - 1) * perPage);
  return { rows, total: n };
}

export async function postTabCounts(f: { q?: string; category?: string }, now = new Date()) {
  const out: Record<string, number> = {};
  for (const tab of ["all", "live", "scheduled", "draft"]) {
    const conds: (SQL | undefined)[] = [tabWhere(tab, now)];
    if (f.category) conds.push(eq(posts.category, f.category));
    if (f.q) {
      const like = `%${f.q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
      conds.push(or(ilike(posts.title, like), ilike(posts.slug, like), ilike(posts.excerpt, like)));
    }
    const list = conds.filter(Boolean) as SQL[];
    const [{ n }] = await db.select({ n: count() }).from(posts).where(list.length ? and(...list) : undefined);
    out[tab] = n;
  }
  return out;
}
