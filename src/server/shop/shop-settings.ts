/**
 * Shop settings (general, checkout, payments): validation of the admin forms,
 * the order number counter and the readiness of each payment method. Storage
 * is `server/settings.ts`; secrets stay there (encrypted) and never leave the server.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { sequences, shippingMethods, shippingZones } from "@/server/db/schema";
import { audit, type Actor } from "@/server/audit";
import { clearSecret, getSettings, saveSettings } from "@/server/settings";
import { ibanError, normalizeIban } from "@/lib/iban";
import { COUNTRY_NAMES } from "@/lib/orders";
import { fromZod, InputError } from "./errors";

const emailList = z.array(z.string().trim().toLowerCase().email("Ungültige E-Mail-Adresse.")).max(20, "Höchstens 20 Adressen.");
const optionalUrl = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .refine((u) => /^https?:\/\/[^\s]+$/.test(u) || /^\/[^\s]*$/.test(u), "Bitte eine Adresse mit https:// oder einen Pfad wie /agb eingeben."),
]);

/* ================================================================ general */

export const shopGeneralSchema = z.object({
  orderPrefix: z
    .string()
    .trim()
    .max(10, "Das Präfix darf höchstens 10 Zeichen haben.")
    .regex(/^[A-Za-z0-9-]*$/, "Nur Buchstaben, Ziffern und Bindestrich, z. B. «SH-»."),
  orderNumberStart: z.number({ invalid_type_error: "Bitte eine ganze Zahl eingeben, z. B. 1000." }).int("Bitte eine ganze Zahl eingeben.").min(1, "Die Startnummer muss mindestens 1 sein.").max(999_999_999),
  lowStockThreshold: z.number({ invalid_type_error: "Bitte eine ganze Zahl eingeben, z. B. 3." }).int().min(0, "Die Warnschwelle darf nicht negativ sein.").max(100_000),
  showOutOfStock: z.boolean(),
  productsPerPage: z.number({ invalid_type_error: "Bitte eine Zahl zwischen 4 und 200 eingeben." }).int().min(4, "Mindestens 4 Produkte pro Seite.").max(200, "Höchstens 200 Produkte pro Seite."),
  orderNotifyEmails: emailList,
  invoiceFooter: z.string().trim().max(500, "Höchstens 500 Zeichen."),
});
export type ShopGeneralInput = z.input<typeof shopGeneralSchema>;

/** Next order number: the counter value + 1, or the start number before the first order. */
export async function nextOrderNumberPreview() {
  const [row] = await db.select().from(sequences).where(eq(sequences.key, "order"));
  return row ? row.value + 1 : (await getSettings("shop")).orderNumberStart;
}

/**
 * Saves the general shop settings. A higher start number also moves the
 * counter forward; numbers can never go back (they must stay unique).
 */
export async function saveShopGeneral(input: ShopGeneralInput, actor: Actor) {
  const r = shopGeneralSchema.safeParse(input);
  if (!r.success) throw fromZod(r.error);
  const v = r.data;
  const [row] = await db.select().from(sequences).where(eq(sequences.key, "order"));
  if (row && v.orderNumberStart <= row.value) {
    const current = await getSettings("shop");
    if (v.orderNumberStart !== current.orderNumberStart)
      throw new InputError(`Die Bestellnummern sind bereits bis ${row.value} vergeben. Wählen Sie eine Startnummer ab ${row.value + 1}.`, { orderNumberStart: `Mindestens ${row.value + 1}.` });
  }
  if (row && v.orderNumberStart > row.value + 1) await db.update(sequences).set({ value: v.orderNumberStart - 1 }).where(eq(sequences.key, "order"));
  await saveSettings("shop", { ...v, orderNotifyEmails: [...new Set(v.orderNotifyEmails)] }, actor?.id);
  await audit(actor, "settings.updated", { entityType: "settings", entityId: "shop", summary: "Shop-Einstellungen gespeichert (Allgemein)" });
}

/* ================================================================ tax display */

export async function savePricesIncludeTax(value: boolean, actor: Actor) {
  await saveSettings("shop", { pricesIncludeTax: value }, actor?.id);
  await audit(actor, "settings.updated", { entityType: "settings", entityId: "shop", summary: `Preise ${value ? "inklusive" : "exklusive"} MWST` });
}

/* ================================================================ ship-to countries */

export const shipToSchema = z
  .array(z.string().trim().toUpperCase())
  .max(250)
  .superRefine((list, ctx) => {
    const bad = list.find((c) => !/^[A-Z]{2}$/.test(c));
    if (bad) ctx.addIssue({ code: "custom", message: `«${bad}» ist kein Ländercode. Verwenden Sie 2 Buchstaben, z. B. CH, LI, DE.` });
  });

export async function saveShipToCountries(input: string[], actor: Actor) {
  const r = shipToSchema.safeParse(input);
  if (!r.success) throw fromZod(r.error);
  const list = [...new Set(r.data)];
  await saveSettings("shop", { shipToCountries: list }, actor?.id);
  await audit(actor, "settings.updated", { entityType: "settings", entityId: "shop", summary: `Lieferländer: ${list.join(", ") || "alle"}` });
  return list;
}

