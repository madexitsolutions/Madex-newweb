"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, formList, formString, ok, type FormState } from "@/lib/form-state";
import { parseLocalDateTime } from "@/lib/tz";
import { isModuleEnabled } from "@/modules/registry";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { deletePost, savePost, type PostStatus } from "@/server/content/posts";

const STATUS_LABEL: Record<PostStatus, string> = { draft: "Entwurf", scheduled: "Geplant", published: "Veröffentlicht" };

export async function savePostAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("content.manage");
  if (!user) return fail("Keine Berechtigung. Beiträge bearbeiten darf nur, wer die Berechtigung «Beiträge erstellen und veröffentlichen» hat.");
  if (!(await isModuleEnabled("blog"))) return fail("Das Modul Beiträge ist ausgeschaltet.");
  const id = formString(f, "id") || null;
  const rawStatus = formString(f, "status");
  let status: PostStatus = rawStatus === "published" || rawStatus === "scheduled" ? rawStatus : "draft";
  const dateRaw = formString(f, "publishedAt");
  const publishedAt = dateRaw ? parseLocalDateTime(dateRaw) : null;
  if (dateRaw && !publishedAt) return fail("Das Veröffentlichungsdatum ist ungültig. Bitte Datum und Uhrzeit wählen.", { publishedAt: "Ungültiges Datum." });
  const now = new Date();
  let note = "";
  if (status === "published" && publishedAt && publishedAt > now) {
    status = "scheduled";
    note = " Das Datum liegt in der Zukunft – der Beitrag wurde deshalb geplant.";
  }
  if (status === "scheduled" && publishedAt && publishedAt <= now) note = " Das geplante Datum ist bereits erreicht – der Beitrag ist sichtbar.";

  const res = await savePost(
    id,
    {
      title: formString(f, "title"),
      slug: formString(f, "slug"),
      excerpt: formString(f, "excerpt"),
      body: String(f.get("body") ?? ""),
      coverId: formString(f, "coverId") || null,
      category: formString(f, "category"),
      tags: formList(f, "tags"),
      authorId: formString(f, "authorId") || null,
      seoTitle: formString(f, "seoTitle"),
      seoDescription: formString(f, "seoDescription"),
      status,
      publishedAt,
    },
    now,
  );
  if (!res.ok) return fail(res.error, res.fieldErrors);
  const p = res.post;
  await audit(user, id ? "post.updated" : "post.created", { entityType: "post", entityId: p.id, summary: `Beitrag «${p.title}» ${id ? "gespeichert" : "erstellt"} (${STATUS_LABEL[p.status]})` });
  if (res.wentLive) await audit(user, "post.published", { entityType: "post", entityId: p.id, summary: `Beitrag «${p.title}» veröffentlicht` });
  revalidatePath("/admin/beitraege");
  if (res.slugAdjusted) note += ` Die Adresse war schon vergeben und lautet jetzt «${p.slug}».`;
  if (!id) redirect(`/admin/beitraege/${p.id}?neu=1`);
  revalidatePath(`/admin/beitraege/${p.id}`);
  return ok((res.wentLive ? "Beitrag veröffentlicht." : p.status === "scheduled" ? "Beitrag gespeichert und geplant." : "Beitrag gespeichert.") + note, { slug: p.slug, status: p.status });
}

export async function deletePostAction(f: FormData) {
  const user = await checkPermission("content.manage");
  if (!user) return;
  const row = await deletePost(formString(f, "id"));
  if (row) await audit(user, "post.deleted", { entityType: "post", entityId: row.id, summary: `Beitrag «${row.title}» gelöscht` });
  revalidatePath("/admin/beitraege");
  redirect("/admin/beitraege?geloescht=1");
}
