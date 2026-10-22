"use server";

import { revalidatePath } from "next/cache";
import { saveSettings } from "@/server/settings";
import { redirect } from "next/navigation";
import { fail, formBool, formList, formString, type FormState } from "@/lib/form-state";
import { parseMoney } from "@/lib/format";
import { checkPermission } from "@/server/auth/session";
import { isModuleEnabled } from "@/modules/registry";
import { toFormState } from "@/server/shop/errors";
import { deleteMethod, deleteZone, saveMethod, saveZone, setMethodsActive, SHIPPING_TYPES } from "@/server/shop/shipping-admin";
import { savePaymentSettings, saveCheckoutSettings, savePricesIncludeTax, saveShipToCountries, saveShopGeneral } from "@/server/shop/shop-settings";
import { deleteTaxClass, saveTaxClass, setDefaultTaxClass } from "@/server/shop/tax-admin";

const BASE = "/admin/shop-einstellungen";
const NO_ACCESS = "Keine Berechtigung. Sie brauchen das Recht «Shop-Einstellungen, Versand, Steuern, Zahlungsarten».";

async function guard() {
  const user = await checkPermission("shop.settings");
  if (!user || !(await isModuleEnabled("shop"))) return null;
  return user;
}

/** "" → undefined (field left empty), otherwise a number (NaN fails validation with a clear message). */
const num = (f: FormData, k: string) => {
  const s = formString(f, k).replace(/[’'\s]/g, "");
  return s === "" ? undefined : Number(s);
};
const optNum = (f: FormData, k: string) => num(f, k) ?? null;

/** Money field → Rappen; invalid input becomes NaN so zod reports it on the field. */
const money = (f: FormData, k: string) => {
  const s = formString(f, k);
  if (!s) return undefined;
  return parseMoney(s) ?? Number.NaN;
};

const done = (tab: string, msg: string): never => {
  revalidatePath(BASE);
  redirect(`${BASE}?tab=${tab}&meldung=${encodeURIComponent(msg)}`);
};

/* ------------------------------------------------------------ general / checkout / taxes display */

export async function saveShopGeneralAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  try {
    await saveShopGeneral(
      {
        orderPrefix: formString(f, "orderPrefix"),
        orderNumberStart: num(f, "orderNumberStart") ?? Number.NaN,
        lowStockThreshold: num(f, "lowStockThreshold") ?? 0,
        showOutOfStock: formBool(f, "showOutOfStock"),
        productsPerPage: num(f, "productsPerPage") ?? Number.NaN,
        orderNotifyEmails: formList(f, "orderNotifyEmails"),
        invoiceFooter: formString(f, "invoiceFooter"),
      },
      user,
    );
    await saveSettings("modules", { storefront: formBool(f, "storefront") }, user.id);
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath("/admin", "layout");
  return { message: "Gespeichert." };
}

export async function saveCheckoutAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  try {
    await saveCheckoutSettings(
      {
        guestCheckout: formBool(f, "guestCheckout"),
        requireTerms: formBool(f, "requireTerms"),
        termsUrl: formString(f, "termsUrl"),
        privacyUrl: formString(f, "privacyUrl"),
        returnPolicy: formString(f, "returnPolicy"),
        checkoutNote: formString(f, "checkoutNote"),
      },
      user,
    );
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(BASE);
  return { message: "Gespeichert." };
}

export async function saveTaxDisplayAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  await savePricesIncludeTax(f.get("pricesIncludeTax") === "1", user);
  revalidatePath(BASE);
  return { message: "Gespeichert." };
}

export async function saveShipToAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  try {
    await saveShipToCountries(formList(f, "shipToCountries"), user);
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(BASE);
  return { message: "Lieferländer gespeichert." };
}

/* ------------------------------------------------------------ payments */

export async function savePaymentsAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  const remove = (["stripeSecretKey", "stripeWebhookSecret", "payrexxApiSecret"] as const).filter((k) => formBool(f, `remove_${k}`));
  try {
    await savePaymentSettings(
      {
        stripeEnabled: formBool(f, "stripeEnabled"),
        stripePublishableKey: formString(f, "stripePublishableKey"),
        stripeSecretKey: formString(f, "stripeSecretKey"),
        stripeWebhookSecret: formString(f, "stripeWebhookSecret"),
        payrexxEnabled: formBool(f, "payrexxEnabled"),
        payrexxInstance: formString(f, "payrexxInstance"),
        payrexxApiSecret: formString(f, "payrexxApiSecret"),
        invoiceEnabled: formBool(f, "invoiceEnabled"),
        invoiceDueDays: num(f, "invoiceDueDays") ?? Number.NaN,
        invoiceOnlyForCustomers: formBool(f, "invoiceOnlyForCustomers"),
        bankTransferEnabled: formBool(f, "bankTransferEnabled"),
        bankAccountHolder: formString(f, "bankAccountHolder"),
        bankIban: formString(f, "bankIban"),
        bankName: formString(f, "bankName"),
        bankInstructions: formString(f, "bankInstructions"),
        pickupPaymentEnabled: formBool(f, "pickupPaymentEnabled"),
      },
      user,
      remove,
    );
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(BASE);
  return { message: "Zahlungsarten gespeichert." };
}

/* ------------------------------------------------------------ shipping */

export async function saveZoneAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  const id = formString(f, "id") || null;
  let name: string;
  try {
    name = (await saveZone(id, { name: formString(f, "name"), countries: formList(f, "countries"), sort: num(f, "sort") ?? 0 }, user)).name;
  } catch (e) {
    return toFormState(e);
  }
  return done("versand", id ? `Zone «${name}» gespeichert.` : `Zone «${name}» erstellt. Fügen Sie jetzt eine Versandart hinzu.`);
}

