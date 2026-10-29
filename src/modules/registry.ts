/**
 * Plugins that can be activated per installation (Dashboard → Plugins) and the
 * admin navigation built from them. A new installation starts with every plugin
 * off. Pages of an inactive plugin call requireModule() and are hidden from the
 * navigation; their data stays in the database.
 */
import { notFound } from "next/navigation";
import type { IconName } from "@/components/admin/kit";
import type { Permission } from "@/server/auth/permissions";
import { getSettings, type Settings } from "@/server/settings";
import { PROJECT } from "@/site/project";

export type ModuleKey = keyof Settings["modules"];
/** Plugins shown on the plugins page (`storefront` is an option inside the shop). */
export type PluginKey = Exclude<ModuleKey, "storefront">;

export type PluginCategory = "Verkaufen" | "Inhalte" | "Marketing" | "Website";

export type Plugin = {
  key: PluginKey;
  name: string;
  category: PluginCategory;
  icon: IconName;
  description: string;
  /** What appears after activating: dashboard pages and pages on the website. */
  dashboard: string[];
  website: string[];
  /** Where the plugin is set up after activation. */
  setup?: { href: string; label: string };
};

export const PLUGIN_CATEGORIES: PluginCategory[] = ["Verkaufen", "Inhalte", "Marketing", "Website"];

export const PLUGINS: Plugin[] = [
  {
    key: "shop",
    name: "Shop",
    category: "Verkaufen",
    icon: "cart",
    description: "Online-Shop mit Produkten, Varianten, Lager, Bestellungen, Kunden, Gutscheinen, Versand, Steuern und Zahlungsarten (Stripe, Payrexx, Rechnung mit QR, Vorauskasse).",
    dashboard: ["Bestellungen", "Produkte", "Kategorien", "Kunden", "Gutscheine", "Shop-Einstellungen", "Umsatz-Statistiken"],
    website: ["/shop", "/produkt/…", "/warenkorb", "/kasse", "/bestellung/…"],
    setup: { href: "/madexadm/shop-einstellungen", label: "Shop einrichten" },
  },
  {
    key: "blog",
    name: "Beiträge",
    category: "Inhalte",
    icon: "file",
    description: "News und Blog mit Entwürfen, geplanter Veröffentlichung, Titelbild und SEO je Beitrag.",
    dashboard: ["Beiträge"],
    website: ["/beitraege", "/beitraege/…"],
    setup: { href: "/madexadm/beitraege", label: "Ersten Beitrag schreiben" },
  },
  {
    key: "inquiries",
    name: "Kontaktformular",
    category: "Inhalte",
    icon: "inbox",
    description: "Kontaktformular auf der Website. Anfragen landen im Dashboard und per E-Mail bei Ihnen, mit Status und Notizen.",
    dashboard: ["Anfragen"],
    website: ["/kontakt"],
    setup: { href: "/madexadm/plugins/inquiries", label: "Formular einrichten" },
  },
  {
    key: "seo",
    name: "SEO",
    category: "Marketing",
    icon: "search",
    description: "Titel und Beschreibung je Seite, Vorschau in Google, sitemap.xml und robots.txt, Bestätigung für die Google Search Console.",
    dashboard: ["SEO"],
    website: ["/sitemap.xml", "/robots.txt"],
    setup: { href: "/madexadm/plugins/seo", label: "SEO einrichten" },
  },
  {
    key: "analytics",
    name: "Google Analytics",
    category: "Marketing",
    icon: "chart",
    description: "Misst Besucher auf der Website (GA4) und zeigt Besucher, Seitenaufrufe, Quellen und Geräte direkt im Dashboard.",
    dashboard: ["Statistiken", "Besucher auf der Übersicht"],
    website: ["Messcode auf allen Seiten"],
    setup: { href: "/madexadm/plugins/analytics", label: "Google Analytics verbinden" },
  },
  {
    key: "cookies",
    name: "Cookie-Hinweis",
    category: "Marketing",
    icon: "cookie",
    description: "Fragt Besucher nach ihrer Einwilligung (revDSG/DSGVO). Google Analytics und eigener Code mit Einwilligungspflicht laden erst nach Zustimmung.",
    dashboard: [],
    website: ["Hinweis unten auf allen Seiten"],
    setup: { href: "/madexadm/plugins/cookies", label: "Texte anpassen" },
  },
  {
    key: "redirects",
    name: "Weiterleitungen",
    category: "Website",
    icon: "shuffle",
    description: "Leitet alte Adressen auf neue weiter (301/302) und zeigt, welche Seiten Besucher nicht gefunden haben (404).",
    dashboard: ["Weiterleitungen"],
    website: [],
    setup: { href: "/madexadm/weiterleitungen", label: "Weiterleitungen verwalten" },
  },
  {
    key: "announcement",
    name: "Hinweisleiste",
    category: "Website",
    icon: "megaphone",
    description: "Schmale Leiste über der Website für Aktionen, Ferien oder Neuigkeiten – mit Link und Zeitraum.",
    dashboard: [],
    website: ["Leiste oben auf allen Seiten"],
    setup: { href: "/madexadm/plugins/announcement", label: "Text festlegen" },
  },
  {
    key: "maintenance",
    name: "Wartungsmodus",
    category: "Website",
    icon: "wrench",
    description: "Zeigt Besuchern eine «Bald zurück»-Seite. Angemeldete Benutzer sehen die Website weiterhin normal.",
    dashboard: [],
    website: ["Wartungsseite statt Website"],
    setup: { href: "/madexadm/plugins/maintenance", label: "Wartungsseite anpassen" },
  },
  {
    key: "customCode",
    name: "Eigener Code",
    category: "Website",
    icon: "code",
    description: "Code von Drittanbietern einbinden (z. B. Meta-Pixel, Chat-Widget, Bestätigungs-Tags) – im <head> oder am Ende der Seite.",
    dashboard: [],
    website: ["Code auf allen Seiten"],
    setup: { href: "/madexadm/plugins/customCode", label: "Code einfügen" },
  },
];

