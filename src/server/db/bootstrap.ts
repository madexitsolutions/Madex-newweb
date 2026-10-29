/** Idempotent defaults every installation needs: built-in roles, Swiss VAT classes, a shipping zone. */
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { SYSTEM_ROLES } from "@/server/auth/permissions";
import type { DB } from "./index";
import { hashPassword } from "@/server/lib/crypto";
import { pages, roles, sessions, settings, shippingMethods, shippingZones, taxClasses, totpDevices, users } from "./schema";
import { STARTER_PAGES } from "@/server/site/pages";

/** settings row that remembers which ADMIN_RESET was already applied */
const RESET_MARKER = "adminResetApplied";

export async function bootstrap(db: DB) {
  for (const r of SYSTEM_ROLES) {
    const [existing] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, r.key));
    if (existing) {
      // keep built-in roles in sync with the code (new permissions appear automatically)
      await db.update(roles).set({ name: r.name, description: r.description, permissions: r.permissions, isSystem: true }).where(eq(roles.id, existing.id));
    } else {
      await db.insert(roles).values({ key: r.key, name: r.name, description: r.description, permissions: r.permissions, isSystem: true });
    }
  }

  const [anyPage] = await db.select({ id: pages.id }).from(pages).limit(1);
  if (!anyPage) await db.insert(pages).values(STARTER_PAGES.map((p) => ({ ...p, status: "published" as const })));

  const [anyTax] = await db.select({ id: taxClasses.id }).from(taxClasses).limit(1);
  if (!anyTax) {
    await db.insert(taxClasses).values([
      { name: "Normalsatz", rateBp: 810, isDefault: true },
      { name: "Reduzierter Satz", rateBp: 260 },
      { name: "Beherbergung", rateBp: 380 },
      { name: "Steuerfrei", rateBp: 0 },
    ]);
  }

  const [anyZone] = await db.select({ id: shippingZones.id }).from(shippingZones).limit(1);
  if (!anyZone) {
    const [ch] = await db.insert(shippingZones).values({ name: "Schweiz & Liechtenstein", countries: ["CH", "LI"], sort: 0 }).returning();
    await db.insert(shippingMethods).values([
      { zoneId: ch.id, name: "PostPac Economy", description: "2–3 Werktage", type: "flat", price: 900, freeAbove: 10000, deliveryDaysMin: 2, deliveryDaysMax: 3, sort: 0 },
      { zoneId: ch.id, name: "PostPac Priority", description: "Nächster Werktag", type: "flat", price: 1200, deliveryDaysMin: 1, deliveryDaysMax: 1, sort: 1 },
      { zoneId: ch.id, name: "Abholung", description: "Nach Vereinbarung im Geschäft", type: "pickup", price: 0, sort: 2 },
    ]);
  }

  await pluginDefaults(db);
  await ownerFromEnv(db);
}

/**
 * Creates the owner account – or, if the e-mail already exists, resets it: new password,
 * owner role, active, lockout cleared, 2FA switched off (set up again at the next login),
 * all sessions signed out. Used by ADMIN_RESET=true and `npm run admin:reset`.
 */
export async function resetOwner(db: DB, emailRaw: string, password: string, name?: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Bitte eine gültige E-Mail-Adresse angeben.");
  if (password.length < 12) throw new Error("Das Passwort muss mindestens 12 Zeichen lang sein.");
  const [owner] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, "owner"));
  if (!owner) throw new Error("Die Rollen fehlen – die Datenbank ist nicht eingerichtet.");
  const passwordHash = await hashPassword(password);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, roleId: owner.id, status: "active", failedLogins: 0, lockedUntil: null, totpEnabled: false, totpSecret: null, recoveryCodes: [], passwordChangedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    await db.delete(sessions).where(eq(sessions.userId, existing.id));
    await db.delete(totpDevices).where(eq(totpDevices.userId, existing.id));
    return "reset" as const;
  }
  await db.insert(users).values({ email, name: name?.trim() || "Inhaber", passwordHash, roleId: owner.id, passwordChangedAt: new Date() });
  return "created" as const;
}

/**
 * Owner account from the environment:
 * - ADMIN_EMAIL (or an e-mail in ADMIN_USERNAME) + ADMIN_PASSWORD (min. 12 characters) create the
 *   owner on an empty database;
 * - with ADMIN_RESET=true the account is reset once per e-mail/password (for another reset change the
 *   password); remove the variable afterwards.
 */
export async function ownerFromEnv(db: DB) {
  const email = (process.env.ADMIN_EMAIL || (process.env.ADMIN_USERNAME?.includes("@") ? process.env.ADMIN_USERNAME : "") || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) return;
  if (password.length < 12) {
    console.warn("[setup] ADMIN_PASSWORD ist kürzer als 12 Zeichen – das Inhaber-Konto wurde nicht angelegt.");
    return;
  }
  if (process.env.ADMIN_RESET === "true") {
    // only once per e-mail/password: a forgotten ADMIN_RESET=true must not wipe the 2FA on every restart
    const marker = createHash("sha256").update(`${email}\n${password}`).digest("hex");
    const [done] = await db.select().from(settings).where(eq(settings.key, RESET_MARKER));
    if ((done?.value as { marker?: string } | undefined)?.marker === marker) {
      console.warn(`[setup] ADMIN_RESET ist noch gesetzt, das Konto ${email} wurde mit diesen Zugangsdaten bereits zurückgesetzt – übersprungen. Entfernen Sie ADMIN_RESET.`);
      return;
    }
    const r = await resetOwner(db, email, password, process.env.ADMIN_NAME);
    await db.insert(settings).values({ key: RESET_MARKER, value: { marker } }).onConflictDoUpdate({ target: settings.key, set: { value: { marker }, updatedAt: new Date() } });
    console.warn(`[setup] ADMIN_RESET: Konto ${email} ${r === "reset" ? "zurückgesetzt" : "angelegt"}. Entfernen Sie ADMIN_RESET jetzt wieder.`);
    return;
  }
  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser) return;
  await resetOwner(db, email, password, process.env.ADMIN_NAME);
  console.log(`[setup] Inhaber-Konto ${email} aus den Umgebungsvariablen angelegt.`);
}

/**
 * Plugins are off on a new installation. Installations from before the plugins
 * (users exist, no stored choice yet) keep what was switched on by default then.
 */
async function pluginDefaults(db: DB) {
  const [stored] = await db.select({ key: settings.key }).from(settings).where(eq(settings.key, "modules"));
  if (stored) return;
  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  const value = anyUser ? { shop: true, storefront: true, blog: true, inquiries: true, analytics: true, seo: true } : {};
  await db.insert(settings).values({ key: "modules", value }).onConflictDoNothing();
}
