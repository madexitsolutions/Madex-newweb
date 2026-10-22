"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, formBool, formString, ok, type FormState } from "@/lib/form-state";
import { isModuleEnabled } from "@/modules/registry";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { clearNotFound, deleteRedirect, saveRedirect } from "@/server/site/redirects";

const NO_ACCESS = "Keine Berechtigung. Weiterleitungen braucht das Recht «SEO-Titel und -Beschreibungen bearbeiten».";

async function guard() {
  const user = await checkPermission("seo.manage");
  if (!user || !(await isModuleEnabled("redirects"))) return null;
  return user;
}

export async function saveRedirectAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  const id = formString(f, "id") || null;
  const res = await saveRedirect({ id, from: formString(f, "from"), to: formString(f, "to"), permanent: formString(f, "type") !== "302" });
  if (!res.ok) return fail(res.error, res.field ? { [res.field]: res.error } : undefined);
  await audit(user, id ? "redirect.updated" : "redirect.created", { entityType: "redirect", entityId: res.redirect.id, summary: `Weiterleitung ${res.redirect.fromPath} → ${res.redirect.toUrl}` });
  revalidatePath("/admin/weiterleitungen");
  if (id) redirect("/admin/weiterleitungen?gespeichert=1");
  return ok(`Weiterleitung von ${res.redirect.fromPath} gespeichert.`);
}

export async function deleteRedirectAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  const row = await deleteRedirect(formString(f, "id"));
  if (row) await audit(user, "redirect.deleted", { entityType: "redirect", entityId: row.id, summary: `Weiterleitung ${row.fromPath} gelöscht` });
  revalidatePath("/admin/weiterleitungen");
  return ok("Gelöscht.");
}

export async function clearNotFoundAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  await clearNotFound(formBool(f, "all") ? undefined : formString(f, "path"));
  revalidatePath("/admin/weiterleitungen");
  return ok("Entfernt.");
}