/** Plugins this project's website supports (src/site/project.ts). */
export const AVAILABLE_PLUGINS = PROJECT.plugins === "all" ? PLUGINS : PLUGINS.filter((p) => (PROJECT.plugins as PluginKey[]).includes(p.key));
export const isPluginAvailable = (key: string) => AVAILABLE_PLUGINS.some((p) => p.key === key);
export const websiteEditing = PROJECT.websiteEditing;

export const pluginByKey = (key: string) => AVAILABLE_PLUGINS.find((p) => p.key === key);

export type NavItem = { href: string; label: string; icon: IconName; permission: Permission; module?: ModuleKey | ModuleKey[]; badge?: "orders" | "inquiries"; website?: true };

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Übersicht",
    items: [
      { href: "/madexadm", label: "Übersicht", icon: "home", permission: "dashboard.view" },
      { href: "/madexadm/statistiken", label: "Statistiken", icon: "chart", permission: "analytics.view", module: ["shop", "analytics"] },
    ],
  },
  {
    group: "Vertrieb",
    items: [{ href: "/madexadm/anfragen", label: "Anfragen", icon: "inbox", permission: "inquiries.view", module: "inquiries", badge: "inquiries" }],
  },
  {
    group: "Shop",
    items: [
      { href: "/madexadm/bestellungen", label: "Bestellungen", icon: "cart", permission: "orders.view", module: "shop", badge: "orders" },
      { href: "/madexadm/produkte", label: "Produkte", icon: "box", permission: "products.view", module: "shop" },
      { href: "/madexadm/kategorien", label: "Kategorien", icon: "layers", permission: "products.manage", module: "shop" },
      { href: "/madexadm/kunden", label: "Kunden", icon: "users", permission: "customers.view", module: "shop" },
      { href: "/madexadm/gutscheine", label: "Gutscheine", icon: "percent", permission: "discounts.manage", module: "shop" },
      { href: "/madexadm/shop-einstellungen", label: "Shop-Einstellungen", icon: "store", permission: "shop.settings", module: "shop" },
    ],
  },
  {
    group: "Website",
    items: [
      { website: true, href: "/madexadm/seiten", label: "Seiten", icon: "pages", permission: "website.manage" },
      { website: true, href: "/madexadm/texte", label: "Texte & Bilder", icon: "type", permission: "website.manage" },
      { website: true, href: "/madexadm/menues", label: "Menüs", icon: "menuedit", permission: "website.manage" },
      { href: "/madexadm/beitraege", label: "Beiträge", icon: "file", permission: "content.view", module: "blog" },
      { href: "/madexadm/medien", label: "Mediathek", icon: "image", permission: "media.manage" },
    ],
  },
  {
    group: "Marketing",
    items: [
      { href: "/madexadm/seo", label: "SEO", icon: "search", permission: "seo.manage", module: "seo" },
      { href: "/madexadm/weiterleitungen", label: "Weiterleitungen", icon: "shuffle", permission: "seo.manage", module: "redirects" },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/madexadm/benutzer", label: "Benutzer & Rollen", icon: "users", permission: "users.view" },
      { href: "/madexadm/integrationen", label: "Integrationen", icon: "key", permission: "integrations.manage" },
      { href: "/madexadm/einstellungen", label: "Einstellungen", icon: "gear", permission: "settings.manage" },
      { href: "/madexadm/sicherheit", label: "Sicherheit & Protokoll", icon: "shield", permission: "audit.view" },
    ],
  },
];

export async function enabledModules(): Promise<Settings["modules"]> {
  const m = { ...(await getSettings("modules")) };
  // plugins the website of this project doesn't support are always off; with a fixed list
  // (src/site/project.ts) the listed ones are always on – there is no plugins page to switch them
  for (const p of PLUGINS) m[p.key] = PROJECT.plugins === "all" ? isPluginAvailable(p.key) && m[p.key] : PROJECT.plugins.includes(p.key);
  // the built-in shop pages are an option of the shop
  return { ...m, storefront: m.shop && m.storefront };
}

export async function isModuleEnabled(key: ModuleKey) {
  return (await enabledModules())[key];
}

// project pages (src/site/project.ts → nav): into their group, or as a new group after `after`
for (const extra of PROJECT.nav ?? []) {
  const target = NAV.find((g) => g.group === extra.group);
  if (target) target.items.push(...extra.items);
  else NAV.splice(Math.max(0, NAV.findIndex((g) => g.group === extra.after)) + 1, 0, { group: extra.group, items: extra.items });
}

export function navItemVisible(item: NavItem, modules: Settings["modules"]) {
  if (item.website && !websiteEditing) return false;
  if (!item.module) return true;
  return (Array.isArray(item.module) ? item.module : [item.module]).some((k) => modules[k]);
}

/** Use at the top of pages, actions and API routes that belong to a plugin. Several keys = any of them. */
export async function requireModule(...keys: ModuleKey[]) {
  const m = await enabledModules();
  if (!keys.some((k) => m[k])) notFound();
}
