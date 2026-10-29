import { PageHeader } from "@/components/admin/kit";
import { requirePermission } from "@/server/auth/session";
import { footerMenu, headerMenu } from "@/server/site/content";
import { publishedPages } from "@/server/site/pages";
import { getSettings } from "@/server/settings";
import { MenuEditor } from "./editor";
import "../../content.css";
import "./menues.css";

export const metadata = { title: "Menüs" };

export default async function MenusPage() {
  await requirePermission("website.manage");
  const [menus, pages, m] = await Promise.all([getSettings("menus"), publishedPages(), getSettings("modules")]);
  // what the automatic menus show right now (stored menus ignored)
  const auto = { header: await headerMenu({ pages }, true), footer: await footerMenu({ pages }, true) };
  const suggestions = [
    { label: "Start", url: "/" },
    ...pages.map((p) => ({ label: p.title, url: `/${p.slug}` })),
    m.shop && m.storefront ? { label: "Shop", url: "/shop" } : null,
    m.blog ? { label: "Beiträge", url: "/beitraege" } : null,
    m.inquiries ? { label: "Kontakt", url: "/kontakt" } : null,
  ].filter((x): x is { label: string; url: string } => Boolean(x));

  return (
    <>
      <PageHeader title="Menüs" description="Welche Links oben in der Kopfzeile und unten in der Fusszeile der Website stehen. Ohne eigene Einträge baut das Dashboard die Menüs automatisch aus den veröffentlichten Seiten und aktiven Plugins." />
      <MenuEditor initial={menus} auto={auto} suggestions={suggestions} />
    </>
  );
}
