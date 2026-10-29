import type { IconName } from "@/components/admin/kit";

const BASE = "/madexadm/einstellungen";

/** Einstellungen of the Madex dashboard – integrations (Google, SMTP, OpenAI) are set in .env. */
export const SETTINGS_TABS: { key: string; label: string; href: string; icon: IconName }[] = [
  { key: "allgemein", label: "Allgemein", href: BASE, icon: "building" },
  { key: "branding", label: "Branding", href: `${BASE}?tab=branding`, icon: "palette" },
  { key: "email", label: "E-Mail", href: `${BASE}?tab=email`, icon: "mail" },
];
