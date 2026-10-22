/**
 * Texts, images and menus of the website edited in the dashboard. Fields are
 * declared by the project in src/site/fields.ts.
 */
import { CONTENT_FIELDS } from "@/site/fields";
import { getSettings } from "@/server/settings";

export type SiteText = Record<string, string>;

/** All fields with stored values, falling back to the defaults from src/site/fields.ts. */
export async function siteContent(): Promise<SiteText> {
  const stored = await getSettings("siteContent");
  const out: SiteText = {};
  for (const f of CONTENT_FIELDS) out[f.key] = stored[f.key] ?? f.default;
  return out;
}

export const isOn = (v: string | undefined) => v === "1";

export type MenuItem = { label: string; url: string };

/** Header menu: the stored one, or built from the active plugins and published pages. */
export async function headerMenu(auto: { pages: { slug: string; title: string }[] }, automaticOnly = false): Promise<MenuItem[]> {
  const [menus, m] = await Promise.all([getSettings("menus"), getSettings("modules")]);
  if (menus.header.length && !automaticOnly) return menus.header;
  const legal = new Set(["impressum", "datenschutz"]);
  return [
    { label: "Start", url: "/" },
    ...auto.pages.filter((p) => !legal.has(p.slug)).slice(0, 4).map((p) => ({ label: p.title, url: `/${p.slug}` })),
    m.shop && m.storefront ? { label: "Shop", url: "/shop" } : null,
    m.blog ? { label: "Beiträge", url: "/beitraege" } : null,
    m.inquiries ? { label: "Kontakt", url: "/kontakt" } : null,
  ].filter((x): x is MenuItem => Boolean(x));
}

/** Footer menu: the stored one, or the legal pages that are published. */
export async function footerMenu(auto: { pages: { slug: string; title: string }[] }, automaticOnly = false): Promise<MenuItem[]> {
  const menus = await getSettings("menus");
  if (menus.footer.length && !automaticOnly) return menus.footer;
  return auto.pages.filter((p) => p.slug === "impressum" || p.slug === "datenschutz").map((p) => ({ label: p.title, url: `/${p.slug}` }));
}
