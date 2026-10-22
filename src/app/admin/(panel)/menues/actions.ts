"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type FormState } from "@/lib/form-state";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { saveSettings } from "@/server/settings";

const item = z.object({
  label: z.string().trim().min(1, "Jeder Menüpunkt braucht eine Beschriftung.").max(60, "Beschriftungen haben höchstens 60 Zeichen."),
  url: z
    .string()
    .trim()
    .min(1, "Jeder Menüpunkt braucht ein Ziel.")
    .max(500)
    .refine((v) => v.startsWith("/") || v.startsWith("#") || /^(https?:|mailto:|tel:)/i.test(v), "Ziele beginnen mit /, https://, mailto: oder tel:."),
});
const menus = z.object({ header: z.array(item).max(12, "Höchstens 12 Menüpunkte."), footer: z.array(item).max(12, "Höchstens 12 Menüpunkte.") });

export async function saveMenusAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("website.manage");
  if (!user) return fail("Keine Berechtigung. Menüs bearbeiten braucht das Recht «Website: Seiten, Menüs, Texte und Bilder bearbeiten».");
  let raw: unknown;
  try {
    raw = JSON.parse(String(f.get("menus") ?? "{}"));
  } catch {
    return fail("Die Menüs konnten nicht gelesen werden. Laden Sie die Seite neu.");
  }
  const v = menus.safeParse(raw);
  if (!v.success) return fail(v.error.issues[0].message);
  await saveSettings("menus", v.data, user.id, { replace: true });
  await audit(user, "menus.updated", { entityType: "settings", entityId: "menus", summary: `Menüs gespeichert (${v.data.header.length} oben, ${v.data.footer.length} unten)` });
  revalidatePath("/", "layout");
  return ok("Menüs gespeichert. Die Website zeigt sie sofort.");
}
