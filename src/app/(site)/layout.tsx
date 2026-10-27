import { SiteChrome } from "@/components/layout/SiteChrome";

/**
 * Pages are pre-rendered, but SEO, projects and chatbot settings live in the
 * dashboard (database / DATA_DIR), which the build cannot see. Edits refresh
 * pages at once (revalidatePath); this catches everything else – e.g. right
 * after a deploy – within five minutes.
 */
export const revalidate = 300;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
