import type { Metadata } from "next";
import { site } from "@/content/site";
import { services } from "@/content/services";
import { seoOverride } from "@/server/content/seo-public";
export { staticSeo } from "@/content/seo-pages";

export function pageMeta({ title, description, path, image }: { title: string; description: string; path: string; image?: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      locale: "de_CH",
      siteName: site.name,
      type: "website",
      images: [{ url: image ?? "/og.jpg", alt: title }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** pageMeta + the overrides from the dashboard's SEO module (title, description, image, noindex, canonical). */
export async function withSeo(defaults: { title: string; description: string; path: string; image?: string }): Promise<Metadata> {
  const o = await seoOverride(defaults.path);
  const meta = pageMeta({
    path: defaults.path,
    title: o?.title?.trim() || defaults.title,
    description: o?.description?.trim() || defaults.description,
    image: o?.ogImage?.trim() || defaults.image,
  });
  if (defaults.path === "/") meta.title = { absolute: String(meta.title) };
  if (o?.noindex) meta.robots = { index: false, follow: true };
  if (o?.canonical?.trim()) meta.alternates = { ...meta.alternates, canonical: o.canonical.trim() };
  return meta;
}

/** ProfessionalService – only verified facts (no ratings, no opening hours). */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: site.name,
    legalName: site.legalName,
    url: site.url,
    logo: `${site.url}/brand/logo.png`,
    image: `${site.url}/og.jpg`,
    email: site.contact.email,
    telephone: ["+41 52 589 67 59", "+41 76 507 33 32"],
    taxID: site.uid,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.contact.street,
      postalCode: site.contact.postalCode,
      addressLocality: site.contact.locality,
      addressRegion: "SH",
      addressCountry: "CH",
    },
    geo: { "@type": "GeoCoordinates", latitude: site.contact.geo.lat, longitude: site.contact.geo.lng },
    areaServed: site.regions.map((r) => ({ "@type": "Place", name: r })),
    sameAs: site.social.map((s) => s.href),
    knowsAbout: services.map((s) => s.name),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${site.url}${it.path}` })),
  };
}
