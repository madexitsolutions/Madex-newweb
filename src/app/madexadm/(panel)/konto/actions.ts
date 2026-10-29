"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, zodFieldErrors, type FormState } from "@/lib/form-state";
import { getCurrentUser, regenerateRecoveryCodes, revokeSessions } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { addTotpDevice, changeOwnPassword, confirmTwoFactorSetup, disableOwnTwoFactor, removeTotpDevice, revokeOwnSession, updateProfile, verifyOwnPassword } from "@/server/users";

const PATH = "/madexadm/konto";
const SIGNED_OUT = "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Bitte Ihren Namen eingeben (mind. 2 Zeichen).").max(100, "Der Name ist zu lang."),
  email: z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse eingeben."),
  currentPassword: z.string().max(200).optional(),
});

export async function profileAction(_: FormState, f: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return fail(SIGNED_OUT);
  const parsed = profileSchema.safeParse(Object.fromEntries(f));
  if (!parsed.success) return fail("Bitte prüfen Sie die markierten Felder.", zodFieldErrors(parsed.error.issues));
  const r = await updateProfile(me, parsed.data);
  if (!r.ok) return fail(r.error, r.error.includes("Passwort") ? { currentPassword: r.error } : undefined);
  revalidatePath("/madexadm", "layout");
  return ok(r.emailChanged ? "Gespeichert. Melden Sie sich künftig mit der neuen E-Mail-Adresse an; die alte Adresse wurde informiert." : "Profil gespeichert.");
}

export async function passwordAction(_: FormState, f: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return fail(SIGNED_OUT);
  const current = String(f.get("current") ?? "");
  const next = String(f.get("password") ?? "");
  if (!current) return fail("Bitte das aktuelle Passwort eingeben.", { current: "Pflichtfeld" });
  if (next !== String(f.get("password2") ?? "")) return fail("Die neuen Passwörter stimmen nicht überein.", { password2: "Bitte identisch wiederholen." });
  const r = await changeOwnPassword(me, current, next);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Passwort geändert. Alle anderen Geräte wurden abgemeldet.");
}

export async function regenerateCodesAction(_: FormState, f: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return fail(SIGNED_OUT);
  if (!me.totpEnabled) return fail("Richten Sie zuerst die Zwei-Faktor-Anmeldung ein.");
  const check = await verifyOwnPassword(me, String(f.get("password") ?? ""));
  if (!check.ok) return fail(check.error);
  await regenerateRecoveryCodes(me);
  redirect("/madexadm/wiederherstellungscodes");
}

export async function disableTwoFactorAction(_: FormState, f: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return fail(SIGNED_OUT);
  const r = await disableOwnTwoFactor(me, String(f.get("password") ?? ""));
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Zwei-Faktor-Anmeldung ausgeschaltet.");
}

export async function enableTwoFactorAction(_: FormState, f: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return fail(SIGNED_OUT);
  const code = String(f.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return fail("Bitte den 6-stelligen Code aus der App eingeben.");
  const r = await confirmTwoFactorSetup(me, String(f.get("sealed") ?? ""), code);
  if (!r.ok) return fail(r.error);
  redirect("/madexadm/wiederherstellungscodes");
}

export async function revokeSessionAction(_: FormState, f: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return fail(SIGNED_OUT);
  const id = String(f.get("sessionId") ?? "");
  if (!/^[0-9a-f]{64}$/.test(id)) return fail("Ungültige Sitzung.");
  if (id === me.sessionId) return fail("Die aktuelle Sitzung beenden Sie über «Abmelden».");
  const r = await revokeOwnSession(me, id);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Abgemeldet.");
}

export async function revokeOtherSessionsAction(): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return fail(SIGNED_OUT);
  await revokeSessions(me.id, me.sessionId);
  await audit(me, "user.sessions_revoked", { entityType: "user", entityId: me.id, summary: "Alle anderen eigenen Sitzungen beendet" });
  revalidatePath(PATH);
  return ok("Alle anderen Geräte wurden abgemeldet.");
}

export async function addDeviceAction(_: FormState, f: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return fail(SIGNED_OUT);
  const code = String(f.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return fail("Bitte den 6-stelligen Code aus der App auf dem neuen Gerät eingeben.", { code: "6 Ziffern" });
  const r = await addTotpDevice(me, String(f.get("sealed") ?? ""), code, String(f.get("name") ?? ""));
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  redirect(`${PATH}?geraet=1`);
}

export async function removeDeviceAction(_: FormState, f: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return fail(SIGNED_OUT);
  const r = await removeTotpDevice(me, String(f.get("id") ?? ""), String(f.get("password") ?? ""));
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Gerät entfernt. Es kann sich nicht mehr anmelden.");
}
