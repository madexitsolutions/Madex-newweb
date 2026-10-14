import type { Metadata } from "next";
import { site } from "@/content/site";
import { services } from "@/content/services";

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

/** ProfessionalService – only verified facts (no ratings, no opening hours). */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: site.name,
    legalName: site.legalName,
    url: site.url,
    logo: `${site.url}/media/brand/business-logo.webp`,
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
