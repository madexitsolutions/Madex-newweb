/**
 * Typed settings stored in the `settings` table (one row per group). Every
 * group has defaults, is validated with zod, and secret fields are encrypted
 * at rest. Reads are cached in-process for a few seconds.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { settings as settingsTable } from "@/server/db/schema";
import { decrypt, encrypt, isEncrypted } from "@/server/lib/crypto";

const str = (d = "") => z.string().trim().max(2000).default(d);
const bool = (d: boolean) => z.boolean().default(d);
const int = (d: number, min = 0, max = 1_000_000) => z.number().int().min(min).max(max).default(d);
const list = () => z.array(z.string().trim().min(1).max(300)).max(50).default([]);

export const SCHEMAS = {
  general: z.object({
    siteName: str("Mein Unternehmen"),
    siteUrl: str(""),
    companyName: str(""),
    street: str(""),
    zip: str(""),
    city: str(""),
    country: str("CH"),
    email: str(""),
    phone: str(""),
    vatNumber: str(""),
    timezone: str("Europe/Zurich"),
    locale: str("de-CH"),
    currency: str("CHF"),
  }),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#025159"),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#028D86"),
    logoUrl: str(""),
    logoDarkUrl: str(""),
    faviconUrl: str(""),
  }),
  /** Plugins (Dashboard → Plugins). All off on a new installation; `storefront` is an option of the shop. */
  modules: z.object({
    shop: bool(false),
    storefront: bool(true),
    blog: bool(false),
    inquiries: bool(false),
    analytics: bool(false),
    seo: bool(false),
    cookies: bool(false),
    maintenance: bool(false),
    redirects: bool(false),
    announcement: bool(false),
    customCode: bool(false),
  }),
  shop: z.object({
    pricesIncludeTax: bool(true),
    orderPrefix: str(""),
    orderNumberStart: int(1000, 1),
    lowStockThreshold: int(3),
    guestCheckout: bool(true),
    showOutOfStock: bool(true),
    productsPerPage: int(24, 4, 200),
    requireTerms: bool(true),
    termsUrl: str(""),
    privacyUrl: str(""),
    returnPolicy: str(""),
    checkoutNote: str(""),
    shipToCountries: z.array(z.string().length(2)).default(["CH", "LI"]),
    orderNotifyEmails: list(),
    invoiceFooter: str(""),
  }),
  payments: z.object({
    stripeEnabled: bool(false),
    stripePublishableKey: str(""),
    stripeSecretKey: str(""),
    stripeWebhookSecret: str(""),
    payrexxEnabled: bool(false),
    payrexxInstance: str(""),
    payrexxApiSecret: str(""),
    invoiceEnabled: bool(false),
    invoiceDueDays: int(30, 1, 120),
    invoiceOnlyForCustomers: bool(false),
    bankTransferEnabled: bool(true),
    bankAccountHolder: str(""),
    bankIban: str(""),
    bankName: str(""),
    bankInstructions: str(""),
    pickupPaymentEnabled: bool(false),
  }),
  email: z.object({
    fromName: str(""),
    fromEmail: str(""),
    replyTo: str(""),
    smtpHost: str(""),
    smtpPort: int(587, 1, 65535),
    smtpSecure: bool(false),
    smtpUser: str(""),
    smtpPassword: str(""),
    notifyNewOrder: list(),
    notifyInquiry: list(),
    notifyLowStock: list(),
    /** weekly summary (Mondays); empty = none */
    notifyWeekly: list(),
    /** per source of an enquiry (form name); empty = notifyInquiry */
    notifyContact: list(),
    notifyAnalysis: list(),
    notifyChat: list(),
    /** due follow-ups by e-mail; empty = only the notification in the dashboard */
    notifyFollowUp: list(),
  }),
  security: z.object({
    require2fa: bool(true),
    sessionIdleMinutes: int(60, 5, 24 * 60),
    sessionMaxHours: int(12, 1, 24 * 30),
    passwordMinLength: int(12, 8, 128),
    loginMaxAttempts: int(5, 3, 50),
    lockoutMinutes: int(15, 1, 24 * 60),
    adminIpAllowlist: list(),
  }),
  analytics: z.object({
    ga4MeasurementId: str(""),
    ga4PropertyId: str(""),
    serviceAccountEmail: str(""),
    serviceAccountKey: str(""),
  }),
  api: z.object({
    corsOrigins: list(),
  }),
  seoSite: z.object({
    titleTemplate: str("%s · {site}"),
    defaultDescription: str(""),
    ogImage: str(""),
    googleVerification: str(""),
    bingVerification: str(""),
    noindexSite: bool(false),
  }),
  cookies: z.object({
    text: str("Wir verwenden Cookies, um die Nutzung der Website zu messen und sie zu verbessern. Sie entscheiden, ob Sie dem zustimmen."),
    acceptLabel: str("Akzeptieren"),
    declineLabel: str("Nur notwendige"),
    privacyUrl: str("/datenschutz"),
  }),
  announcement: z.object({
    text: str(""),
    linkLabel: str(""),
    linkUrl: str(""),
    startsAt: str(""),
    endsAt: str(""),
    tone: z.enum(["brand", "accent", "dark"]).default("brand"),
    dismissible: bool(true),
  }),
  maintenance: z.object({
    title: str("Wir sind bald zurück"),
    text: str("Wir arbeiten gerade an unserer Website. Bitte schauen Sie in Kürze wieder vorbei."),
    showContact: bool(true),
  }),
  customCode: z.object({
    head: z.string().max(20_000).default(""),
    bodyEnd: z.string().max(20_000).default(""),
    needsConsent: bool(true),
  }),
  /** Texts and images of the website, keys from src/site/fields.ts (Website → Texte & Bilder). */
  siteContent: z.record(z.string(), z.string().max(50_000)).default({}),
  /** Menus of the website; an empty header menu is built automatically. */
  menus: z.object({
    header: z.array(z.object({ label: z.string().trim().min(1).max(60), url: z.string().trim().min(1).max(500) })).max(12).default([]),
    footer: z.array(z.object({ label: z.string().trim().min(1).max(60), url: z.string().trim().min(1).max(500) })).max(12).default([]),
  }),
  contactForm: z.object({
    title: str("Kontakt"),
    intro: str("Schreiben Sie uns – wir melden uns in der Regel innert eines Arbeitstages."),
    successMessage: str("Danke für Ihre Nachricht. Wir melden uns so bald wie möglich."),
    askPhone: bool(true),
    askCompany: bool(false),
  }),
};

