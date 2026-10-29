"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, formBool, formList, ok, zodFieldErrors, type FormState } from "@/lib/form-state";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import {
  createKey,
  createWebhook,
  deleteWebhook,
  parseOrigins,
  redeliverDelivery,
  revokeKey,
  rotateWebhookSecret,
  setWebhookActive,
  testWebhook,
  updateWebhook,
} from "@/server/integrations";
import { saveSettings } from "@/server/settings";

const PATH = "/madexadm/integrationen";
const NO_ACCESS = "Keine Berechtigung. Diese Aktion braucht das Recht «API-Schlüssel, Webhooks und Verbindungen».";
const uuid = z.string().uuid();

export async function createKeyAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("integrations.manage");
  if (!user) return fail(NO_ACCESS);
  const parsed = z
    .object({ name: z.string().trim().min(2, "Bitte einen Namen eingeben, z. B. «Website Produktion».").max(80), kind: z.enum(["public", "secret"], { message: "Bitte die Art des Schlüssels wählen." }) })
    .safeParse({ name: f.get("name"), kind: f.get("kind") });
  if (!parsed.success) return fail(parsed.error.issues[0].message, zodFieldErrors(parsed.error.issues));
  const r = await createKey(user, { ...parsed.data, scopes: f.getAll("scopes").map(String), origins: formList(f, "origins") });
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Schlüssel erstellt.", { key: r.key });
}

export async function revokeKeyAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("integrations.manage");
  if (!user) return fail(NO_ACCESS);
  const id = uuid.safeParse(f.get("id"));
  if (!id.success) return fail("Ungültige Anfrage.");
  const r = await revokeKey(user, id.data);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Widerrufen.");
}

export async function saveWebhookAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("integrations.manage");
  if (!user) return fail(NO_ACCESS);
  const parsed = z
    .object({ id: z.union([uuid, z.literal("")]), name: z.string().trim().min(2, "Bitte einen Namen eingeben.").max(80), url: z.string().trim().min(1, "Bitte die Ziel-Adresse eingeben.").max(500) })
    .safeParse({ id: f.get("id") ?? "", name: f.get("name"), url: f.get("url") });
  if (!parsed.success) return fail(parsed.error.issues[0].message, zodFieldErrors(parsed.error.issues));
  const input = { name: parsed.data.name, url: parsed.data.url, events: f.getAll("events").map(String), active: formBool(f, "active") };
  if (!parsed.data.id) {
    const r = await createWebhook(user, input);
    if (!r.ok) return fail(r.error);
    revalidatePath(PATH);
    return ok("Webhook erstellt.", { secret: r.secret, id: r.id });
  }
  const r = await updateWebhook(user, parsed.data.id, input);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Gespeichert.");
}

export async function rotateSecretAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("integrations.manage");
  if (!user) return fail(NO_ACCESS);
  const id = uuid.safeParse(f.get("id"));
  if (!id.success) return fail("Ungültige Anfrage.");
  const r = await rotateWebhookSecret(user, id.data);
  if (!r.ok) return fail(r.error);
  return ok("Neues Geheimnis erstellt. Das alte ist ab sofort ungültig.", { secret: r.secret });
}

export async function toggleWebhookAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("integrations.manage");
  if (!user) return fail(NO_ACCESS);
  const id = uuid.safeParse(f.get("id"));
  if (!id.success) return fail("Ungültige Anfrage.");
  const active = f.get("active") === "1";
  const r = await setWebhookActive(user, id.data, active);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok(active ? "Aktiviert." : "Pausiert.");
}

export async function deleteWebhookAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("integrations.manage");
  if (!user) return fail(NO_ACCESS);
  const id = uuid.safeParse(f.get("id"));
  if (!id.success) return fail("Ungültige Anfrage.");
  const r = await deleteWebhook(user, id.data);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  redirect(`${PATH}?tab=webhooks`);
}

export async function testWebhookAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("integrations.manage");
  if (!user) return fail(NO_ACCESS);
  const id = uuid.safeParse(f.get("id"));
  if (!id.success) return fail("Ungültige Anfrage.");
  const r = await testWebhook(user, id.data);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  if (r.status === "success") return ok(`Erfolgreich: HTTP ${r.code} in ${r.ms} ms.`);
  return fail(`Fehlgeschlagen: ${r.error ?? `HTTP ${r.code}`}. Das Ziel muss mit einem 2xx-Status antworten.`);
}

export async function redeliverAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("integrations.manage");
  if (!user) return fail(NO_ACCESS);
  const id = uuid.safeParse(f.get("id"));
  if (!id.success) return fail("Ungültige Anfrage.");
  const r = await redeliverDelivery(user, id.data);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return ok("Erneut gesendet.");
}

export async function saveCorsAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("integrations.manage");
  if (!user) return fail(NO_ACCESS);
  const list = formList(f, "corsOrigins");
  if (list.includes("*")) return fail("Der Platzhalter * ist aus Sicherheitsgründen nicht erlaubt. Tragen Sie jede Domain einzeln ein.");
  const parsed = parseOrigins(list);
  if ("invalid" in parsed) return fail(`«${parsed.invalid}» ist keine gültige Herkunft. Erwartet wird z. B. https://www.kunde.ch – ohne Pfad und ohne Schrägstrich am Ende.`);
  await saveSettings("api", { corsOrigins: parsed.origins }, user.id);
  await audit(user, "settings.updated", { entityType: "settings", entityId: "api", summary: "Freigegebene Herkünfte (CORS) gespeichert", data: { corsOrigins: parsed.origins } });
  revalidatePath(PATH);
  return ok(`Gespeichert (${parsed.origins.length} ${parsed.origins.length === 1 ? "Herkunft" : "Herkünfte"}).`);
}

