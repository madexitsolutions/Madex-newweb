"use server";

import { revalidatePath } from "next/cache";
import { fail, formString, ok, type FormState } from "@/lib/form-state";
import { isModuleEnabled } from "@/modules/registry";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { savePost } from "@/server/content/posts";
import { markNotificationsRead } from "@/server/analytics/overview";

/** Marks one notification (field "id") or all visible ones as read for the current user. */
export async function markReadAction(f: FormData) {
  const user = await checkPermission("dashboard.view");
  if (!user) return;
  const id = String(f.get("id") ?? "");
  await markNotificationsRead(user, /^[0-9a-f-]{36}$/i.test(id) ? id : undefined);
  revalidatePath("/admin");
}

/** "Schnellentwurf": a post draft from the start page. */
export async function quickDraftAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("content.manage");
  if (!user) return fail("Keine Berechtigung. Beiträge schreiben braucht das Recht «Beiträge erstellen und veröffentlichen».");
  if (!(await isModuleEnabled("blog"))) return fail("Das Plugin «Beiträge» ist nicht aktiv.");
  const title = formString(f, "title");
  if (!title) return fail("Geben Sie einen Titel ein.");
  const text = formString(f, "text");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const res = await savePost(null, { title, body: text ? text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("") : "", status: "draft", authorId: user.id });
  if (!res.ok) return fail(res.error);
  await audit(user, "post.created", { entityType: "post", entityId: res.post.id, summary: `Entwurf «${res.post.title}» erstellt` });
  revalidatePath("/admin");
  return ok("Entwurf gespeichert.", { id: res.post.id });
}
