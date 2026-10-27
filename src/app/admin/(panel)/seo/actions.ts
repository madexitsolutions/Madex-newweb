"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, formBool, formString, ok, type FormState } from "@/lib/form-state";
import { isModuleEnabled } from "@/modules/registry";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { seoEntries } from "@/server/db/schema";
import { addMissingPaths, normalizePath, seoInput, sitemapPaths } from "@/server/content/seo";
import { getMedia } from "@/server/media/library";
import { mediaUrl } from "@/server/media/store";
import { getSettings } from "@/server/settings";
import { PROJECT } from "@/site/project";

async function guard() {
  const user = await checkPermission("seo.manage");
  if (!user) return { error: fail("Keine Berechtigung für SEO.") };
  if (!(await isModuleEnabled("seo"))) return { error: fail("Das Plugin «SEO» ist nicht aktiv. Aktivieren Sie es unter Plugins.") };
  return { user };
}

export async function saveSeoAction(_: FormState, f: FormData): Promise<FormState> {
  const g = await guard();
  if (!g.user) return g.error;
  const original = normalizePath(formString(f, "original"));
  let ogImage = formString(f, "ogImage");
  const ogMediaId = formString(f, "ogMediaId");
  if (ogMediaId) {
    const m = await getMedia(ogMediaId);
    if (m) ogImage = mediaUrl(m.path);
  }
  const parsed = seoInput.safeParse({
    path: formString(f, "path"),
    title: formString(f, "title"),
    description: formString(f, "description"),
    canonical: formString(f, "canonical"),
    ogImage,
    noindex: formBool(f, "noindex"),
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".")] ??= i.message;
    return fail(parsed.error.issues[0].message, fe);
  }
  const v = parsed.data;
  if (v.path !== original) {
    const [taken] = await db.select({ p: seoEntries.path }).from(seoEntries).where(eq(seoEntries.path, v.path));
    if (taken) return fail(`Für ${v.path} gibt es schon einen Eintrag. Bearbeiten Sie diesen oder wählen Sie einen anderen Pfad.`, { path: "Bereits vorhanden." });
  }
  // a website page saved unchanged keeps using the website's own defaults
  const site = PROJECT.seoPages ? (await PROJECT.seoPages()).find((p) => p.path === v.path) : undefined;
  if (site && original === v.path && v.title === site.title.trim() && v.description === site.description.trim() && !v.canonical && !v.ogImage && !v.noindex) {
    const [had] = await db.select({ p: seoEntries.path }).from(seoEntries).where(eq(seoEntries.path, v.path));
    if (had) {
      await db.delete(seoEntries).where(eq(seoEntries.path, v.path));
      await audit(g.user, "seo.deleted", { entityType: "seo", entityId: v.path, summary: `SEO für ${v.path} auf Standard zurückgesetzt` });
    }
    revalidatePath("/admin/seo");
    revalidatePath(v.path);
    return ok("Gespeichert. Die Seite verwendet die Standardangaben der Website.");
  }
  const values = { path: v.path, title: v.title || null, description: v.description || null, canonical: v.canonical || null, ogImage: v.ogImage || null, noindex: v.noindex, updatedAt: new Date() };
  await db.transaction(async (tx) => {
    if (original && original !== v.path) await tx.delete(seoEntries).where(eq(seoEntries.path, original));
    await tx.insert(seoEntries).values(values).onConflictDoUpdate({ target: seoEntries.path, set: values });
  });
  await audit(g.user, original ? "seo.updated" : "seo.created", { entityType: "seo", entityId: v.path, summary: `SEO für ${v.path} ${original ? "geändert" : "angelegt"}${original && original !== v.path ? ` (vorher ${original})` : ""}` });
  revalidatePath("/admin/seo");
  revalidatePath(v.path);
  if (v.path !== original) redirect(`/admin/seo?bearbeiten=${encodeURIComponent(v.path)}&gespeichert=1`);
  return ok("Gespeichert. Die Website übernimmt die Angaben beim nächsten Abruf.");
}

export async function deleteSeoAction(f: FormData) {
  const g = await guard();
  if (!g.user) return;
  const path = normalizePath(formString(f, "path"));
  if (path) {
    await db.delete(seoEntries).where(eq(seoEntries.path, path));
    await audit(g.user, "seo.deleted", { entityType: "seo", entityId: path, summary: `SEO-Eintrag ${path} gelöscht` });
    revalidatePath(path);
  }
  revalidatePath("/admin/seo");
  redirect("/admin/seo");
}

export async function importSitemapAction(_: FormState): Promise<FormState> {
  const g = await guard();
  if (!g.user) return g.error;
  const { siteUrl } = await getSettings("general");
  if (!siteUrl) return fail("Die Adresse der Website fehlt. Tragen Sie sie unter Einstellungen → Allgemein ein.");
  let result: Awaited<ReturnType<typeof sitemapPaths>>;
  try {
    result = await sitemapPaths(siteUrl);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die Sitemap konnte nicht gelesen werden.");
  }
  if (!result.paths.length) return fail(`In ${siteUrl.replace(/\/$/, "")}/sitemap.xml wurden keine Seiten gefunden.${result.errors.length ? ` ${result.errors[0]}` : ""} Prüfen Sie, ob die Website eine Sitemap hat.`);
  const added = await addMissingPaths(result.paths);
  await audit(g.user, "seo.sitemap_imported", { entityType: "seo", summary: `${added} Pfade aus der Sitemap übernommen (${result.paths.length} gefunden)` });
  revalidatePath("/admin/seo");
  const warn = result.errors.length ? ` ${result.errors.length} Teil-Sitemap(s) konnten nicht gelesen werden.` : "";
  return ok(added ? `${added} neue Seite${added === 1 ? "" : "n"} übernommen (${result.paths.length} in der Sitemap).${warn}` : `Alle ${result.paths.length} Seiten der Sitemap sind bereits erfasst.${warn}`);
}
