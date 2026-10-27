/**
 * PROJEKTCODE – the Madex website is fully custom (own layout, analytics with
 * consent, static content pages, no shop), so only the plugins that work with
 * it are offered and the "Website" area of the template is hidden.
 */
import type { ReactNode } from "react";
import type { NavItem, PluginKey } from "@/modules/registry";
import type { SitePage } from "@/server/content/seo";
import type { DigestSection, DigestWeek } from "@/server/digest";

export const PROJECT: {
  plugins: "all" | PluginKey[];
  websiteEditing: boolean;
  /** every page of the website with its built-in SEO – the SEO page in the dashboard lists and rates them */
  seoPages?: () => Promise<SitePage[]>;
  /** extra dashboard pages of this project (src/app/admin/(panel)/(projekt)/…), added to a navigation group */
  nav?: { group: string; after?: string; items: NavItem[] }[];
  /** extra panel on top of an enquiry in the dashboard (e.g. the website analysis behind it) */
  inquiryPanel?: (inquiry: { reference: string; fields: Record<string, string> }) => Promise<ReactNode>;
  /** own sections of the weekly summary e-mail */
  weeklyDigest?: (week: DigestWeek) => Promise<DigestSection[]>;
} = {
  // contact, analysis and chat forms → Anfragen; SEO overrides via lib/seo.ts; GA numbers in the dashboard
  plugins: ["inquiries", "seo", "analytics"],
  websiteEditing: false,
  seoPages: async () => (await import("@/lib/seo-pages")).allSeoPages(),
  nav: [
    {
      group: "Vertrieb",
      after: "Übersicht",
      items: [
        { href: "/admin/analysen", label: "Website-Analysen", icon: "sparkle", permission: "inquiries.view", module: "inquiries" },
        { href: "/admin/chatbot", label: "Chatbot Orion", icon: "bot", permission: "inquiries.view" },
      ],
    },
    { group: "Website", items: [{ href: "/admin/projekte", label: "Projekte", icon: "file", permission: "content.view" }] },
  ],
  inquiryPanel: async (inquiry) => (await import("@/site/admin/inquiry-analysis")).InquiryAnalysis(inquiry),
  weeklyDigest: async (week) => (await import("@/site/admin/weekly-digest")).madexDigest(week),
};
