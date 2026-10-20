/** Idempotent defaults every installation needs: built-in roles, Swiss VAT classes, a shipping zone. */
import { eq } from "drizzle-orm";
import { SYSTEM_ROLES } from "@/server/auth/permissions";
import type { DB } from "./index";
import { hashPassword } from "@/server/lib/crypto";
import { roles, shippingMethods, shippingZones, taxClasses, users } from "./schema";

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

  await ownerFromEnv(db);
}

/**
 * Optional: create the owner account from the environment on a fresh database
 * (ADMIN_EMAIL – or ADMIN_USERNAME when it is an e-mail address – and ADMIN_PASSWORD,
 * at least 12 characters). Does nothing once any user exists; 2FA is set up at the first login.
 */
export async function ownerFromEnv(db: DB) {
  const email = (process.env.ADMIN_EMAIL || (process.env.ADMIN_USERNAME?.includes("@") ? process.env.ADMIN_USERNAME : "") || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) return;
  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser) return;
  if (password.length < 12) {
    console.warn("[setup] ADMIN_PASSWORD ist kürzer als 12 Zeichen – Inhaber-Konto wurde nicht angelegt. Bitte unter /admin/einrichtung erstellen.");
    return;
  }
  const [owner] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, "owner"));
  if (!owner) return;
  await db.insert(users).values({ email, name: process.env.ADMIN_NAME?.trim() || "Inhaber", passwordHash: await hashPassword(password), roleId: owner.id, passwordChangedAt: new Date() });
  console.log(`[setup] Inhaber-Konto ${email} aus den Umgebungsvariablen angelegt.`);
}
