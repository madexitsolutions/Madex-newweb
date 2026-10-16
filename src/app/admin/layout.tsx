import type { Metadata } from "next";
import "./admin.css";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [general, branding] = await Promise.all([getSettings("general"), getSettings("branding")]);
  return {
    title: { default: "Dashboard", template: `%s · ${general.siteName} Dashboard` },
    robots: { index: false, follow: false },
    // favicon from Einstellungen → Branding
    ...(branding.faviconUrl ? { icons: { icon: branding.faviconUrl } } : {}),
  };
}

/** The installation's brand colours drive the dashboard accents. */
export default async function AdminRoot({ children }: { children: React.ReactNode }) {
  const b = await getSettings("branding");
  return (
    <div className="adm" style={{ ["--a-petrol" as string]: b.primaryColor, ["--a-teal" as string]: b.accentColor }}>
      {children}
    </div>
  );
}
