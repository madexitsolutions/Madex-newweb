"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { contrast, formatRatio } from "@/lib/color";
import { fail, formBool, formList, formString, ok, zodFieldErrors, type FormState } from "@/lib/form-state";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { sendMail, smtpConfig } from "@/server/mail/mailer";
import { mediaPath, saveUpload } from "@/server/media/store";
import { getSettings, saveSettings, type Settings } from "@/server/settings";
import { sendWeeklyDigest } from "@/server/digest";

const PATH = "/admin/einstellungen";
const NO_ACCESS = "Keine Berechtigung. Einstellungen ändern braucht das Recht «Allgemeine Einstellungen und Plugins».";

/** Normalises Swiss UID/VAT numbers ("che123456789 mwst" → "CHE-123.456.789 MWST"); other formats pass unchanged. */
function normalizeVat(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "";
  if (!/^che/i.test(s)) return s.length <= 40 ? s : null;
  const m = s.replace(/[\s.-]/g, "").match(/^CHE(\d{9})(MWST|TVA|IVA)?$/i);
  if (!m) return null;
  const d = m[1];
  return `CHE-${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}${m[2] ? ` ${m[2].toUpperCase()}` : ""}`;
}

const optionalUrl = z.union([z.literal(""), z.string().url("Bitte eine vollständige Adresse mit https:// eingeben.").refine((u) => /^https?:\/\//.test(u), "Die Adresse muss mit https:// beginnen.")]);
const optionalEmail = z.union([z.literal(""), z.string().email("Bitte eine gültige E-Mail-Adresse eingeben.")]);

const generalSchema = z.object({
  siteName: z.string().trim().min(1, "Bitte den Namen der Website eingeben.").max(80),
  siteUrl: optionalUrl,
  companyName: z.string().trim().max(120),
  street: z.string().trim().max(120),
  zip: z.string().trim().max(12),
  city: z.string().trim().max(80),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Ländercode mit zwei Buchstaben, z. B. CH."),
  email: optionalEmail,
  phone: z.string().trim().max(40),
  vatNumber: z.string().trim().max(40),
  timezone: z.string().trim().max(60),
  locale: z.enum(["de-CH", "fr-CH", "it-CH", "en-CH"]),
  currency: z.enum(["CHF", "EUR"]),
});

export async function saveGeneralAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("settings.manage");
  if (!user) return fail(NO_ACCESS);
  const raw = Object.fromEntries([...f.entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
  const parsed = generalSchema.safeParse({ ...raw, siteUrl: String(raw.siteUrl ?? "").replace(/\/+$/, "") });
  if (!parsed.success) return fail("Bitte prüfen Sie die markierten Felder.", zodFieldErrors(parsed.error.issues));
  const vat = normalizeVat(parsed.data.vatNumber);
  if (vat === null) return fail("Die UID hat das Format CHE-123.456.789 (mit «MWST», falls mehrwertsteuerpflichtig).", { vatNumber: "Ungültiges Format" });
  try {
    Intl.DateTimeFormat("de-CH", { timeZone: parsed.data.timezone });
  } catch {
    return fail("Unbekannte Zeitzone. Verwenden Sie z. B. Europe/Zurich.", { timezone: "Ungültig" });
  }
  await saveSettings("general", { ...parsed.data, vatNumber: vat }, user.id);
  await audit(user, "settings.updated", { entityType: "settings", entityId: "general", summary: "Allgemeine Einstellungen gespeichert" });
  revalidatePath("/admin", "layout");
  return ok("Gespeichert.");
}

const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Farbe im Format #RRGGBB.");
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif", "image/avif"];

export async function saveBrandingAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("settings.manage");
  if (!user) return fail(NO_ACCESS);
  const colors = z.object({ primaryColor: hex, accentColor: hex }).safeParse({ primaryColor: f.get("primaryColor"), accentColor: f.get("accentColor") });
  if (!colors.success) return fail("Bitte gültige Farben wählen.", zodFieldErrors(colors.error.issues));
  const ratio = contrast(colors.data.primaryColor, "#ffffff");
  if (ratio < 4.5) return fail(`Die Hauptfarbe ist zu hell für weisse Schrift (Kontrast ${formatRatio(ratio)}, nötig sind 4.5 : 1). Wählen Sie einen dunkleren Ton.`, { primaryColor: "Zu wenig Kontrast" });

  const patch: Partial<Settings["branding"]> = { primaryColor: colors.data.primaryColor.toLowerCase(), accentColor: colors.data.accentColor.toLowerCase() };
  const files: [keyof Settings["branding"], string][] = [
    ["logoUrl", "logo"],
    ["logoDarkUrl", "logoDark"],
    ["faviconUrl", "favicon"],
  ];
  const changed: string[] = [];
  for (const [field, input] of files) {
    const file = f.get(input);
    if (file instanceof File && file.size > 0) {
      if (!IMAGE_TYPES.includes(file.type)) return fail(`${file.name}: Bitte ein Bild hochladen (PNG, SVG, WebP oder JPG).`);
      if (input === "favicon" && file.size > 512 * 1024) return fail("Das Favicon darf höchstens 512 KB gross sein.");
      try {
        const row = await saveUpload(file, { userId: user.id, folder: "branding", alt: input === "favicon" ? "Favicon" : "Logo" });
        (patch as Record<string, string>)[field] = mediaPath(row.path);
        changed.push(input);
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Upload fehlgeschlagen.");
      }
    } else if (formBool(f, `remove_${input}`)) {
      (patch as Record<string, string>)[field] = "";
      changed.push(`${input} entfernt`);
    }
  }
  await saveSettings("branding", patch, user.id);
  await audit(user, "settings.updated", { entityType: "settings", entityId: "branding", summary: "Branding gespeichert", data: { ...patch, files: changed } });
  revalidatePath("/admin", "layout");
  return ok(contrast(colors.data.accentColor, "#ffffff") < 3 ? "Gespeichert. Hinweis: Die Akzentfarbe ist sehr hell und auf weissem Grund schlecht sichtbar." : "Gespeichert. Das Dashboard verwendet die neuen Farben ab sofort.");
}

export async function saveEmailAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("settings.manage");
  if (!user) return fail(NO_ACCESS);
  // server and sender come from .env – here only reply-to and recipients
  const lists = { notifyInquiry: formList(f, "notifyInquiry"), notifyNewOrder: formList(f, "notifyNewOrder"), notifyLowStock: formList(f, "notifyLowStock"), notifyWeekly: formList(f, "notifyWeekly") };
  const replyTo = optionalEmail.safeParse(formString(f, "replyTo"));
  if (!replyTo.success) return fail("Bitte eine gültige E-Mail-Adresse für «Antwort an» eingeben.", { replyTo: "Ungültige Adresse" });
  for (const [k, list] of Object.entries(lists)) {
    const bad = list.find((e) => !z.string().email().safeParse(e).success);
    if (bad) return fail(`«${bad}» ist keine gültige E-Mail-Adresse.`, { [k]: "Ungültige Adresse" });
  }
  // fields the page doesn't show (shop without the shop plugin) keep their value
  const current = await getSettings("email");
  const patch = Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, f.has(k) ? v : current[k as keyof typeof lists]]));
  await saveSettings("email", { replyTo: replyTo.data, ...patch }, user.id);
  await audit(user, "settings.updated", { entityType: "settings", entityId: "email", summary: "E-Mail-Empfänger gespeichert" });
  revalidatePath(PATH);
  return ok("Gespeichert.");
}

