"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type FormState } from "@/lib/form-state";
import { confirmEnrollment, createOwner, dismissFreshRecoveryCodes, logout, passwordLogin, validatePassword, verifySecondFactor } from "@/server/auth/session";

export async function loginAction(_: FormState, f: FormData): Promise<FormState> {
  const email = String(f.get("email") ?? "");
  const password = String(f.get("password") ?? "");
  if (!email || !password) return { error: "Bitte E-Mail und Passwort eingeben.", data: { email } };
  const r = await passwordLogin(email, password);
  if (!r.ok) return { error: r.error, data: { email } };
  redirect(r.next === "done" ? "/admin" : "/admin/login?schritt=code");
}

export async function codeAction(_: FormState, f: FormData): Promise<FormState> {
  const r = await verifySecondFactor(String(f.get("code") ?? ""));
  if (!r.ok) return fail(r.error);
  const next = String(f.get("next") ?? "");
  redirect(next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

export async function enrollAction(_: FormState, f: FormData): Promise<FormState> {
  const r = await confirmEnrollment(String(f.get("code") ?? ""));
  if (!r.ok) return fail(r.error);
  redirect("/admin/wiederherstellungscodes");
}

const setupSchema = z.object({
  name: z.string().trim().min(2, "Bitte Ihren Namen eingeben.").max(100),
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse eingeben."),
  password: z.string(),
  password2: z.string(),
});

export async function setupAction(_: FormState, f: FormData): Promise<FormState> {
  const parsed = setupSchema.safeParse(Object.fromEntries(f));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, email, password, password2 } = parsed.data;
  const weak = await validatePassword(password);
  if (weak) return fail(weak);
  if (password !== password2) return fail("Die Passwörter stimmen nicht überein.");
  const r = await createOwner({ name, email, password });
  if (!r.ok) return fail(r.error);
  redirect("/admin/login?eingerichtet=1");
}

export async function signOutAction() {
  await logout();
  redirect("/admin/login");
}

export async function dismissCodesAction() {
  await dismissFreshRecoveryCodes();
  redirect("/admin");
}
