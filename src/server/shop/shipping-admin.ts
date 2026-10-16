/** Shipping zones (countries) and their methods: flat rate, free, pickup, weight-based. */
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { shippingMethods, shippingZones, taxClasses } from "@/server/db/schema";
import { audit, type Actor } from "@/server/audit";
import { fromZod, InputError } from "./errors";

export const SHIPPING_TYPES = ["flat", "free", "pickup", "weight"] as const;
export const SHIPPING_TYPE_LABEL: Record<(typeof SHIPPING_TYPES)[number], string> = { flat: "Pauschal", free: "Gratis", pickup: "Abholung", weight: "Nach Gewicht" };

export const zoneInputSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben, z. B. «Schweiz».").max(100),
  countries: z
    .array(z.string().trim().toUpperCase())
    .min(1, "Bitte mindestens ein Land angeben (z. B. CH) oder * für die übrige Welt.")
    .max(250)
    .superRefine((list, ctx) => {
      const bad = list.find((c) => c !== "*" && !/^[A-Z]{2}$/.test(c));
      if (bad) ctx.addIssue({ code: "custom", message: `«${bad}» ist kein Ländercode. Verwenden Sie 2 Buchstaben (CH, LI, DE …) oder *.` });
    }),
  sort: z.number().int().min(-1000).max(1000).default(0),
});
export type ZoneInput = z.input<typeof zoneInputSchema>;

const optMoney = (msg: string) =>
  z
    .number({ invalid_type_error: msg })
    .int()
    .min(0, msg)
    .max(100_000_000, msg)
    .nullish()
    .transform((v) => v ?? null);

export const methodInputSchema = z
  .object({
    zoneId: z.string().uuid("Bitte eine Zone wählen."),
    name: z.string().trim().min(1, "Bitte einen Namen eingeben, z. B. «PostPac Economy».").max(100),
    description: z.string().trim().max(300).default(""),
    type: z.enum(SHIPPING_TYPES),
    price: z.number({ invalid_type_error: "Bitte einen Preis eingeben." }).int().min(0, "Der Preis darf nicht negativ sein.").max(100_000_000).default(0),
    freeAbove: optMoney("«Gratis ab» muss ein Betrag ab 0 sein."),
    weightRates: z
      .array(z.object({ upToGrams: z.number().int().min(1, "Gewicht ab 1 g."), price: z.number().int().min(0) }))
      .max(50)
      .default([]),
    minSubtotal: optMoney("Der Mindestbestellwert muss ein Betrag ab 0 sein."),
    deliveryDaysMin: z.number().int().min(0).max(365).nullish().transform((v) => v ?? null),
    deliveryDaysMax: z.number().int().min(0).max(365).nullish().transform((v) => v ?? null),
    taxClassId: z.string().uuid().nullish().transform((v) => v ?? null),
    active: z.boolean().default(true),
    sort: z.number().int().min(-1000).max(1000).default(0),
  })
  .superRefine((m, ctx) => {
    if (m.type === "weight") {
      if (!m.weightRates.length) ctx.addIssue({ code: "custom", path: ["weightRates"], message: "Bitte mindestens eine Gewichtsstufe angeben." });
      for (let i = 1; i < m.weightRates.length; i++)
        if (m.weightRates[i].upToGrams <= m.weightRates[i - 1].upToGrams) ctx.addIssue({ code: "custom", path: ["weightRates"], message: "Die Gewichtsstufen müssen aufsteigend sein (jede Stufe schwerer als die vorherige)." });
    }
    if (m.deliveryDaysMin !== null && m.deliveryDaysMax !== null && m.deliveryDaysMax < m.deliveryDaysMin) ctx.addIssue({ code: "custom", path: ["deliveryDaysMax"], message: "«Bis» darf nicht kleiner sein als «von»." });
  })
  .transform((m) => ({
    ...m,
    price: m.type === "free" ? 0 : m.price,
    weightRates: m.type === "weight" ? [...m.weightRates].sort((a, b) => a.upToGrams - b.upToGrams) : [],
    freeAbove: m.type === "free" ? null : m.freeAbove,
  }));
