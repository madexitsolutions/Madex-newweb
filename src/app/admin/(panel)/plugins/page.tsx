import { redirect } from "next/navigation";

/** The plugins of this website are fixed (src/site/project.ts) – their settings are tabs in Einstellungen. */
export default function PluginsPage() {
  redirect("/admin/einstellungen");
}
