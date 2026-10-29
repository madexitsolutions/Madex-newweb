"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type FormState } from "@/lib/form-state";
import { parseMoney } from "@/lib/format";
import { PRODUCT_STATUS, PRODUCT_TYPES } from "@/lib/catalog";
import { checkPermission } from "@/server/auth/session";
import { isModuleEnabled } from "@/modules/registry";
import { mediaPath, saveUpload } from "@/server/media/store";
import { deleteProducts, duplicateProduct, saveProduct, setProductsStatus, type VariantInput } from "@/server/shop/catalog";
import { toFormState } from "@/server/shop/errors";
import { deleteImportFile, planImport, readImportFile, runImport, storeImportFile, storeImportResult } from "@/server/shop/import-export";

async function guard() {
  const user = await checkPermission("products.manage");
  if (!user || !(await isModuleEnabled("shop"))) return null;
  return user;
}

const safeBack = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return s.startsWith("/madexadm/produkte") && !s.startsWith("//") ? s : "/madexadm/produkte";
};
const withMsg = (url: string, msg: string) => `${url}${url.includes("?") ? "&" : "?"}meldung=${encodeURIComponent(msg)}`;

/* ------------------------------------------------------------ editor */

type RawVariant = {
  id?: string;
  optionValues?: string[];
  sku?: string;
  barcode?: string;
  price?: string;
  compareAtPrice?: string;
  costPrice?: string;
  stock?: string;
  stockOriginal?: number | null;
  trackInventory?: boolean;
  allowBackorder?: boolean;
  weightGrams?: string;
  imageId?: string | null;
  active?: boolean;
};

