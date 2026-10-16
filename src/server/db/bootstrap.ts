/** Idempotent defaults every installation needs: built-in roles, Swiss VAT classes, a shipping zone. */
import { eq } from "drizzle-orm";
import { SYSTEM_ROLES } from "@/server/auth/permissions";
import type { DB } from "./index";
import { roles, shippingMethods, shippingZones, taxClasses } from "./schema";

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
}
