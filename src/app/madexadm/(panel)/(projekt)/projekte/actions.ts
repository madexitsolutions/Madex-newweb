"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, formString, ok, type FormState } from "@/lib/form-state";
import {
  deleteProject,
  projectInput,
  saveProject,
} from "@/lib/server/projects";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { getMedia } from "@/server/media/library";
import { mediaPath } from "@/server/media/store";

const NO_RIGHT =
  "Keine Berechtigung. Dafür braucht es das Recht «Beiträge erstellen und veröffentlichen».";

function refresh(...slugs: string[]) {
  revalidatePath("/");
  revalidatePath("/website-portfolio");
  revalidatePath("/sitemap.xml");
  revalidatePath("/madexadm/seo");
  for (const s of slugs) if (s) revalidatePath(`/${s}`);
}

export async function saveProjectAction(
  _: FormState,
  f: FormData,
): Promise<FormState> {
  const user = await checkPermission("content.manage");
  if (!user) return fail(NO_RIGHT);
  let cover = formString(f, "cover");
  const coverId = formString(f, "coverId");
  if (coverId) {
    const m = await getMedia(coverId);
    if (m) cover = mediaPath(m.path);
  }
  const parsed = projectInput.safeParse({
    original: formString(f, "original"),
    title: formString(f, "title"),
    client: formString(f, "client"),
    slug: formString(f, "slug"),
    date: formString(f, "date"),
    description: formString(f, "description"),
    external: formString(f, "external"),
    cover,
    content: formString(f, "content"),
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".")] ??= i.message;
    return fail(parsed.error.issues[0].message, fe);
  }
  const v = parsed.data;
  const r = await saveProject(v);
  if (!r.ok) return fail(r.message, { [r.field]: r.message });
  await audit(user, v.original ? "project.updated" : "project.created", {
    entityType: "project",
    entityId: r.slug,
    summary: `Projekt «${v.title}» ${v.original ? "geändert" : "angelegt"}`,
  });
  refresh(r.slug, v.original);
  if (r.slug !== v.original)
    redirect(`/madexadm/projekte?bearbeiten=${r.slug}&gespeichert=1`);
  return ok("Gespeichert. Die Projektseite ist aktualisiert.");
}

export async function deleteProjectAction(f: FormData) {
  const user = await checkPermission("content.manage");
  if (!user) return;
  const slug = formString(f, "slug");
  await deleteProject(slug);
  await audit(user, "project.deleted", {
    entityType: "project",
    entityId: slug,
    summary: `Projekt /${slug} gelöscht`,
  });
  refresh(slug);
  redirect("/madexadm/projekte");
}
