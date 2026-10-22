/**
 * Metadata of the public website: title template, description, preview image
 * and robots from the SEO plugin, plus the overrides per path from SEO.
 */
import type { Metadata } from "next";
import { getSeo } from "@/server/content/seo";
import { getSettings } from "@/server/settings";

export async function siteMetadata(input: { path: string; title?: string; description?: string; image?: string | null; noindex?: boolean }): Promise<Metadata> {
  const [m, seo, general] = await Promise.all([getSettings("modules"), getSettings("seoSite"), getSettings("general")]);
  const entry = m.seo ? await getSeo(input.path) : null;
  const title = entry?.title || input.title;
  const description = entry?.description || input.description || (m.seo ? seo.defaultDescription : "") || undefined;
  const image = entry?.ogImage || input.image || (m.seo ? seo.ogImage : "") || undefined;
  const noindex = Boolean(input.noindex || entry?.noindex || (m.seo && seo.noindexSite) || m.maintenance);
  return {
    // absolute: the layout template would add the site name a second time
    title: title === general.siteName && !entry?.title ? { absolute: title } : title ? { absolute: m.seo ? seo.titleTemplate.replace("%s", title).replace("{site}", general.siteName) : `${title} · ${general.siteName}` } : undefined,
    description,
    alternates: { canonical: entry?.canonical || input.path },
    openGraph: { title: title ?? general.siteName, description, siteName: general.siteName, locale: "de_CH", type: "website", images: image ? [{ url: image }] : undefined },
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}