export type SettingsKey = keyof typeof SCHEMAS;
export type Settings = { [K in SettingsKey]: z.infer<(typeof SCHEMAS)[K]> };

/** Fields encrypted at rest and never sent back to the browser. */
export const SECRET_FIELDS: { [K in SettingsKey]?: (keyof Settings[K])[] } = {
  payments: ["stripeSecretKey", "stripeWebhookSecret", "payrexxApiSecret"],
  email: ["smtpPassword"],
  analytics: ["serviceAccountKey"],
};

const TTL = 5_000;
const cache = new Map<SettingsKey, { at: number; value: unknown }>();

export function defaults<K extends SettingsKey>(key: K): Settings[K] {
  return SCHEMAS[key].parse({}) as Settings[K];
}

/* ---------- values from the environment (.env / Coolify) ---------- */

const env = (name: string) => process.env[name]?.trim() || "";
/** "Madex IT Solutions <website@madex-it.ch>" → name and address */
function mailFrom() {
  const m = env("MAIL_FROM").match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return { name: m?.[1].trim() ?? "", email: env("MAIL_FROM_EMAIL") || m?.[2].trim() || env("CONTACT_FROM_EMAIL") };
}

/** Settings that come from environment variables. Set there, they win over the database and have no field in the dashboard. */
function fromEnv(key: SettingsKey): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = (field: string, value: unknown) => {
    if (value !== "" && value !== undefined) out[field] = value;
  };
  if (key === "general") set("siteUrl", env("NEXT_PUBLIC_SITE_URL"));
  if (key === "email" && env("SMTP_HOST")) {
    const from = mailFrom();
    set("smtpHost", env("SMTP_HOST"));
    set("smtpPort", Number(env("SMTP_PORT") || 587));
    set("smtpSecure", env("SMTP_SECURE") === "true");
    set("smtpUser", env("SMTP_USER"));
    set("smtpPassword", env("SMTP_PASSWORD"));
    set("fromEmail", from.email);
    set("fromName", from.name);
  }
  if (key === "analytics") {
    set("ga4MeasurementId", env("NEXT_PUBLIC_GA4_ID"));
    set("ga4PropertyId", env("GA4_PROPERTY_ID"));
    set("serviceAccountEmail", env("GOOGLE_SERVICE_ACCOUNT_EMAIL"));
    set("serviceAccountKey", env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") || env("GOOGLE_SERVICE_ACCOUNT_KEY"));
  }
  return out;
}

