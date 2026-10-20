import type { Metadata } from "next";
import "./admin.css";
import { defaults, getSettings, type Settings, type SettingsKey } from "@/server/settings";

/** Settings or their defaults when the database is unavailable (so /admin/status still renders). */
async function safe<K extends SettingsKey>(key: K): Promise<Settings[K]> {
  try {
    return await getSettings(key);
  } catch {
    return defaults(key);
  }
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [general, branding] = await Promise.all([safe("general"), safe("branding")]);
  return {
    title: { default: "Dashboard", template: `%s · ${general.siteName} Dashboard` },
    robots: { index: false, follow: false },
    // favicon from Einstellungen → Branding
    ...(branding.faviconUrl ? { icons: { icon: branding.faviconUrl } } : {}),
  };
}

/** The installation's brand colours drive the dashboard accents. */
export default async function AdminRoot({ children }: { children: React.ReactNode }) {
  const b = await safe("branding");
  return (
    <div className="adm" style={{ ["--a-petrol" as string]: b.primaryColor, ["--a-teal" as string]: b.accentColor }}>
      {children}
    </div>
  );
}
