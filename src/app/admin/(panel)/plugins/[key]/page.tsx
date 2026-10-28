import { redirect } from "next/navigation";

/**
 * The Madex website has no plugin settings: Google Analytics, Search Console and SMTP come from .env,
 * the contact form and SEO are part of the website code. Old links lead to the matching page.
 */
const TARGET: Record<string, string> = { analytics: "/admin/statistiken", seo: "/admin/seo", inquiries: "/admin/anfragen" };

export default async function PluginSetupPage({ params }: { params: Promise<{ key: string }> }) {
  redirect(TARGET[(await params).key] ?? "/admin/einstellungen");
}
