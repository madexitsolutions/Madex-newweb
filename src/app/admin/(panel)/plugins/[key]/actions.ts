"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, formBool, formString, ok, zodFieldErrors, type FormState } from "@/lib/form-state";
import { isModuleEnabled, type ModuleKey } from "@/modules/registry";
import { audit } from "@/server/audit";
import type { Permission } from "@/server/auth/permissions";
import { checkPermission } from "@/server/auth/session";
import { clearGa4Cache } from "@/server/analytics/ga4";
import { validateGa } from "@/server/integrations";
import { clearSecret, saveSettings, type Settings, type SettingsKey } from "@/server/settings";

const NO_ACCESS = "Keine Berechtigung. Plugins einrichten braucht das Recht «Allgemeine Einstellungen und Plugins».";

/** Common steps: permission, active plugin, zod validation, save, audit, revalidate the whole site. */
async function save<K extends SettingsKey>(opts: { plugin: ModuleKey; key: K; schema: z.ZodType<Partial<Settings[K]>>; input: unknown; summary: string; permission?: Permission }): Promise<FormState> {
  const user = await checkPermission(opts.permission ?? "settings.manage");
  if (!user) return fail(NO_ACCESS);
  if (!(await isModuleEnabled(opts.plugin))) return fail("Das Plugin ist nicht aktiv. Aktivieren Sie es zuerst unter Plugins.");
  const v = opts.schema.safeParse(opts.input);
  if (!v.success) return fail("Bitte prüfen Sie die markierten Felder.", zodFieldErrors(v.error.issues));
  await saveSettings(opts.key, v.data, user.id);
  await audit(user, "settings.updated", { entityType: "settings", entityId: opts.key, summary: opts.summary });
  revalidatePath("/", "layout");
  return ok("Gespeichert. Die Website zeigt die Änderung sofort.");
}

const text = (max: number) => z.string().trim().max(max);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || v.startsWith("/") || /^https?:\/\/\S+$/i.test(v), "Geben Sie eine Adresse wie /kontakt oder https://… ein.");
const optionalDate = z
  .string()
  .trim()
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Datum im Format JJJJ-MM-TT.");

export async function saveContactFormAction(_: FormState, f: FormData): Promise<FormState> {
  return save({
    plugin: "inquiries",
    key: "contactForm",
    summary: "Kontaktformular gespeichert",
    schema: z.object({ title: text(80).min(1, "Geben Sie einen Seitentitel ein."), intro: text(600), successMessage: text(400).min(1, "Geben Sie eine Bestätigung ein, die Besucher nach dem Absenden sehen."), askPhone: z.boolean(), askCompany: z.boolean() }),
    input: { title: formString(f, "title"), intro: formString(f, "intro"), successMessage: formString(f, "successMessage"), askPhone: formBool(f, "askPhone"), askCompany: formBool(f, "askCompany") },
  });
}

export async function saveSeoSiteAction(_: FormState, f: FormData): Promise<FormState> {
  return save({
    plugin: "seo",
    key: "seoSite",
    permission: "seo.manage",
    summary: "SEO-Grundeinstellungen gespeichert",
    schema: z.object({
      titleTemplate: text(120).refine((v) => !v || v.includes("%s"), "Die Vorlage braucht %s als Platzhalter für den Seitentitel."),
      defaultDescription: text(300),
      ogImage: optionalUrl,
      googleVerification: text(200),
      bingVerification: text(200),
      noindexSite: z.boolean(),
    }),
    input: {
      titleTemplate: formString(f, "titleTemplate"),
      defaultDescription: formString(f, "defaultDescription"),
      ogImage: formString(f, "ogImage"),
      // accept the whole <meta …> tag and keep only the content value
      googleVerification: formString(f, "googleVerification").replace(/.*content="([^"]+)".*/s, "$1"),
      bingVerification: formString(f, "bingVerification").replace(/.*content="([^"]+)".*/s, "$1"),
      noindexSite: formBool(f, "noindexSite"),
    },
  });
}