/**
 * Countries the shop delivers to without an active shipping method (customers
 * there can't check out). "*" zones cover every country.
 */
export async function uncoveredCountries(): Promise<string[]> {
  const [{ shipToCountries }, zones, methods] = await Promise.all([getSettings("shop"), db.select().from(shippingZones), db.select({ zoneId: shippingMethods.zoneId, active: shippingMethods.active }).from(shippingMethods)]);
  const live = zones.filter((z) => methods.some((m) => m.zoneId === z.id && m.active));
  if (live.some((z) => z.countries.includes("*"))) return [];
  const covered = new Set(live.flatMap((z) => z.countries));
  return shipToCountries.filter((c) => !covered.has(c));
}

export const countryLabel = (c: string) => (c === "*" ? "Übrige Welt" : (COUNTRY_NAMES[c] ?? c));

/* ================================================================ checkout */

export const checkoutSchema = z
  .object({
    guestCheckout: z.boolean(),
    requireTerms: z.boolean(),
    termsUrl: optionalUrl,
    privacyUrl: optionalUrl,
    returnPolicy: z.string().trim().max(2000, "Höchstens 2000 Zeichen."),
    checkoutNote: z.string().trim().max(1000, "Höchstens 1000 Zeichen."),
  })
  .superRefine((v, ctx) => {
    if (v.requireTerms && !v.termsUrl) ctx.addIssue({ code: "custom", path: ["termsUrl"], message: "Bitte die Adresse der AGB angeben – sonst können Kundinnen und Kunden sie nicht lesen, bevor sie zustimmen." });
  });
export type CheckoutSettingsInput = z.input<typeof checkoutSchema>;

export async function saveCheckoutSettings(input: CheckoutSettingsInput, actor: Actor) {
  const r = checkoutSchema.safeParse(input);
  if (!r.success) throw fromZod(r.error);
  await saveSettings("shop", r.data, actor?.id);
  await audit(actor, "settings.updated", { entityType: "settings", entityId: "shop", summary: "Shop-Einstellungen gespeichert (Kasse)" });
}

/* ================================================================ payments */

const key = (prefixes: string[], label: string) =>
  z
    .string()
    .trim()
    .refine((s) => !s || prefixes.some((p) => s.startsWith(p)), `${label} beginnt mit ${prefixes.map((p) => `«${p}»`).join(" oder ")}. Kopieren Sie ihn erneut aus dem Stripe-Dashboard (Entwickler → API-Schlüssel).`);

