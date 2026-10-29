"use server";

import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { fail, ok, type FormState } from "@/lib/form-state";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { media } from "@/server/db/schema";
import { sanitizeHtml } from "@/server/lib/sanitize";
import { mediaPath } from "@/server/media/store";
import { getSettings, saveSettings } from "@/server/settings";
import { CONTENT } from "@/site/fields";

export async function saveTextsAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("website.manage");
  if (!user) return fail("Keine Berechtigung. Texte bearbeiten braucht das Recht «Website: Seiten, Menüs, Texte und Bilder bearbeiten».");
  const group = CONTENT.find((g) => g.key === String(f.get("_group") ?? ""));
  if (!group) return fail("Dieser Bereich existiert nicht mehr. Laden Sie die Seite neu.");

  const imageIds = group.fields.filter((x) => x.type === "image").map((x) => String(f.get(x.key) ?? "")).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  const files = imageIds.length ? await db.select({ id: media.id, path: media.path }).from(media).where(inArray(media.id, imageIds)) : [];
  const pathOf = new Map(files.map((m) => [m.id, mediaPath(m.path)]));

  const next: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const field of group.fields) {
    const raw = String(f.get(field.key) ?? "");
    let v = raw.trim();
    if (field.type === "toggle") v = f.get(field.key) ? "1" : "0";
    else if (field.type === "image") v = pathOf.get(v) ?? "";
    else if (field.type === "richtext") v = sanitizeHtml(raw);
    else if (field.type === "url" && v && !v.startsWith("/") && !v.startsWith("#") && !/^(https?:|mailto:|tel:)/i.test(v)) {
      if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) v = `https://${v}`;
      else errors[field.key] = `«${field.label}»: Geben Sie eine Adresse wie /kontakt, https://… oder tel:… ein.`;
    }
    if (v.length > (field.type === "richtext" ? 50_000 : 2_000)) errors[field.key] = `«${field.label}» ist zu lang.`;
    next[field.key] = v;
  }
  if (Object.keys(errors).length) return fail(Object.values(errors)[0], errors);

  const stored = await getSettings("siteContent");
  await saveSettings("siteContent", { ...stored, ...next }, user.id);
  await audit(user, "content.updated", { entityType: "siteContent", entityId: group.key, summary: `Texte & Bilder: «${group.title}» gespeichert` });
  revalidatePath("/", "layout");
  return ok("Gespeichert. Die Website zeigt die Änderung sofort.");
}

export async function resetTextsAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("website.manage");
  if (!user) return fail("Keine Berechtigung.");
  const group = CONTENT.find((g) => g.key === String(f.get("_group") ?? ""));
  if (!group) return fail("Dieser Bereich existiert nicht mehr. Laden Sie die Seite neu.");
  const stored = { ...(await getSettings("siteContent")) };
  for (const field of group.fields) delete stored[field.key];
  await saveSettings("siteContent", stored, user.id, { replace: true });
  await audit(user, "content.reset", { entityType: "siteContent", entityId: group.key, summary: `Texte & Bilder: «${group.title}» auf Standard zurückgesetzt` });
  revalidatePath("/", "layout");
  return ok("Auf die Standardtexte zurückgesetzt.");
}