export async function testEmailAction(): Promise<FormState> {
  const user = await checkPermission("settings.manage");
  if (!user) return fail(NO_ACCESS);
  const cfg = await smtpConfig();
  if (!cfg.configured) return fail("Es ist noch kein SMTP-Server eingerichtet. Füllen Sie Server und Absender aus und speichern Sie zuerst.");
  const general = await getSettings("general");
  const r = await sendMail({
    to: user.email,
    subject: `Test-E-Mail vom Dashboard ${general.siteName}`,
    template: "system.test",
    content: { title: "Der E-Mail-Versand funktioniert", intro: `Diese Test-E-Mail wurde von ${user.name} im Dashboard ausgelöst.`, rows: [["Server", `${cfg.host}:${cfg.port}`], ["Absender", cfg.from]] },
  });
  await audit(user, "settings.email_test", { entityType: "settings", entityId: "email", summary: r.ok ? "Test-E-Mail gesendet" : `Test-E-Mail fehlgeschlagen: ${r.error}` });
  return r.ok ? ok(`Test-E-Mail an ${user.email} gesendet.`) : fail(`Senden fehlgeschlagen: ${r.error}. Prüfen Sie Server, Port, Verschlüsselung und Zugangsdaten.`);
}

export async function sendDigestAction(): Promise<FormState> {
  const user = await checkPermission("settings.manage");
  if (!user) return fail(NO_ACCESS);
  const cfg = await smtpConfig();
  if (!cfg.configured) return fail("Es ist noch kein SMTP-Server eingerichtet. Füllen Sie Server und Absender aus und speichern Sie zuerst.");
  const r = await sendWeeklyDigest(new Date(), [user.email]);
  await audit(user, "settings.digest_test", { entityType: "settings", entityId: "email", summary: r.ok ? "Wochenbericht testweise gesendet" : `Wochenbericht fehlgeschlagen: ${r.error}` });
  return r.ok ? ok(`Wochenbericht der letzten Woche an ${user.email} gesendet.`) : fail(`Senden fehlgeschlagen: ${r.error}`);
}
