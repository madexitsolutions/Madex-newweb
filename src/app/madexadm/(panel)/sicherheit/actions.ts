"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, formBool, formList, ok, zodFieldErrors, type FormState } from "@/lib/form-state";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { requestInfo } from "@/server/lib/request";
import { allowlistError, createIpBlock, deleteIpBlock } from "@/server/security";
import { getSettings, saveSettings } from "@/server/settings";

const PATH = "/madexadm/sicherheit";
const NO_ACCESS = "Keine Berechtigung. Diese Aktion braucht das Recht «Sicherheitsrichtlinien und Sperren».";

const num = (label: string, min: number, max: number) =>
  z.coerce.number({ invalid_type_error: `${label}: bitte eine Zahl eingeben.` }).int(`${label}: bitte eine ganze Zahl.`).min(min, `${label}: mindestens ${min}.`).max(max, `${label}: höchstens ${max}.`);

const policySchema = z
  .object({
    sessionIdleMinutes: num("Leerlauf", 5, 24 * 60),
    sessionMaxHours: num("Maximale Dauer", 1, 24 * 30),
    passwordMinLength: num("Passwortlänge", 8, 128),
    loginMaxAttempts: num("Fehlversuche", 3, 50),
    lockoutMinutes: num("Sperrdauer", 1, 24 * 60),
  })
  .refine((v) => v.sessionIdleMinutes <= v.sessionMaxHours * 60, { message: "Der Leerlauf darf nicht länger sein als die maximale Sitzungsdauer.", path: ["sessionIdleMinutes"] });

export async function savePolicyAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("security.manage");
  if (!user) return fail(NO_ACCESS);
  const parsed = policySchema.safeParse(Object.fromEntries(f));
  if (!parsed.success) return fail(parsed.error.issues[0].message, zodFieldErrors(parsed.error.issues));
  const allowlist = [...new Set(formList(f, "adminIpAllowlist"))];
  const { ip } = await requestInfo();
  const bad = allowlistError(allowlist, ip);
  if (bad) return fail(bad, { adminIpAllowlist: bad });
  const before = await getSettings("security");
  const next = { ...parsed.data, require2fa: formBool(f, "require2fa"), adminIpAllowlist: allowlist };
  await saveSettings("security", next, user.id);
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(next[k]));
  await audit(user, "security.policy_updated", { entityType: "settings", entityId: "security", summary: changed.length ? `Sicherheitsrichtlinie geändert: ${changed.join(", ")}` : "Sicherheitsrichtlinie gespeichert", data: { before, after: next } });
  revalidatePath(PATH);
  return ok(!next.require2fa && before.require2fa ? "Gespeichert. Achtung: 2FA ist jetzt freiwillig." : "Gespeichert. Die Richtlinie gilt ab sofort.");
}

const blockSchema = z.object({
  cidr: z.string().trim().min(3, "Bitte eine IP-Adresse oder ein Netz eingeben.").max(60),
  reason: z.string().trim().max(200, "Der Grund ist zu lang (max. 200 Zeichen)."),
  duration: z.enum(["1h", "24h", "7d", "30d", "never"]),
});
const DURATION_MS: Record<string, number> = { "1h": 3_600_000, "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 };

export async function createBlockAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("security.manage");
  if (!user) return fail(NO_ACCESS);
  const parsed = blockSchema.safeParse(Object.fromEntries(f));
  if (!parsed.success) return fail(parsed.error.issues[0].message, zodFieldErrors(parsed.error.issues));
  const { ip } = await requestInfo();
  const expiresAt = parsed.data.duration === "never" ? null : new Date(Date.now() + DURATION_MS[parsed.data.duration]);
  const r = await createIpBlock(user, { cidr: parsed.data.cidr, reason: parsed.data.reason, expiresAt }, ip);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok(`${parsed.data.cidr} ist gesperrt – für Anmeldung, Dashboard und API.`);
}

export async function deleteBlockAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("security.manage");
  if (!user) return fail(NO_ACCESS);
  const id = z.string().uuid().safeParse(f.get("id"));
  if (!id.success) return fail("Ungültige Anfrage.");
  const r = await deleteIpBlock(user, id.data);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Aufgehoben.");
}
