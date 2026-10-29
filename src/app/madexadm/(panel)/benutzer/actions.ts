"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, zodFieldErrors, type FormState } from "@/lib/form-state";
import { checkPermission } from "@/server/auth/session";
import { createRole, deleteRole, updateRole } from "@/server/roles";
import { changeUserRole, deleteUser, inviteUser, resendInvitation, resetUserTwoFactor, revokeInvitation, setUserStatus, signOutUser } from "@/server/users";

const PATH = "/madexadm/benutzer";
const NO_ACCESS = "Keine Berechtigung. Diese Aktion braucht das Recht «Benutzer einladen, ändern, sperren».";
const id = z.string().uuid("Ungültige Auswahl.");

const mailNote = (mailed: boolean, mailError?: string) =>
  mailed ? "" : ` Die E-Mail wurde aber nicht versendet (${mailError ?? "unbekannter Fehler"}). Richten Sie den Versand unter Einstellungen → E-Mail ein und senden Sie die Einladung erneut.`;

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Bitte den Namen eingeben (mind. 2 Zeichen).").max(100, "Der Name ist zu lang."),
  email: z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse eingeben."),
  roleId: id,
});

export async function inviteAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("users.manage");
  if (!user) return fail(NO_ACCESS);
  const parsed = inviteSchema.safeParse(Object.fromEntries(f));
  if (!parsed.success) return fail("Bitte prüfen Sie die markierten Felder.", zodFieldErrors(parsed.error.issues));
  const r = await inviteUser(user, parsed.data);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  if (!r.mailed) return { error: `Die Einladung für ${parsed.data.email} ist angelegt.${mailNote(false, r.mailError)}` };
  return ok(`Einladung an ${parsed.data.email} gesendet. Der Link ist 7 Tage gültig.`);
}

export async function changeRoleAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("users.manage");
  if (!user) return fail(NO_ACCESS);
  const parsed = z.object({ userId: id, roleId: id }).safeParse(Object.fromEntries(f));
  if (!parsed.success) return fail("Bitte eine Rolle wählen.");
  const r = await changeUserRole(user, parsed.data.userId, parsed.data.roleId);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Rolle gespeichert. Die neuen Rechte gelten ab dem nächsten Seitenaufruf.");
}

export async function userStatusAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("users.manage");
  if (!user) return fail(NO_ACCESS);
  const parsed = z.object({ userId: id, status: z.enum(["active", "disabled"]) }).safeParse(Object.fromEntries(f));
  if (!parsed.success) return fail("Ungültige Anfrage.");
  const r = await setUserStatus(user, parsed.data.userId, parsed.data.status);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok(parsed.data.status === "disabled" ? "Konto gesperrt und abgemeldet." : "Konto entsperrt.");
}

export async function resetTwoFactorAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("users.manage");
  if (!user) return fail(NO_ACCESS);
  const parsed = id.safeParse(f.get("userId"));
  if (!parsed.success) return fail("Ungültige Anfrage.");
  const r = await resetUserTwoFactor(user, parsed.data);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("2FA zurückgesetzt. Die Person richtet sie bei der nächsten Anmeldung neu ein.");
}

export async function signOutUserAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("users.manage");
  if (!user) return fail(NO_ACCESS);
  const parsed = id.safeParse(f.get("userId"));
  if (!parsed.success) return fail("Ungültige Anfrage.");
  const r = await signOutUser(user, parsed.data);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Alle Sitzungen beendet. Die Person muss sich neu anmelden.");
}

export async function deleteUserAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("users.manage");
  if (!user) return fail(NO_ACCESS);
  const parsed = id.safeParse(f.get("userId"));
  if (!parsed.success) return fail("Ungültige Anfrage.");
  const r = await deleteUser(user, parsed.data);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  redirect(`${PATH}?geloescht=1`);
}

export async function resendInviteAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("users.manage");
  if (!user) return fail(NO_ACCESS);
  const parsed = id.safeParse(f.get("userId"));
  if (!parsed.success) return fail("Ungültige Anfrage.");
  const r = await resendInvitation(user, parsed.data);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  if (!r.mailed) return fail(`Neuer Link erstellt, aber nicht versendet: ${r.mailError ?? "Fehler"}.`);
  return ok("Erneut gesendet.");
}

export async function revokeInviteAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("users.manage");
  if (!user) return fail(NO_ACCESS);
  const parsed = id.safeParse(f.get("userId"));
  if (!parsed.success) return fail("Ungültige Anfrage.");
  const r = await revokeInvitation(user, parsed.data);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Einladung zurückgezogen.");
}

const roleSchema = z.object({
  id: z.union([id, z.literal("")]),
  name: z.string().trim().min(2, "Bitte einen Namen eingeben (mind. 2 Zeichen).").max(60, "Der Name ist zu lang (max. 60 Zeichen)."),
  description: z.string().trim().max(300, "Die Beschreibung ist zu lang (max. 300 Zeichen)."),
});

export async function saveRoleAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("roles.manage");
  if (!user) return fail("Keine Berechtigung. Rollen ändern braucht das Recht «Rollen und Berechtigungen ändern».");
  const parsed = roleSchema.safeParse({ id: f.get("id") ?? "", name: f.get("name") ?? "", description: f.get("description") ?? "" });
  if (!parsed.success) return fail("Bitte prüfen Sie die markierten Felder.", zodFieldErrors(parsed.error.issues));
  const permissions = f.getAll("permissions").map(String);
  const input = { name: parsed.data.name, description: parsed.data.description, permissions };
  if (!parsed.data.id) {
    const r = await createRole(user, input);
    if (!r.ok) return fail(r.error);
    revalidatePath(PATH);
    redirect(`${PATH}?tab=rollen&gespeichert=${r.id}`);
  }
  const r = await updateRole(user, parsed.data.id, input);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Rolle gespeichert. Die Änderungen gelten sofort für alle Personen mit dieser Rolle.");
}

export async function deleteRoleAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("roles.manage");
  if (!user) return fail("Keine Berechtigung.");
  const parsed = id.safeParse(f.get("id"));
  if (!parsed.success) return fail("Ungültige Anfrage.");
  const r = await deleteRole(user, parsed.data);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  redirect(`${PATH}?tab=rollen`);
}