export type MethodInput = z.input<typeof methodInputSchema>;

/** Zones in order with their methods. */
export async function listShipping() {
  const [zones, methods] = await Promise.all([
    db.select().from(shippingZones).orderBy(asc(shippingZones.sort), asc(shippingZones.createdAt)),
    db.select().from(shippingMethods).orderBy(asc(shippingMethods.sort), asc(shippingMethods.createdAt)),
  ]);
  return zones.map((z) => ({ ...z, methods: methods.filter((m) => m.zoneId === z.id) }));
}

export async function saveZone(id: string | null, input: ZoneInput, actor: Actor) {
  const r = zoneInputSchema.safeParse(input);
  if (!r.success) throw fromZod(r.error);
  const z0 = { ...r.data, countries: [...new Set(r.data.countries)] };
  const others = (await db.select().from(shippingZones)).filter((z) => z.id !== id);
  for (const c of z0.countries) {
    const other = others.find((z) => z.countries.includes(c));
    if (other) throw new InputError(`${c === "*" ? "«Übrige Welt»" : c} ist bereits in der Zone «${other.name}». Jedes Land darf nur in einer Zone sein.`, { countries: "Land kommt in einer anderen Zone vor." });
  }
  const [row] = id ? await db.update(shippingZones).set(z0).where(eq(shippingZones.id, id)).returning() : await db.insert(shippingZones).values(z0).returning();
  if (!row) throw new InputError("Die Versandzone wurde nicht gefunden.");
  await audit(actor, id ? "shipping_zone.updated" : "shipping_zone.created", { entityType: "shipping_zone", entityId: row.id, summary: `Versandzone ${id ? "bearbeitet" : "erstellt"}: ${row.name}` });
  return row;
}

export async function deleteZone(id: string, actor: Actor) {
  const [row] = await db.delete(shippingZones).where(eq(shippingZones.id, id)).returning();
  if (row) await audit(actor, "shipping_zone.deleted", { entityType: "shipping_zone", entityId: id, summary: `Versandzone gelöscht: ${row.name}` });
  return row ?? null;
}

export async function saveMethod(id: string | null, input: MethodInput, actor: Actor) {
  const r = methodInputSchema.safeParse(input);
  if (!r.success) throw fromZod(r.error);
  const m = r.data;
  const [zone] = await db.select({ id: shippingZones.id }).from(shippingZones).where(eq(shippingZones.id, m.zoneId));
  if (!zone) throw new InputError("Die Versandzone gibt es nicht mehr.");
  if (m.taxClassId) {
    const [t] = await db.select({ id: taxClasses.id }).from(taxClasses).where(eq(taxClasses.id, m.taxClassId));
    if (!t) m.taxClassId = null;
  }
  const [row] = id ? await db.update(shippingMethods).set(m).where(eq(shippingMethods.id, id)).returning() : await db.insert(shippingMethods).values(m).returning();
  if (!row) throw new InputError("Die Versandart wurde nicht gefunden.");
  await audit(actor, id ? "shipping_method.updated" : "shipping_method.created", { entityType: "shipping_method", entityId: row.id, summary: `Versandart ${id ? "bearbeitet" : "erstellt"}: ${row.name}` });
  return row;
}

export async function deleteMethod(id: string, actor: Actor) {
  const [row] = await db.delete(shippingMethods).where(eq(shippingMethods.id, id)).returning();
  if (row) await audit(actor, "shipping_method.deleted", { entityType: "shipping_method", entityId: id, summary: `Versandart gelöscht: ${row.name}` });
  return row ?? null;
}

export async function setMethodsActive(ids: string[], active: boolean, actor: Actor) {
  if (!ids.length) return 0;
  const rows = await db.update(shippingMethods).set({ active }).where(inArray(shippingMethods.id, ids)).returning({ id: shippingMethods.id, name: shippingMethods.name });
  for (const r of rows) await audit(actor, "shipping_method.updated", { entityType: "shipping_method", entityId: r.id, summary: `Versandart ${active ? "aktiviert" : "deaktiviert"}: ${r.name}` });
  return rows.length;
}
