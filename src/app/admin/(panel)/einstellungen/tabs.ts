import { AVAILABLE_PLUGINS } from "@/modules/registry";
import type { IconName } from "@/components/admin/kit";

const BASE = "/admin/einstellungen";
/** plugins with their own settings form (admin/(panel)/plugins/[key]) */
export const PLUGIN_FORMS = ["inquiries", "seo", "analytics", "cookies", "announcement", "maintenance", "customCode"] as const;
const LABELS: Record<string, string> = { inquiries: "Kontaktformular", analytics: "Google Analytics" };

/** Einstellungen: own tabs, then the settings of the plugins this website uses (always on). */
export const SETTINGS_TABS: { key: string; label: string; href: string; icon: IconName }[] = [
  { key: "allgemein", label: "Allgemein", href: BASE, icon: "building" },
  { key: "branding", label: "Branding", href: `${BASE}?tab=branding`, icon: "palette" },
  { key: "email", label: "E-Mail", href: `${BASE}?tab=email`, icon: "mail" },
  ...AVAILABLE_PLUGINS.filter((p) => (PLUGIN_FORMS as readonly string[]).includes(p.key)).map((p) => ({ key: p.key, label: LABELS[p.key] ?? p.name, href: `/admin/plugins/${p.key}`, icon: p.icon })),
];