export async function saveAnalyticsAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("settings.manage");
  if (!user) return fail(NO_ACCESS);
  if (!(await isModuleEnabled("analytics"))) return fail("Das Plugin ist nicht aktiv. Aktivieren Sie es zuerst unter Plugins.");
  const v = validateGa({
    ga4MeasurementId: formString(f, "ga4MeasurementId"),
    ga4PropertyId: formString(f, "ga4PropertyId"),
    serviceAccountEmail: formString(f, "serviceAccountEmail"),
    serviceAccountKey: String(f.get("serviceAccountKey") ?? ""),
  });
  if ("error" in v) return fail(v.error, { [v.field]: v.error });
  await saveSettings("analytics", v.value, user.id);
  if (!v.value.serviceAccountKey && formBool(f, "remove_serviceAccountKey")) await clearSecret("analytics", "serviceAccountKey", user.id);
  clearGa4Cache();
  await audit(user, "settings.updated", { entityType: "settings", entityId: "analytics", summary: "Google Analytics gespeichert", data: { ga4MeasurementId: v.value.ga4MeasurementId, ga4PropertyId: v.value.ga4PropertyId, keyChanged: Boolean(v.value.serviceAccountKey) } });
  revalidatePath("/", "layout");
  return ok(v.value.ga4MeasurementId ? "Gespeichert. Die Website misst ab sofort Besucher." : "Gespeichert. Ohne Mess-ID wird noch nichts gemessen.");
}

export async function saveCookiesAction(_: FormState, f: FormData): Promise<FormState> {
  return save({
    plugin: "cookies",
    key: "cookies",
    summary: "Cookie-Hinweis gespeichert",
    schema: z.object({ text: text(600).min(10, "Beschreiben Sie in einem Satz, wofür Cookies verwendet werden."), acceptLabel: text(40).min(1, "Beschriftung fehlt."), declineLabel: text(40).min(1, "Beschriftung fehlt."), privacyUrl: optionalUrl }),
    input: { text: formString(f, "text"), acceptLabel: formString(f, "acceptLabel"), declineLabel: formString(f, "declineLabel"), privacyUrl: formString(f, "privacyUrl") },
  });
}

export async function saveAnnouncementAction(_: FormState, f: FormData): Promise<FormState> {
  const input = { text: formString(f, "text"), linkLabel: formString(f, "linkLabel"), linkUrl: formString(f, "linkUrl"), startsAt: formString(f, "startsAt"), endsAt: formString(f, "endsAt"), tone: formString(f, "tone"), dismissible: formBool(f, "dismissible") };
  if (input.startsAt && input.endsAt && input.endsAt < input.startsAt) return fail("Das Enddatum liegt vor dem Startdatum.", { endsAt: "Wählen Sie ein Datum nach dem Start." });
  if (input.linkLabel && !input.linkUrl) return fail("Zum Link-Text fehlt die Adresse.", { linkUrl: "Geben Sie die Adresse des Links ein." });
  return save({
    plugin: "announcement",
    key: "announcement",
    summary: "Hinweisleiste gespeichert",
    schema: z.object({ text: text(200), linkLabel: text(40), linkUrl: optionalUrl, startsAt: optionalDate, endsAt: optionalDate, tone: z.enum(["brand", "accent", "dark"]), dismissible: z.boolean() }),
    input,
  });
}

export async function saveMaintenanceAction(_: FormState, f: FormData): Promise<FormState> {
  return save({
    plugin: "maintenance",
    key: "maintenance",
    summary: "Wartungsseite gespeichert",
    schema: z.object({ title: text(120).min(1, "Geben Sie einen Titel ein."), text: text(800), showContact: z.boolean() }),
    input: { title: formString(f, "title"), text: formString(f, "text"), showContact: formBool(f, "showContact") },
  });
}

export async function saveCustomCodeAction(_: FormState, f: FormData): Promise<FormState> {
  return save({
    plugin: "customCode",
    key: "customCode",
    summary: "Eigener Code gespeichert",
    schema: z.object({ head: z.string().max(20_000, "Höchstens 20 000 Zeichen."), bodyEnd: z.string().max(20_000, "Höchstens 20 000 Zeichen."), needsConsent: z.boolean() }),
    input: { head: String(f.get("head") ?? "").trim(), bodyEnd: String(f.get("bodyEnd") ?? "").trim(), needsConsent: formBool(f, "needsConsent") },
  });
}
