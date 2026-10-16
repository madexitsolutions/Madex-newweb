"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type FormState } from "@/lib/form-state";
import { checkPermission } from "@/server/auth/session";
import { isModuleEnabled } from "@/modules/registry";
import { deleteCategory, saveCategory } from "@/server/shop/categories";
import { toFormState } from "@/server/shop/errors";

async function guard() {
  const user = await checkPermission("products.manage");
  if (!user || !(await isModuleEnabled("shop"))) return null;
  return user;
}

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function saveCategoryAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung.");
  const id = s(f, "id") || null;
  const sortRaw = s(f, "sort");
  try {
    const row = await saveCategory(
      id,
      {
        name: s(f, "name"),
        slug: s(f, "slug"),
        parentId: s(f, "parentId") || null,
        description: String(f.get("description") ?? ""),
        imageId: s(f, "imageId") || null,
        sort: sortRaw === "" ? 0 : Number(sortRaw),
        seoTitle: s(f, "seoTitle"),
        seoDescription: s(f, "seoDescription"),
      },
      user,
    );
    revalidatePath("/admin/kategorien");
    return ok(id ? "Kategorie gespeichert." : `Kategorie «${row.name}» erstellt.`, { id: row.id });
  } catch (e) {
    return toFormState(e);
  }
}

export async function deleteCategoryAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung.");
  try {
    await deleteCategory(s(f, "id"), user);
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath("/admin/kategorien");
  return ok("Kategorie gelöscht. Unterkategorien sind eine Ebene nach oben gerückt.");
}