export async function deleteZoneAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  const row = await deleteZone(formString(f, "id"), user);
  return done("versand", row ? `Zone «${row.name}» und ihre Versandarten gelöscht.` : "Die Zone war bereits gelöscht.");
}

export async function saveMethodAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  const id = formString(f, "id") || null;
  const type = formString(f, "type");
  const upTo = f.getAll("rateUpTo").map(String);
  const prices = f.getAll("ratePrice").map(String);
  const rates = upTo
    .map((u, i) => ({ u: u.trim(), p: (prices[i] ?? "").trim() }))
    .filter((r) => r.u || r.p)
    .map((r) => ({ upToGrams: r.u ? Number(r.u.replace(/[’'\s]/g, "")) : Number.NaN, price: r.p ? (parseMoney(r.p) ?? Number.NaN) : Number.NaN }));
  if (type === "weight" && rates.some((r) => !Number.isFinite(r.upToGrams) || !Number.isFinite(r.price)))
    return fail("Jede Gewichtsstufe braucht ein Gewicht in Gramm und einen Preis, z. B. 2000 g → 9.00.", { weightRates: "Stufe unvollständig" });
  let name: string;
  try {
    name = (
      await saveMethod(
        id,
        {
          zoneId: formString(f, "zoneId"),
          name: formString(f, "name"),
          description: formString(f, "description"),
          type: (SHIPPING_TYPES as readonly string[]).includes(type) ? (type as (typeof SHIPPING_TYPES)[number]) : "flat",
          price: money(f, "price") ?? 0,
          freeAbove: money(f, "freeAbove") ?? null,
          weightRates: rates,
          minSubtotal: money(f, "minSubtotal") ?? null,
          deliveryDaysMin: optNum(f, "deliveryDaysMin"),
          deliveryDaysMax: optNum(f, "deliveryDaysMax"),
          taxClassId: formString(f, "taxClassId") || null,
          active: formBool(f, "active"),
          sort: num(f, "sort") ?? 0,
        },
        user,
      )
    ).name;
  } catch (e) {
    return toFormState(e);
  }
  return done("versand", `Versandart «${name}» gespeichert.`);
}

export async function deleteMethodAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  const row = await deleteMethod(formString(f, "id"), user);
  return done("versand", row ? `Versandart «${row.name}» gelöscht.` : "Die Versandart war bereits gelöscht.");
}

export async function toggleMethodAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  const active = formString(f, "active") === "1";
  await setMethodsActive([formString(f, "id")], active, user);
  revalidatePath(BASE);
  return { message: active ? "Aktiviert." : "Deaktiviert." };
}

/* ------------------------------------------------------------ tax classes */

export async function saveTaxClassAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  const id = formString(f, "id") || null;
  const rate = formString(f, "rate").replace(",", ".").replace(/\s*%$/, "");
  const rateBp = rate === "" || !/^\d+(\.\d{1,2})?$/.test(rate) ? Number.NaN : Math.round(Number(rate) * 100);
  let name: string;
  try {
    name = (await saveTaxClass(id, { name: formString(f, "name"), rateBp, isDefault: formBool(f, "isDefault") }, user)).name;
  } catch (e) {
    return toFormState(e);
  }
  return done("steuern", `Steuerklasse «${name}» gespeichert.`);
}

export async function setDefaultTaxClassAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  try {
    const row = await setDefaultTaxClass(formString(f, "id"), user);
    revalidatePath(BASE);
    return { message: `«${row.name}» ist jetzt Standard.` };
  } catch (e) {
    return toFormState(e);
  }
}

export async function deleteTaxClassAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail(NO_ACCESS);
  let name: string | undefined;
  try {
    name = (await deleteTaxClass(formString(f, "id"), user))?.name;
  } catch (e) {
    return toFormState(e);
  }
  return done("steuern", name ? `Steuerklasse «${name}» gelöscht. Betroffene Produkte verwenden jetzt die Standardklasse.` : "Die Steuerklasse war bereits gelöscht.");
}