function json<T>(value: FormDataEntryValue | null, fallback: T): T {
  try {
    return value ? (JSON.parse(String(value)) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Form strings → Rappen/ints with field errors that name the problem. */
function parseVariants(raw: RawVariant[]) {
  const errors: Record<string, string> = {};
  const variants: VariantInput[] = raw.map((v, i) => {
    const money = (key: "price" | "compareAtPrice" | "costPrice", required: boolean) => {
      const s = (v[key] ?? "").trim();
      if (!s) {
        if (required) errors[`variants.${i}.${key}`] = "Bitte einen Preis eingeben, z. B. 29.90.";
        return null;
      }
      const c = parseMoney(s);
      if (c === null || c < 0) errors[`variants.${i}.${key}`] = "Ungültiger Betrag. Schreiben Sie z. B. 29.90.";
      return c;
    };
    const int = (key: "stock" | "weightGrams", label: string) => {
      const s = (v[key] ?? "").trim().replace(/[’'\s]/g, "");
      if (!s) return null;
      if (!/^-?\d+$/.test(s)) {
        errors[`variants.${i}.${key}`] = `${label} muss eine ganze Zahl sein.`;
        return null;
      }
      return Number(s);
    };
    const weight = int("weightGrams", "Das Gewicht (in Gramm)");
    if (weight !== null && weight < 0) errors[`variants.${i}.weightGrams`] = "Das Gewicht darf nicht negativ sein.";
    return {
      id: v.id && z.string().uuid().safeParse(v.id).success ? v.id : undefined,
      optionValues: Array.isArray(v.optionValues) ? v.optionValues.map(String) : [],
      sku: v.sku?.trim() || null,
      barcode: v.barcode?.trim() || null,
      price: money("price", true) ?? 0,
      compareAtPrice: money("compareAtPrice", false),
      costPrice: money("costPrice", false),
      trackInventory: v.trackInventory !== false,
      stock: int("stock", "Der Lagerbestand") ?? 0,
      stockOriginal: typeof v.stockOriginal === "number" ? v.stockOriginal : null,
      allowBackorder: Boolean(v.allowBackorder),
      weightGrams: weight,
      imageId: v.imageId || null,
      active: v.active !== false,
    };
  });
  return { variants, errors };
}

export async function saveProductAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung. Sie brauchen das Recht «Produkte bearbeiten».");
  const id = String(f.get("id") ?? "") || null;
  const status = String(f.get("status") ?? "draft");
  const type = String(f.get("type") ?? "physical");
  const { variants, errors } = parseVariants(json<RawVariant[]>(f.get("variants"), []));
  if (!variants.length) return fail("Das Produkt braucht mindestens eine Variante.");
  if (Object.keys(errors).length) return fail(Object.keys(errors).length === 1 ? Object.values(errors)[0] : "Bitte prüfen Sie die markierten Felder bei Preis und Lager.", errors);
  try {
    const saved = await saveProduct(
      id,
      {
        name: String(f.get("name") ?? ""),
        slug: String(f.get("slug") ?? ""),
        status: (PRODUCT_STATUS as readonly string[]).includes(status) ? (status as (typeof PRODUCT_STATUS)[number]) : "draft",
        type: (PRODUCT_TYPES as readonly string[]).includes(type) ? (type as (typeof PRODUCT_TYPES)[number]) : "physical",
        shortDescription: String(f.get("shortDescription") ?? ""),
        description: String(f.get("description") ?? ""),
        vendor: String(f.get("vendor") ?? ""),
        tags: String(f.get("tags") ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        featured: f.get("featured") === "on",
        taxClassId: String(f.get("taxClassId") ?? "") || null,
        seoTitle: String(f.get("seoTitle") ?? ""),
        seoDescription: String(f.get("seoDescription") ?? ""),
        categoryIds: f.getAll("categoryIds").map(String),
        images: json<{ mediaId: string; alt: string }[]>(f.get("images"), []),
        options: json<{ name: string; values: string[] }[]>(f.get("options"), []),
        variants,
      },
      user,
    );
    revalidatePath("/madexadm/produkte");
    redirect(`/madexadm/produkte/${saved.id}?gespeichert=${Date.now()}`);
  } catch (e) {
    return toFormState(e);
  }
}

/** Uploads images to the media library and returns them for the editor (not yet linked to the product). */
export async function uploadProductImagesAction(f: FormData): Promise<{ images?: { mediaId: string; url: string; alt: string }[]; error?: string }> {
  const user = await guard();
  if (!user) return { error: "Keine Berechtigung." };
  const files = f.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
  if (!files.length) return { error: "Bitte ein Bild auswählen." };
  const images: { mediaId: string; url: string; alt: string }[] = [];
  const problems: string[] = [];
  for (const file of files.slice(0, 20)) {
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      problems.push(`${file.name}: nur JPG, PNG, WebP, GIF oder AVIF.`);
      continue;
    }
    try {
      const m = await saveUpload(file, { userId: user.id, folder: "produkte" });
      images.push({ mediaId: m.id, url: mediaPath(m.path), alt: "" });
    } catch (e) {
      problems.push(`${file.name}: ${e instanceof Error ? e.message : "Upload fehlgeschlagen."}`);
    }
  }
  return { images, error: problems.length ? problems.join(" ") : undefined };
}

export async function duplicateProductAction(f: FormData) {
  const user = await guard();
  if (!user) redirect("/madexadm/kein-zugriff");
  const copy = await duplicateProduct(String(f.get("id")), user);
  revalidatePath("/madexadm/produkte");
  redirect(`/madexadm/produkte/${copy.id}?meldung=${encodeURIComponent("Kopie erstellt. Sie bearbeiten jetzt die Kopie (Entwurf).")}`);
}

export async function deleteProductAction(f: FormData) {
  const user = await guard();
  if (!user) redirect("/madexadm/kein-zugriff");
  const n = await deleteProducts([String(f.get("id"))], user);
  revalidatePath("/madexadm/produkte");
  redirect(withMsg("/madexadm/produkte", n ? "Produkt gelöscht." : "Das Produkt war bereits gelöscht."));
}

/* ------------------------------------------------------------ list */

const BULK: Record<string, { status?: (typeof PRODUCT_STATUS)[number]; label: string }> = {
  activate: { status: "active", label: "aktiviert" },
  draft: { status: "draft", label: "als Entwurf gespeichert" },
  archive: { status: "archived", label: "archiviert" },
  delete: { label: "gelöscht" },
};

export async function bulkProductsAction(f: FormData) {
  const user = await guard();
  if (!user) redirect("/madexadm/kein-zugriff");
  const back = safeBack(f.get("back"));
  const ids = f.getAll("ids").map(String);
  const op = BULK[String(f.get("op"))];
  if (!op || !ids.length) redirect(withMsg(back, "Bitte zuerst Produkte auswählen."));
  const n = op.status ? await setProductsStatus(ids, op.status, user) : await deleteProducts(ids, user);
  revalidatePath("/madexadm/produkte");
  redirect(withMsg(back, `${n} Produkt${n === 1 ? "" : "e"} ${op.label}.`));
}

/* ------------------------------------------------------------ import */

export async function uploadImportAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung.");
  const file = f.get("file");
  if (!(file instanceof File) || !file.size) return fail("Bitte eine CSV-Datei auswählen.");
  if (file.size > 10 * 1024 * 1024) return fail("Die Datei ist grösser als 10 MB. Teilen Sie sie in mehrere Dateien auf.");
  let text = Buffer.from(await file.arrayBuffer()).toString("utf8");
  if (text.includes("�")) text = Buffer.from(await file.arrayBuffer()).toString("latin1"); // Excel "CSV (Trennzeichen-getrennt)" without UTF-8
  try {
    await planImport(text); // validates the format
  } catch (e) {
    return toFormState(e);
  }
  const token = await storeImportFile(text);
  redirect(`/madexadm/produkte/import?datei=${token}`);
}

export async function runImportAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung.");
  const token = String(f.get("datei") ?? "");
  const text = await readImportFile(token);
  if (!text) return fail("Die hochgeladene Datei ist abgelaufen. Bitte laden Sie sie erneut hoch.");
  let r;
  try {
    r = await runImport(text, user, { downloadImages: f.get("images") === "on" });
  } catch (e) {
    return toFormState(e);
  }
  await deleteImportFile(token);
  await storeImportResult(token, r);
  revalidatePath("/madexadm/produkte");
  redirect(`/madexadm/produkte/import?ergebnis=${token}`);
}
