/**
 * Activating plugins and checking whether an active plugin is fully set up.
 * The catalogue itself lives in src/modules/registry.ts.
 */
import { count } from "drizzle-orm";
import { AVAILABLE_PLUGINS as PLUGINS, type PluginKey } from "@/modules/registry";
import { audit, type Actor } from "@/server/audit";
import { db } from "@/server/db";
import { posts, products } from "@/server/db/schema";
import { smtpConfig } from "@/server/mail/mailer";
import { getSettings, saveSettings } from "@/server/settings";

export async function setPluginActive(actor: Actor & { id: string }, key: PluginKey, active: boolean) {
  const plugin = PLUGINS.find((p) => p.key === key);
  if (!plugin) return { error: "Dieses Plugin gibt es nicht." };
  const before = await getSettings("modules");
  if (before[key] === active) return { ok: true as const, changed: false };
  await saveSettings("modules", { [key]: active }, actor.id);
  await audit(actor, active ? "plugin.activated" : "plugin.deactivated", { entityType: "plugin", entityId: key, summary: `Plugin «${plugin.name}» ${active ? "aktiviert" : "deaktiviert"}` });
  return { ok: true as const, changed: true };
}

export type SetupState = { tone: "ok" | "warn" | "info"; text: string };

/** One line per active plugin: is it ready, or what is still missing? */
export async function pluginSetupStates(): Promise<Partial<Record<PluginKey, SetupState>>> {
  const [m, pay, ga, ann, code, mail] = await Promise.all([getSettings("modules"), getSettings("payments"), getSettings("analytics"), getSettings("announcement"), getSettings("customCode"), smtpConfig().then((c) => c.configured)]);
  const out: Partial<Record<PluginKey, SetupState>> = {};
  if (m.shop) {
    const [[p], anyPay] = await Promise.all([db.select({ n: count() }).from(products), Promise.resolve(pay.stripeEnabled || pay.payrexxEnabled || pay.invoiceEnabled || (pay.bankTransferEnabled && Boolean(pay.bankIban)) || pay.pickupPaymentEnabled)]);
    out.shop = !anyPay ? { tone: "warn", text: "Noch keine Zahlungsart eingerichtet." } : p.n === 0 ? { tone: "warn", text: "Noch keine Produkte erfasst." } : { tone: "ok", text: `${p.n} Produkt${p.n === 1 ? "" : "e"} im Shop.` };
  }
  if (m.blog) {
    const [p] = await db.select({ n: count() }).from(posts);
    out.blog = p.n === 0 ? { tone: "info", text: "Noch keine Beiträge geschrieben." } : { tone: "ok", text: `${p.n} Beitr${p.n === 1 ? "ag" : "äge"}.` };
  }
  if (m.inquiries) out.inquiries = mail ? { tone: "ok", text: "Anfragen werden per E-Mail gemeldet." } : { tone: "warn", text: "E-Mail-Versand fehlt – Anfragen erscheinen nur im Dashboard." };
  if (m.seo) out.seo = { tone: "ok", text: "sitemap.xml und robots.txt sind aktiv." };
  if (m.analytics) out.analytics = !ga.ga4MeasurementId ? { tone: "warn", text: "Mess-ID fehlt – es wird noch nichts gemessen." } : !ga.ga4PropertyId || !ga.serviceAccountKey ? { tone: "info", text: "Misst Besucher. Für Zahlen im Dashboard den Zugang verbinden." } : { tone: "ok", text: "Misst Besucher und zeigt die Zahlen im Dashboard." };
  if (m.cookies) out.cookies = { tone: "ok", text: "Fragt Besucher nach der Einwilligung." };
  if (m.redirects) out.redirects = { tone: "ok", text: "Weiterleitungen und 404-Protokoll aktiv." };
  if (m.announcement) out.announcement = ann.text ? { tone: "ok", text: "Leiste wird angezeigt." } : { tone: "warn", text: "Noch kein Text – die Leiste ist unsichtbar." };
  if (m.maintenance) out.maintenance = { tone: "warn", text: "Besucher sehen nur die Wartungsseite." };
  if (m.customCode) out.customCode = code.head || code.bodyEnd ? { tone: "ok", text: "Code wird eingebunden." } : { tone: "info", text: "Noch kein Code eingefügt." };
  return out;
}