/** Fields of a group that are set by environment variables (shown read-only in the dashboard). */
export function envManaged(key: SettingsKey): string[] {
  return Object.keys(fromEnv(key));
}

export async function getSettings<K extends SettingsKey>(key: K): Promise<Settings[K]> {
  const stored = await storedSettings(key);
  const overlay = fromEnv(key);
  return (Object.keys(overlay).length ? { ...stored, ...overlay } : stored) as Settings[K];
}

/** Only what the dashboard saved (without environment values). */
async function storedSettings<K extends SettingsKey>(key: K): Promise<Settings[K]> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as Settings[K];
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  const raw = { ...((row?.value as Record<string, unknown>) ?? {}) };
  for (const f of (SECRET_FIELDS[key] ?? []) as string[]) {
    if (isEncrypted(raw[f])) {
      try {
        raw[f] = decrypt(raw[f] as string);
      } catch {
        raw[f] = "";
      }
    }
  }
  const parsed = SCHEMAS[key].safeParse(raw);
  const value = (parsed.success ? parsed.data : defaults(key)) as Settings[K];
  cache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Merges `patch` into the stored group. Secret fields that arrive empty keep
 * their stored value (forms never receive secrets, so empty means "unchanged").
 */
export async function saveSettings<K extends SettingsKey>(key: K, patch: Partial<Settings[K]>, userId?: string, opts: { replace?: boolean } = {}): Promise<Settings[K]> {
  const current = await storedSettings(key);
  const secrets = (SECRET_FIELDS[key] ?? []) as string[];
  // replace: write the value as given (to remove keys of a record group)
  const merged: Record<string, unknown> = opts.replace ? { ...patch } : { ...current, ...patch };
  for (const f of secrets) if (patch[f as keyof Settings[K]] === "" || patch[f as keyof Settings[K]] === undefined) merged[f] = (current as Record<string, unknown>)[f];
  const value = SCHEMAS[key].parse(merged) as Settings[K];
  const stored: Record<string, unknown> = { ...value };
  for (const f of secrets) if (stored[f]) stored[f] = encrypt(String(stored[f]));
  await db
    .insert(settingsTable)
    .values({ key, value: stored, updatedBy: userId ?? null, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: stored, updatedBy: userId ?? null, updatedAt: new Date() } });
  cache.delete(key);
  return value;
}

/** Clears a secret explicitly (forms use a "remove" checkbox for that). */
export async function clearSecret<K extends SettingsKey>(key: K, field: keyof Settings[K], userId?: string) {
  const current = { ...(await storedSettings(key)) } as Record<string, unknown>;
  current[field as string] = "";
  const stored: Record<string, unknown> = { ...current };
  for (const f of (SECRET_FIELDS[key] ?? []) as string[]) if (stored[f]) stored[f] = encrypt(String(stored[f]));
  await db.update(settingsTable).set({ value: stored, updatedBy: userId ?? null, updatedAt: new Date() }).where(eq(settingsTable.key, key));
  cache.delete(key);
}

/** Settings for a form: secrets replaced by a hint like "•••• 4f2a" (or "" when unset). */
export async function getSettingsForForm<K extends SettingsKey>(key: K): Promise<Settings[K] & { _secrets: Record<string, string> }> {
  const value = { ...(await getSettings(key)) } as Record<string, unknown>;
  const hints: Record<string, string> = {};
  for (const f of (SECRET_FIELDS[key] ?? []) as string[]) {
    const v = String(value[f] ?? "");
    hints[f] = v ? `•••• ${v.slice(-4)}` : "";
    value[f] = "";
  }
  return { ...(value as Settings[K]), _secrets: hints };
}

export function invalidateSettings() {
  cache.clear();
}
