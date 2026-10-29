"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, formList, ok, type FormState } from "@/lib/form-state";
import { checkPermission } from "@/server/auth/session";
import { isModuleEnabled } from "@/modules/registry";
import { anonymiseCustomer, deleteCustomer, deleteCustomerAddress, saveCustomer } from "@/server/shop/customers";
import { toFormState } from "@/server/shop/errors";

async function guard() {
  const user = await checkPermission("customers.manage");
  if (!user || !(await isModuleEnabled("shop"))) return null;
  return user;
}

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function saveCustomerAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung.");
  const id = s(f, "id") || null;
  const hasAddress = ["street", "zip", "city"].some((k) => s(f, `a_${k}`));
  try {
    const row = await saveCustomer(
      id,
      {
        email: s(f, "email"),
        firstName: s(f, "firstName"),
        lastName: s(f, "lastName"),
        phone: s(f, "phone"),
        acceptsMarketing: f.get("acceptsMarketing") === "on",
        note: String(f.get("note") ?? ""),
        tags: formList(f, "tags"),
        disabled: f.get("disabled") === "on",
        defaultAddress: hasAddress
          ? {
              firstName: s(f, "a_firstName") || s(f, "firstName"),
              lastName: s(f, "a_lastName") || s(f, "lastName"),
              company: s(f, "a_company"),
              street: s(f, "a_street"),
              street2: s(f, "a_street2"),
              zip: s(f, "a_zip"),
              city: s(f, "a_city"),
              country: s(f, "a_country") || "CH",
              phone: s(f, "phone"),
            }
          : null,
      },
      user,
    );
    revalidatePath("/madexadm/kunden");
    if (!id) redirect(`/madexadm/kunden/${row.id}?meldung=${encodeURIComponent("Kunde erfasst.")}`);
    revalidatePath(`/madexadm/kunden/${row.id}`);
    return ok("Gespeichert.");
  } catch (e) {
    return toFormState(e);
  }
}

export async function deleteAddressAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung.");
  await deleteCustomerAddress(s(f, "customerId"), s(f, "addressId"), user);
  revalidatePath(`/madexadm/kunden/${s(f, "customerId")}`);
  return ok("Adresse entfernt.");
}

export async function anonymiseCustomerAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung.");
  const id = s(f, "id");
  try {
    const r = await anonymiseCustomer(id, user);
    revalidatePath("/madexadm/kunden");
    revalidatePath(`/madexadm/kunden/${id}`);
    return ok(`Personendaten entfernt. ${r.orders} Bestellung${r.orders === 1 ? "" : "en"} bleiben für die Buchhaltung ohne Namen erhalten.`);
  } catch (e) {
    return toFormState(e);
  }
}

export async function deleteCustomerAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung.");
  try {
    await deleteCustomer(s(f, "id"), user);
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath("/madexadm/kunden");
  redirect(`/madexadm/kunden?meldung=${encodeURIComponent("Kunde gelöscht.")}`);
}
