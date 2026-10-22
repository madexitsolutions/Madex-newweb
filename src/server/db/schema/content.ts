/** Content tables: posts (news/blog), SEO overrides per path, form inquiries. */
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { media } from "./core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const created = () => ts("created_at").notNull().defaultNow();
const updated = () => ts("updated_at").notNull().defaultNow();

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    /** sanitised HTML */
    body: text("body").notNull().default(""),
    coverId: uuid("cover_id").references(() => media.id, { onDelete: "set null" }),
    status: text("status", { enum: ["draft", "scheduled", "published"] }).notNull().default("draft"),
    category: text("category").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    authorId: uuid("author_id"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: ts("published_at"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("posts_slug_idx").on(t.slug), index("posts_status_idx").on(t.status, t.publishedAt)],
);

/** SEO overrides for any path of the connected website */
export const seoEntries = pgTable("seo_entries", {
  path: text("path").primaryKey(),
  title: text("title"),
  description: text("description"),
  ogImage: text("og_image"),
  noindex: boolean("noindex").notNull().default(false),
  canonical: text("canonical"),
  updatedAt: updated(),
});

/** contact / quote / custom form submissions from the connected website */
export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    form: text("form").notNull().default("kontakt"),
    status: text("status", { enum: ["new", "open", "done", "spam"] }).notNull().default("new"),
    name: text("name").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    company: text("company").notNull().default(""),
    subject: text("subject").notNull().default(""),
    message: text("message").notNull().default(""),
    /** any further fields the form sent */
    fields: jsonb("fields").$type<Record<string, string>>().notNull().default({}),
    sourceUrl: text("source_url").notNull().default(""),
    assignedTo: uuid("assigned_to"),
    notes: text("notes").notNull().default(""),
    ip: text("ip").notNull().default(""),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("inquiries_ref_idx").on(t.reference), index("inquiries_created_idx").on(t.createdAt)],
);

/** Pages of the website edited in the dashboard (Website → Seiten), served at /<slug>. */
export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    /** sanitised HTML; {{firma}}, {{adresse}} … are replaced with the company data */
    body: text("body").notNull().default(""),
    status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
    coverId: uuid("cover_id").references(() => media.id, { onDelete: "set null" }),
    showTitle: boolean("show_title").notNull().default(true),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    noindex: boolean("noindex").notNull().default(false),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("pages_slug_idx").on(t.slug)],
);

/** Redirects (plugin "Weiterleitungen"): exact path → target */
export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromPath: text("from_path").notNull(),
    toUrl: text("to_url").notNull(),
    permanent: boolean("permanent").notNull().default(true),
    hits: integer("hits").notNull().default(0),
    lastHitAt: ts("last_hit_at"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("redirects_from_idx").on(t.fromPath)],
);

/** Paths visitors asked for that did not exist (plugin "Weiterleitungen") */
export const notFoundHits = pgTable("not_found_hits", {
  path: text("path").primaryKey(),
  hits: integer("hits").notNull().default(1),
  referrer: text("referrer").notNull().default(""),
  lastAt: ts("last_at").notNull().defaultNow(),
});
