import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { posts } from "@/content/posts";
import { allSeoPages } from "@/lib/seo-pages";
import { getSettings } from "@/lib/server/settings";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const seo = (await getSettings().catch(() => null))?.seo ?? {};
  const postDates = new Map(posts.map((p) => [`/${p.slug}`, new Date(p.date)]));
  return allSeoPages()
    .filter((p) => !seo[p.path]?.noindex)
    .map((p) => ({
      url: `${site.url}${p.path === "/" ? "" : p.path}`,
      lastModified: postDates.get(p.path) ?? now,
      changeFrequency: p.group === "Beiträge" ? ("yearly" as const) : ("monthly" as const),
      priority: p.path === "/" ? 1 : p.group === "Beiträge" ? 0.5 : 0.8,
    }));
}
