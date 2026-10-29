"use server";

import { revalidatePath } from "next/cache";
import { fail, formBool, formString, ok, type FormState } from "@/lib/form-state";
import { parseMoney } from "@/lib/format";
import type { CarrierKey } from "@/lib/orders";
import { isModuleEnabled } from "@/modules/registry";
import type { Permission } from "@/server/auth/permissions";
import { checkPermission } from "@/server/auth/session";
import { ShopError } from "@/server/shop/errors";
import { addOrderNote, cancelOrder, fulfilOrder, markPaid, refundOrder, resendOrderEmail, type ResendKind } from "@/server/shop/orders";

async function run(f: FormData, permission: Permission, work: (id: string, actor: { id: string; email: string; name: string }) => Promise<string>): Promise<FormState> {
  const user = await checkPermission(permission);
  if (!user) return fail(permission === "orders.refund" ? "Keine Berechtigung. Rückerstattungen braucht das Recht «Rückerstattungen auslösen»." : "Keine Berechtigung. Bestellungen bearbeiten braucht das Recht «Bestellungen bearbeiten, versenden, stornieren».");
  if (!(await isModuleEnabled("shop"))) return fail("Das Plugin «Shop» ist nicht aktiv.");
  const id = formString(f, "id");
  try {
    const msg = await work(id, { id: user.id, email: user.email, name: user.name });
    revalidatePath(`/madexadm/bestellungen/${id}`);
    revalidatePath("/madexadm/bestellungen");
    return ok(msg);
  } catch (e) {
    return fail(e instanceof ShopError ? e.message : "Das hat nicht geklappt. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.");
  }
}

/** Items chosen in a form as qty_<orderItemId> fields. */
const pickedItems = (f: FormData) =>
  [...f.entries()]
    .filter(([k]) => k.startsWith("qty_"))
    .map(([k, v]) => ({ orderItemId: k.slice(4), quantity: Math.max(0, Number(v) || 0) }))
    .filter((i) => i.quantity > 0);

export async function markPaidAction(_: FormState, f: FormData) {
  return run(f, "orders.manage", async (id, actor) => {
    await markPaid(id, actor, { reference: formString(f, "reference"), note: formString(f, "note") });
    return "Als bezahlt markiert.";
  });
}

export async function fulfilAction(_: FormState, f: FormData) {
  return run(f, "orders.manage", async (id, actor) => {
    const items = pickedItems(f);
    await fulfilOrder(id, actor, { items: items.length ? items : undefined, carrier: (formString(f, "carrier") || null) as CarrierKey | null, trackingNumber: formString(f, "trackingNumber") || null, notify: formBool(f, "notify") });
    return formBool(f, "notify") ? "Als versendet markiert. Die Kundin oder der Kunde wurde per E-Mail informiert." : "Als versendet markiert.";
  });
}

export async function cancelAction(_: FormState, f: FormData) {
  return run(f, "orders.manage", async (id, actor) => {
    await cancelOrder(id, actor, { reason: formString(f, "reason"), restock: formBool(f, "restock"), notify: formBool(f, "notify") });
    return "Bestellung storniert.";
  });
}

export async function refundAction(_: FormState, f: FormData) {
  return run(f, "orders.refund", async (id, actor) => {
    const amount = parseMoney(formString(f, "amount"));
    if (amount === null) throw new ShopError("validation", "Geben Sie den Betrag ein, z. B. 49.90 (0 für eine Rücknahme ohne Rückzahlung).");
    await refundOrder(id, actor, { amount, items: pickedItems(f), restock: formBool(f, "restock"), reason: formString(f, "reason"), notify: formBool(f, "notify"), manual: formBool(f, "manual") });
    return "Rückerstattung erfasst.";
  });
}

export async function noteAction(_: FormState, f: FormData) {
  return run(f, "orders.manage", async (id, actor) => {
    const visible = formBool(f, "visible");
    const res = await addOrderNote(id, actor, { message: formString(f, "message"), visibleToCustomer: visible, notify: visible && formBool(f, "notify") });
    if ("ok" in res && res.ok === false) return "Notiz gespeichert, aber die E-Mail konnte nicht gesendet werden.";
    return "Notiz gespeichert.";
  });
}

export async function resendAction(_: FormState, f: FormData) {
  return run(f, "orders.manage", async (id, actor) => {
    const kind = formString(f, "kind") as ResendKind;
    const res = await resendOrderEmail(id, actor, ["confirmation", "shipped", "notice"].includes(kind) ? kind : "confirmation");
    if (res && "ok" in res && !res.ok) throw new ShopError("conflict", `Die E-Mail konnte nicht gesendet werden${"error" in res && res.error ? `: ${res.error}` : "."} Prüfen Sie Einstellungen → E-Mail.`);
    return "E-Mail gesendet.";
  });
}
