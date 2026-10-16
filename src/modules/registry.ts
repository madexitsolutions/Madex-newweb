/**
 * Modules that can be switched on/off per installation (Einstellungen → Module)
 * and the admin navigation built from them. Pages of a disabled module call
 * requireModule() and are hidden from the navigation.
 */
import { notFound } from "next/navigation";
import type { IconName } from "@/components/admin/kit";
import type { Permission } from "@/server/auth/permissions";
import { getSettings, type Settings } from "@/server/settings";

export type ModuleKey = keyof Settings["modules"];

export const MODULES: { key: ModuleKey; name: string; description: string; requires?: ModuleKey }[] = [
  { key: "shop", name: "Shop", description: "Produkte, Bestellungen, Kunden, Gutscheine, Versand, Steuern und Zahlungsarten." },
  { key: "storefront", name: "Shop-Seiten", description: "Eingebaute Shop-Seiten (Übersicht, Produkt, Warenkorb, Kasse, Kundenkonto). Aus, wenn die Kunden-Webapp eigene Seiten über die API baut.", requires: "shop" },
  { key: "blog", name: "Beiträge", description: "News und Blog-Beiträge mit Entwürfen, Planung und SEO." },
  { key: "inquiries", name: "Anfragen", description: "Kontakt- und Offertanfragen aus den Formularen der Website." },
  { key: "analytics", name: "Statistiken", description: "Umsatzauswertungen und Besucherzahlen aus Google Analytics." },
  { key: "seo", name: "SEO", description: "Titel, Beschreibungen und Indexierung je Seite der verbundenen Website." },
];

export type NavItem = { href: string; label: string; icon: IconName; permission: Permission; module?: ModuleKey; badge?: "orders" | "inquiries" };

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Übersicht",
    items: [
      { href: "/admin", label: "Übersicht", icon: "home", permission: "dashboard.view" },
      { href: "/admin/statistiken", label: "Statistiken", icon: "chart", permission: "analytics.view", module: "analytics" },
    ],
  },
  {
    group: "Shop",
    items: [
      { href: "/admin/bestellungen", label: "Bestellungen", icon: "cart", permission: "orders.view", module: "shop", badge: "orders" },
      { href: "/admin/produkte", label: "Produkte", icon: "box", permission: "products.view", module: "shop" },
      { href: "/admin/kategorien", label: "Kategorien", icon: "layers", permission: "products.manage", module: "shop" },
      { href: "/admin/kunden", label: "Kunden", icon: "users", permission: "customers.view", module: "shop" },
      { href: "/admin/gutscheine", label: "Gutscheine", icon: "percent", permission: "discounts.manage", module: "shop" },
      { href: "/admin/shop-einstellungen", label: "Shop-Einstellungen", icon: "store", permission: "shop.settings", module: "shop" },
    ],
  },
  {
    group: "Inhalte",
    items: [
      { href: "/admin/beitraege", label: "Beiträge", icon: "file", permission: "content.view", module: "blog" },
      { href: "/admin/seo", label: "SEO", icon: "search", permission: "seo.manage", module: "seo" },
      { href: "/admin/medien", label: "Mediathek", icon: "image", permission: "media.manage" },
      { href: "/admin/anfragen", label: "Anfragen", icon: "inbox", permission: "inquiries.view", module: "inquiries", badge: "inquiries" },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/admin/benutzer", label: "Benutzer & Rollen", icon: "users", permission: "users.view" },
      { href: "/admin/integrationen", label: "Integrationen", icon: "plug", permission: "integrations.manage" },
      { href: "/admin/einstellungen", label: "Einstellungen", icon: "gear", permission: "settings.manage" },
      { href: "/admin/sicherheit", label: "Sicherheit & Protokoll", icon: "shield", permission: "audit.view" },
    ],
  },
];

export async function enabledModules(): Promise<Settings["modules"]> {
  const m = await getSettings("modules");
  // a module whose prerequisite is off is off too
  return { ...m, storefront: m.shop && m.storefront };
}

export async function isModuleEnabled(key: ModuleKey) {
  return (await enabledModules())[key];
}

/** Use at the top of pages, actions and API routes that belong to a module. */
export async function requireModule(key: ModuleKey) {
  if (!(await isModuleEnabled(key))) notFound();
}
