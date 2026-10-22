/**
 * Permission catalogue. Each permission is checked server-side in pages,
 * server actions and API routes; the navigation only hides what you may not use.
 */
export const PERMISSIONS = {
  "dashboard.view": { group: "Allgemein", label: "Übersicht ansehen" },
  "analytics.view": { group: "Allgemein", label: "Statistiken und Google Analytics ansehen" },

  "orders.view": { group: "Shop", label: "Bestellungen ansehen" },
  "orders.manage": { group: "Shop", label: "Bestellungen bearbeiten, versenden, stornieren" },
  "orders.refund": { group: "Shop", label: "Rückerstattungen auslösen" },
  "products.view": { group: "Shop", label: "Produkte ansehen" },
  "products.manage": { group: "Shop", label: "Produkte, Kategorien und Lager bearbeiten" },
  "customers.view": { group: "Shop", label: "Kunden ansehen" },
  "customers.manage": { group: "Shop", label: "Kunden bearbeiten und löschen" },
  "discounts.manage": { group: "Shop", label: "Gutscheine verwalten" },
  "shop.settings": { group: "Shop", label: "Shop-Einstellungen, Versand, Steuern, Zahlungsarten" },

  "website.manage": { group: "Inhalte", label: "Website: Seiten, Menüs, Texte und Bilder bearbeiten" },
  "content.view": { group: "Inhalte", label: "Beiträge ansehen" },
  "content.manage": { group: "Inhalte", label: "Beiträge erstellen und veröffentlichen" },
  "media.manage": { group: "Inhalte", label: "Mediathek verwalten" },
  "seo.manage": { group: "Inhalte", label: "SEO-Titel und -Beschreibungen bearbeiten" },

  "inquiries.view": { group: "Anfragen", label: "Anfragen ansehen" },
  "inquiries.manage": { group: "Anfragen", label: "Anfragen bearbeiten und löschen" },

  "users.view": { group: "System", label: "Benutzer ansehen" },
  "users.manage": { group: "System", label: "Benutzer einladen, ändern, sperren" },
  "roles.manage": { group: "System", label: "Rollen und Berechtigungen ändern" },
  "settings.manage": { group: "System", label: "Allgemeine Einstellungen und Plugins" },
  "integrations.manage": { group: "System", label: "API-Schlüssel, Webhooks und Verbindungen" },
  "security.manage": { group: "System", label: "Sicherheitsrichtlinien und Sperren" },
  "audit.view": { group: "System", label: "Protokoll ansehen" },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

const ADMIN_ONLY: Permission[] = ["roles.manage", "security.manage"];

export const SYSTEM_ROLES: { key: string; name: string; description: string; permissions: Permission[] }[] = [
  { key: "owner", name: "Inhaber", description: "Voller Zugriff. Kann nicht gelöscht oder eingeschränkt werden.", permissions: ALL_PERMISSIONS },
  { key: "admin", name: "Administrator", description: "Voller Zugriff auf alle Bereiche.", permissions: ALL_PERMISSIONS },
  {
    key: "shop_manager",
    name: "Shop-Verwaltung",
    description: "Bestellungen, Produkte, Kunden, Gutscheine und Shop-Einstellungen.",
    permissions: [
      "dashboard.view",
      "analytics.view",
      "orders.view",
      "orders.manage",
      "orders.refund",
      "products.view",
      "products.manage",
      "customers.view",
      "customers.manage",
      "discounts.manage",
      "shop.settings",
      "media.manage",
      "inquiries.view",
    ],
  },
  {
    key: "editor",
    name: "Redaktion",
    description: "Website-Inhalte, Beiträge, Mediathek, SEO und Anfragen.",
    permissions: ["dashboard.view", "website.manage", "content.view", "content.manage", "media.manage", "seo.manage", "inquiries.view", "inquiries.manage", "products.view"],
  },
  {
    key: "support",
    name: "Kundendienst",
    description: "Bestellungen bearbeiten, Kunden und Anfragen betreuen – ohne Einstellungen.",
    permissions: ["dashboard.view", "orders.view", "orders.manage", "customers.view", "inquiries.view", "inquiries.manage", "products.view"],
  },
  {
    key: "viewer",
    name: "Nur lesen",
    description: "Sieht Übersicht, Statistiken, Bestellungen und Anfragen, kann nichts ändern.",
    permissions: ["dashboard.view", "analytics.view", "orders.view", "products.view", "customers.view", "content.view", "inquiries.view"],
  },
];

export function isPermission(p: string): p is Permission {
  return p in PERMISSIONS;
}

/** Custom roles may hold any permission except the admin-only ones unless granted by an owner/admin. */
export function sanitizePermissions(list: string[], allowAdminOnly: boolean): Permission[] {
  return [...new Set(list.filter(isPermission))].filter((p) => allowAdminOnly || !ADMIN_ONLY.includes(p));
}
