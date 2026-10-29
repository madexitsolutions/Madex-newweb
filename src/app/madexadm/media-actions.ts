"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type FormState } from "@/lib/form-state";
import { audit } from "@/server/audit";
import { getCurrentUser, checkPermission } from "@/server/auth/session";
import { getMedia, listMedia, mediaUsage, toRef, updateAlt, type MediaRef, type MediaType } from "@/server/media/library";
import { deleteMedia } from "@/server/media/store";

const PICKER_PERMS = ["media.manage", "content.manage", "products.manage", "seo.manage", "settings.manage"] as const;

/** Media list for the picker dialog (anyone who edits content that holds images). */
export async function pickerListAction(input: { q?: string; type?: MediaType; page?: number }): Promise<{ items: MediaRef[]; total: number; pages: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !PICKER_PERMS.some((p) => user.permissions.has(p))) return { items: [], total: 0, pages: 1, error: "Keine Berechtigung für die Mediathek." };
  const parsed = z.object({ q: z.string().max(100).optional(), type: z.enum(["all", "image", "pdf"]).optional(), page: z.number().int().min(1).max(10_000).optional() }).safeParse(input);
  if (!parsed.success) return { items: [], total: 0, pages: 1, error: "Ungültige Anfrage." };
  const page = parsed.data.page ?? 1;
  const per = 24;
  const { rows, total } = await listMedia({ q: parsed.data.q?.trim(), type: parsed.data.type ?? "all" }, page, per);
  return { items: rows.map(toRef), total, pages: Math.max(1, Math.ceil(total / per)) };
}

export async function updateAltAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("media.manage");
  if (!user) return fail("Keine Berechtigung.");
  const id = String(f.get("id") ?? "");
  const alt = String(f.get("alt") ?? "").trim();
  if (alt.length > 300) return fail("Der Alternativtext ist zu lang (max. 300 Zeichen).", { alt: "Max. 300 Zeichen." });
  const row = await updateAlt(id, alt);
  if (!row) return fail("Die Datei wurde nicht gefunden – sie wurde vielleicht gelöscht.");
  await audit(user, "media.updated", { entityType: "media", entityId: id, summary: `Alternativtext von «${row.filename}» geändert` });
  revalidatePath("/madexadm/medien");
  return ok("Alternativtext gespeichert.");
}

export async function deleteMediaAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("media.manage");
  if (!user) return fail("Keine Berechtigung.");
  const id = String(f.get("id") ?? "");
  const m = await getMedia(id);
  if (!m) return fail("Die Datei wurde nicht gefunden – sie wurde vielleicht schon gelöscht.");
  const usage = await mediaUsage(m);
  if (usage.length && f.get("confirm") !== "on") return fail(`Die Datei wird noch ${usage.length}× verwendet. Bestätigen Sie, dass Sie sie trotzdem löschen möchten.`, { confirm: "Bitte bestätigen." });
  await deleteMedia(id);
  await audit(user, "media.deleted", { entityType: "media", entityId: id, summary: `Datei «${m.filename}» gelöscht${usage.length ? ` (war ${usage.length}× verwendet)` : ""}` });
  revalidatePath("/madexadm/medien");
  const back = String(f.get("back") ?? "/madexadm/medien");
  redirect(back.startsWith("/madexadm/medien") ? back : "/madexadm/medien");
}
