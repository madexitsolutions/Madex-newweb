import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { posts } from "@/content/posts";
import { allSeoPages } from "@/lib/seo-pages";
import { noindexPaths } from "@/server/content/seo-public";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const hidden = await noindexPaths();
  const postDates = new Map(posts.map((p) => [`/${p.slug}`, new Date(p.date)]));
  return allSeoPages()
    .filter((p) => !hidden.has(p.path))
    .map((p) => ({
      url: `${site.url}${p.path === "/" ? "" : p.path}`,
      lastModified: postDates.get(p.path) ?? now,
      changeFrequency: p.group === "Beiträge" ? ("yearly" as const) : ("monthly" as const),
      priority: p.path === "/" ? 1 : p.group === "Beiträge" ? 0.5 : 0.8,
    }));
}
