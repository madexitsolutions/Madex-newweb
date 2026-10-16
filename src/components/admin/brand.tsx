import { getSettings } from "@/server/settings";

/** Logo of the installation (light version on dark surfaces), or its name as text. */
export async function Brand({ dark = false, className }: { dark?: boolean; className?: string }) {
  const [b, g] = await Promise.all([getSettings("branding"), getSettings("general")]);
  const src = dark ? b.logoDarkUrl || b.logoUrl : b.logoUrl;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={g.siteName} className={className} />;
  }
  return <span className={`a-brandtext${className ? " " + className : ""}`}>{g.siteName}</span>;
}
