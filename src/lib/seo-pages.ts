import { posts } from "@/content/posts";
import { services } from "@/content/services";
import { staticSeo } from "@/content/seo-pages";
import { media } from "@/lib/media";

export type SeoPage = { path: string; group: "Seiten" | "Leistungen" | "Beiträge"; title: string; description: string; image?: string };

/** Every public page with its built-in SEO defaults (used by the admin and the sitemap). */
export function allSeoPages(): SeoPage[] {
  return [
    ...Object.entries(staticSeo).map(([path, d]) => ({ path, group: "Seiten" as const, ...d })),
    ...services.map((s) => ({ path: `/marketing-solutions/${s.slug}`, group: "Leistungen" as const, title: s.metaTitle, description: s.metaDescription, image: s.image })),
    ...posts.map((p) => ({ path: `/${p.slug}`, group: "Beiträge" as const, title: p.title, description: p.description || p.title, image: p.cover ? media(p.cover) : undefined })),
  ];
}
