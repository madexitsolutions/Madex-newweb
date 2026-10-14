import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { services } from "@/content/services";
import { posts } from "@/content/posts";

const staticPaths = [
  "",
  "/marketing-solutions",
  "/uber-uns",
  "/das-team",
  "/blog",
  "/karriere",
  "/portfolio",
  "/website-portfolio",
  "/graphic-design-portfolio",
  "/werbevideos-portfolio",
  "/partners",
  "/kontakt",
  "/kostenlose-prufung",
  "/agb",
  "/datenschutz",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...staticPaths.map((p) => ({ url: `${site.url}${p}`, lastModified: now, changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.8 })),
    ...services.map((s) => ({ url: `${site.url}/marketing-solutions/${s.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...posts.map((p) => ({ url: `${site.url}/${p.slug}`, lastModified: new Date(p.date), changeFrequency: "yearly" as const, priority: 0.5 })),
  ];
}