export const paymentsSchema = z.object({
  stripeEnabled: z.boolean(),
  stripePublishableKey: key(["pk_live_", "pk_test_"], "Der veröffentlichbare Schlüssel"),
  /** empty = keep the stored secret */
  stripeSecretKey: key(["sk_live_", "sk_test_", "rk_live_", "rk_test_"], "Der geheime Schlüssel"),
  stripeWebhookSecret: z
    .string()
    .trim()
    .refine((s) => !s || s.startsWith("whsec_"), "Das Webhook-Geheimnis beginnt mit «whsec_». Sie finden es in Stripe unter Entwickler → Webhooks → Endpunkt → Signaturgeheimnis."),
  payrexxEnabled: z.boolean(),
  payrexxInstance: z
    .string()
    .trim()
    .toLowerCase()
    .transform((s) => s.replace(/^https?:\/\//, "").replace(/\.payrexx\.com.*$/, ""))
    .refine((s) => !s || /^[a-z0-9-]+$/.test(s), "Der Instanzname ist der Teil vor «.payrexx.com», z. B. «meinshop»."),
  payrexxApiSecret: z.string().trim().max(200),
  invoiceEnabled: z.boolean(),
  invoiceDueDays: z.number({ invalid_type_error: "Bitte die Zahlungsfrist in Tagen eingeben, z. B. 30." }).int().min(1, "Mindestens 1 Tag.").max(120, "Höchstens 120 Tage."),
  invoiceOnlyForCustomers: z.boolean(),
  bankTransferEnabled: z.boolean(),
  bankAccountHolder: z.string().trim().max(70, "Höchstens 70 Zeichen (Vorgabe des QR-Einzahlungsscheins)."),
  bankIban: z.string().trim(),
  bankName: z.string().trim().max(100),
  bankInstructions: z.string().trim().max(1000, "Höchstens 1000 Zeichen."),
  pickupPaymentEnabled: z.boolean(),
});
export type PaymentsInput = z.input<typeof paymentsSchema>;
type SecretField = "stripeSecretKey" | "stripeWebhookSecret" | "payrexxApiSecret";

/**
 * Validates and saves the payment settings. Empty secret fields keep the
 * stored value unless listed in `remove`. Enabling a method requires what it
 * needs to work, so the shop never offers a method that fails at checkout.
 */
export async function savePaymentSettings(input: PaymentsInput, actor: Actor, remove: SecretField[] = []) {
  const r = paymentsSchema.safeParse(input);
  if (!r.success) throw fromZod(r.error);
  const v = r.data;
  const fields: Record<string, string> = {};
  if (v.bankIban) {
    const err = ibanError(v.bankIban);
    if (err) fields.bankIban = err;
    else v.bankIban = normalizeIban(v.bankIban);
  }
  const current = await getSettings("payments");
  const has = (f: SecretField) => Boolean(v[f]) || (Boolean(current[f]) && !remove.includes(f));
  if (v.stripeEnabled) {
    if (!v.stripePublishableKey) fields.stripePublishableKey = "Für Stripe wird der veröffentlichbare Schlüssel (pk_…) benötigt.";
    if (!has("stripeSecretKey")) fields.stripeSecretKey = "Für Stripe wird der geheime Schlüssel (sk_…) benötigt.";
    if (!has("stripeWebhookSecret")) fields.stripeWebhookSecret = "Ohne Webhook-Geheimnis erfährt der Shop nicht, dass bezahlt wurde.";
    const mode = (k: string) => (k.includes("_live_") ? "live" : k.includes("_test_") ? "test" : null);
    const secret = v.stripeSecretKey || (remove.includes("stripeSecretKey") ? "" : current.stripeSecretKey);
    if (v.stripePublishableKey && secret && mode(v.stripePublishableKey) !== mode(secret)) fields.stripePublishableKey = "Test- und Live-Schlüssel gemischt. Verwenden Sie beide aus demselben Modus.";
  }
  if (v.payrexxEnabled) {
    if (!v.payrexxInstance) fields.payrexxInstance = "Für Payrexx wird der Instanzname benötigt.";
    if (!has("payrexxApiSecret")) fields.payrexxApiSecret = "Für Payrexx wird der API-Schlüssel benötigt.";
  }
  if ((v.bankTransferEnabled || v.invoiceEnabled) && !v.bankIban && !fields.bankIban) fields.bankIban = "Für Vorauskasse und Rechnung wird die IBAN benötigt.";
  if (Object.keys(fields).length) throw new InputError(Object.keys(fields).length === 1 ? Object.values(fields)[0] : "Bitte prüfen Sie die markierten Felder.", fields);

  for (const f of remove) if (!v[f]) await clearSecret("payments", f, actor?.id);
  await saveSettings("payments", v, actor?.id);
  const on = [v.stripeEnabled && "Stripe", v.payrexxEnabled && "Payrexx", v.invoiceEnabled && "Rechnung", v.bankTransferEnabled && "Vorauskasse", v.pickupPaymentEnabled && "Barzahlung bei Abholung"].filter(Boolean);
  await audit(actor, "settings.updated", { entityType: "settings", entityId: "payments", summary: `Zahlungsarten gespeichert (aktiv: ${on.join(", ") || "keine"})` });
}

export type MethodReadiness = { key: string; label: string; enabled: boolean; problems: string[] };

/** What keeps each payment method from working (shown as status in the admin). */
export async function paymentReadiness(): Promise<MethodReadiness[]> {
  const [p, g, zones] = await Promise.all([getSettings("payments"), getSettings("general"), db.select({ type: shippingMethods.type, active: shippingMethods.active }).from(shippingMethods)]);
  const address = [!(p.bankAccountHolder || g.companyName) && "Firmenname", !g.street && "Strasse", !g.zip && "PLZ", !g.city && "Ort"].filter((x): x is string => Boolean(x));
  return [
    {
      key: "stripe",
      label: "Stripe",
      enabled: p.stripeEnabled,
      problems: [!p.stripePublishableKey && "Veröffentlichbarer Schlüssel fehlt.", !p.stripeSecretKey && "Geheimer Schlüssel fehlt.", !p.stripeWebhookSecret && "Webhook-Geheimnis fehlt."].filter((x): x is string => Boolean(x)),
    },
    {
      key: "payrexx",
      label: "Payrexx",
      enabled: p.payrexxEnabled,
      problems: [!p.payrexxInstance && "Instanzname fehlt.", !p.payrexxApiSecret && "API-Schlüssel fehlt."].filter((x): x is string => Boolean(x)),
    },
    {
      key: "invoice",
      label: "Rechnung",
      enabled: p.invoiceEnabled,
      problems: [!p.bankIban && "IBAN fehlt.", address.length > 0 && `Absenderadresse unvollständig (${address.join(", ")}) – unter Einstellungen → Allgemein ergänzen.`].filter((x): x is string => Boolean(x)),
    },
    { key: "bank_transfer", label: "Vorauskasse", enabled: p.bankTransferEnabled, problems: [!p.bankIban && "IBAN fehlt."].filter((x): x is string => Boolean(x)) },
    {
      key: "pickup",
      label: "Barzahlung bei Abholung",
      enabled: p.pickupPaymentEnabled,
      problems: zones.some((m) => m.type === "pickup" && m.active) ? [] : ["Keine aktive Versandart «Abholung» – unter Versand anlegen."],
    },
  ];
}
