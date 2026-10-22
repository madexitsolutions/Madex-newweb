"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, formString, type FormState } from "@/lib/form-state";
import { pluginByKey, type PluginKey } from "@/modules/registry";
import { checkPermission } from "@/server/auth/session";
import { setPluginActive } from "@/server/plugins";

export async function togglePluginAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("settings.manage");
  if (!user) return fail("Keine Berechtigung. Plugins verwalten braucht das Recht «Allgemeine Einstellungen und Plugins».");
  const plugin = pluginByKey(formString(f, "key"));
  if (!plugin) return fail("Dieses Plugin gibt es nicht. Laden Sie die Seite neu.");
  const active = formString(f, "active") === "1";
  const res = await setPluginActive(user, plugin.key as PluginKey, active);
  if ("error" in res) return fail(res.error ?? "Unbekannter Fehler.");
  revalidatePath("/", "layout");
  return ok(active ? `«${plugin.name}» ist aktiv.` : `«${plugin.name}» ist deaktiviert. Die Daten bleiben erhalten.`);
}
