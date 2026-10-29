"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type FormState } from "@/lib/form-state";
import { requestInfo } from "@/server/lib/request";
import { acceptInvite, requestPasswordReset, resetPassword } from "@/server/users";

/** Same answer whether or not the address exists (no account enumeration). */
const NEUTRAL = "Falls zu dieser Adresse ein aktives Konto gehört, haben wir einen Link zum Zurücksetzen gesendet. Er ist 60 Minuten gültig. Prüfen Sie auch den Spam-Ordner.";

export async function forgotPasswordAction(_: FormState, f: FormData): Promise<FormState> {
  const email = z.string().trim().email().safeParse(f.get("email"));
  if (!email.success) return fail("Bitte geben Sie die E-Mail-Adresse Ihres Kontos ein.");
  const { ip } = await requestInfo();
  await requestPasswordReset(email.data, ip);
  return ok(NEUTRAL);
}

const pwSchema = z.object({ token: z.string().min(20).max(100), password: z.string().max(200), password2: z.string().max(200) });

export async function resetPasswordAction(_: FormState, f: FormData): Promise<FormState> {
  const parsed = pwSchema.safeParse(Object.fromEntries(f));
  if (!parsed.success) return fail("Der Link ist ungültig. Fordern Sie einen neuen an.");
  if (parsed.data.password !== parsed.data.password2) return fail("Die Passwörter stimmen nicht überein.", { password2: "Bitte identisch wiederholen." });
  const { ip } = await requestInfo();
  const r = await resetPassword(parsed.data.token, parsed.data.password, ip);
  if (!r.ok) return fail(r.error);
  redirect("/madexadm/login?zurueckgesetzt=1");
}

const inviteSchema = pwSchema.extend({ name: z.string().trim().min(2, "Bitte Ihren Namen eingeben (mind. 2 Zeichen).").max(100, "Der Name ist zu lang.") });

export async function acceptInviteAction(_: FormState, f: FormData): Promise<FormState> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(f));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (parsed.data.password !== parsed.data.password2) return fail("Die Passwörter stimmen nicht überein.", { password2: "Bitte identisch wiederholen." });
  const r = await acceptInvite(parsed.data.token, { name: parsed.data.name, password: parsed.data.password });
  if (!r.ok) return fail(r.error);
  redirect("/madexadm/login?eingerichtet=1");
}
