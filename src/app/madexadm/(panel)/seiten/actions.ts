"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, formBool, formString, ok, type FormState } from "@/lib/form-state";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { deletePage, savePage } from "@/server/site/pages";

const NO_ACCESS = "Keine Berechtigung. Seiten bearbeiten braucht das Recht «Website: Seiten, Menüs, Texte und Bilder bearbeiten».";

export async function savePageAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("website.manage");
  if (!user) return fail(NO_ACCESS);
  const id = formString(f, "id") || null;
  const res = await savePage(id, {
    title: formString(f, "title"),
    slug: formString(f, "slug"),
    body: String(f.get("body") ?? ""),
    status: formString(f, "status") === "published" ? "published" : "draft",
    coverId: formString(f, "coverId") || null,
    showTitle: formBool(f, "showTitle"),
    seoTitle: formString(f, "seoTitle"),
    seoDescription: formString(f, "seoDescription"),
    noindex: formBool(f, "noindex"),
  });
  if (!res.ok) return fail(res.error, res.fieldErrors);
  const p = res.page;
  await audit(user, id ? "page.updated" : "page.created", { entityType: "page", entityId: p.id, summary: `Seite «${p.title}» ${id ? "gespeichert" : "erstellt"} (${p.status === "published" ? "veröffentlicht" : "Entwurf"})` });
  revalidatePath("/", "layout");
  if (!id) redirect(`/madexadm/seiten/${p.id}?neu=1`);
  return ok((p.status === "published" ? "Gespeichert und veröffentlicht." : "Entwurf gespeichert.") + (res.slugAdjusted ? ` Die Adresse war schon vergeben und lautet jetzt /${p.slug}.` : ""), { slug: p.slug });
}

export async function deletePageAction(f: FormData) {
  const user = await checkPermission("website.manage");
  if (!user) return;
  const row = await deletePage(formString(f, "id"));
  if (row) await audit(user, "page.deleted", { entityType: "page", entityId: row.id, summary: `Seite «${row.title}» gelöscht` });
  revalidatePath("/", "layout");
  redirect("/madexadm/seiten?geloescht=1");
}
