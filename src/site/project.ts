/**
 * PROJEKTCODE – the Madex website is fully custom (own layout, analytics with
 * consent, static content pages, no shop), so only the plugins that work with
 * it are offered and the "Website" area of the template is hidden.
 */
import type { PluginKey } from "@/modules/registry";
import type { SitePage } from "@/server/content/seo";

export const PROJECT: {
  plugins: "all" | PluginKey[];
  websiteEditing: boolean;
  /** every page of the website with its built-in SEO – the SEO page in the dashboard lists and rates them */
  seoPages?: () => Promise<SitePage[]>;
} = {
  // contact, analysis and chat forms → Anfragen; SEO overrides via lib/seo.ts; GA numbers in the dashboard
  plugins: ["inquiries", "seo", "analytics"],
  websiteEditing: false,
  seoPages: async () => (await import("@/lib/seo-pages")).allSeoPages(),
};
