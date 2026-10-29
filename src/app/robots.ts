import type { MetadataRoute } from "next";
import { site } from "@/content/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] /* the dashboard path stays unlisted; its pages carry noindex */ }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
