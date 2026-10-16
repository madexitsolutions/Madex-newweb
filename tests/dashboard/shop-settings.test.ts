import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { sequences, shippingMethods, shippingZones } from "@/server/db/schema";
import { getSettings, saveSettings } from "@/server/settings";
import { nextOrderNumber } from "@/server/shop/sequence";
import { InputError } from "@/server/shop/errors";
import {
  nextOrderNumberPreview,
  paymentReadiness,
  saveCheckoutSettings,
  savePaymentSettings,
  saveShipToCountries,
  saveShopGeneral,
  uncoveredCountries,
  type PaymentsInput,
  type ShopGeneralInput,
} from "@/server/shop/shop-settings";

const actor = null;

const general = (o: Partial<ShopGeneralInput> = {}): ShopGeneralInput => ({
  orderPrefix: "",
  orderNumberStart: 1000,
  lowStockThreshold: 3,
  showOutOfStock: true,
  productsPerPage: 24,
  orderNotifyEmails: [],
  invoiceFooter: "",
  ...o,
});

const payments = (o: Partial<PaymentsInput> = {}): PaymentsInput => ({
  stripeEnabled: false,
  stripePublishableKey: "",
  stripeSecretKey: "",
  stripeWebhookSecret: "",
  payrexxEnabled: false,
  payrexxInstance: "",
  payrexxApiSecret: "",
  invoiceEnabled: false,
  invoiceDueDays: 30,
  invoiceOnlyForCustomers: false,
  bankTransferEnabled: false,
  bankAccountHolder: "",
  bankIban: "",
  bankName: "",
  bankInstructions: "",
  pickupPaymentEnabled: false,
  ...o,
});

const fieldErrors = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof InputError) return e.fieldErrors ?? {};
    throw e;
  }
  return null;
};

describe("shop general settings", () => {
  it("validates prefix, numbers and e-mails", async () => {
    expect(await fieldErrors(saveShopGeneral(general({ orderPrefix: "S H" }), actor))).toHaveProperty("orderPrefix");
    expect(await fieldErrors(saveShopGeneral(general({ productsPerPage: 2 }), actor))).toHaveProperty("productsPerPage");
    expect(await fieldErrors(saveShopGeneral(general({ orderNumberStart: Number.NaN }), actor))).toHaveProperty("orderNumberStart");
    expect(await fieldErrors(saveShopGeneral(general({ orderNotifyEmails: ["kein-mail"] }), actor))).toHaveProperty(["orderNotifyEmails.0"]);
    await saveShopGeneral(general({ orderPrefix: "SH-", orderNotifyEmails: ["A@b.ch", "a@b.ch"] }), actor);
    const s = await getSettings("shop");
    expect(s.orderPrefix).toBe("SH-");
    expect(s.orderNotifyEmails).toEqual(["a@b.ch"]);
  });

  it("moves the order counter forward but never back", async () => {
    await saveShopGeneral(general({ orderNumberStart: 5000 }), actor);
    expect(await nextOrderNumberPreview()).toBe(5000);
    expect(await nextOrderNumber()).toBe(5000);
    expect(await nextOrderNumber()).toBe(5001);
    expect(await nextOrderNumberPreview()).toBe(5002);
    // lower than already used → error
    expect(await fieldErrors(saveShopGeneral(general({ orderNumberStart: 5001 }), actor))).toHaveProperty("orderNumberStart");
    // unchanged start (other fields edited) is fine
    await saveShopGeneral(general({ orderNumberStart: 5000, lowStockThreshold: 5 }), actor);
    // higher → counter jumps
    await saveShopGeneral(general({ orderNumberStart: 9000 }), actor);
    expect(await nextOrderNumber()).toBe(9000);
    const [row] = await db.select().from(sequences).where(eq(sequences.key, "order"));
    expect(row.value).toBe(9000);
  });
});

describe("checkout settings", () => {
  it("needs a terms link when terms must be accepted", async () => {
    const base = { guestCheckout: true, requireTerms: true, termsUrl: "", privacyUrl: "", returnPolicy: "", checkoutNote: "" };
    expect(await fieldErrors(saveCheckoutSettings(base, actor))).toHaveProperty("termsUrl");
    expect(await fieldErrors(saveCheckoutSettings({ ...base, termsUrl: "agb" }, actor))).toHaveProperty("termsUrl");
    await saveCheckoutSettings({ ...base, termsUrl: "/agb" }, actor);
    await saveCheckoutSettings({ ...base, requireTerms: false, guestCheckout: false }, actor);
    expect((await getSettings("shop")).guestCheckout).toBe(false);
  });
});

describe("ship-to countries and zones", () => {
  it("normalises codes and reports countries without an active method", async () => {
    await db.delete(shippingZones); // bootstrap creates a CH/LI zone
    expect(await fieldErrors(saveShipToCountries(["CHE"], actor))).not.toBeNull();
    expect(await saveShipToCountries(["ch", "li", "CH"], actor)).toEqual(["CH", "LI"]);
    expect(await uncoveredCountries()).toEqual(["CH", "LI"]);
    const [zone] = await db.insert(shippingZones).values({ name: "Schweiz", countries: ["CH"] }).returning();
    const [m] = await db.insert(shippingMethods).values({ zoneId: zone.id, name: "Post", type: "flat", price: 900 }).returning();
    expect(await uncoveredCountries()).toEqual(["LI"]);
    await db.update(shippingMethods).set({ active: false }).where(eq(shippingMethods.id, m.id));
    expect(await uncoveredCountries()).toEqual(["CH", "LI"]);
    const [world] = await db.insert(shippingZones).values({ name: "Welt", countries: ["*"] }).returning();
    await db.insert(shippingMethods).values({ zoneId: world.id, name: "International", type: "flat", price: 2500 });
    expect(await uncoveredCountries()).toEqual([]);
    await db.delete(shippingZones);
  });
});

describe("payment settings", () => {
  it("requires what an enabled method needs", async () => {
    const e = await fieldErrors(savePaymentSettings(payments({ stripeEnabled: true, payrexxEnabled: true, bankTransferEnabled: true }), actor));
    expect(Object.keys(e ?? {}).sort()).toEqual(["bankIban", "payrexxApiSecret", "payrexxInstance", "stripePublishableKey", "stripeSecretKey", "stripeWebhookSecret"]);
  });

  it("checks key prefixes, test/live mix and the IBAN", async () => {
    expect(await fieldErrors(savePaymentSettings(payments({ stripePublishableKey: "sk_live_x" }), actor))).toHaveProperty("stripePublishableKey");
    expect(await fieldErrors(savePaymentSettings(payments({ stripeWebhookSecret: "abc" }), actor))).toHaveProperty("stripeWebhookSecret");
    const mixed = await fieldErrors(savePaymentSettings(payments({ stripeEnabled: true, stripePublishableKey: "pk_test_1", stripeSecretKey: "sk_live_1", stripeWebhookSecret: "whsec_1" }), actor));
    expect(mixed?.stripePublishableKey).toMatch(/gemischt/);
    expect(await fieldErrors(savePaymentSettings(payments({ bankIban: "CH93 0076 2011 6238 5295 8" }), actor))).toHaveProperty("bankIban");
  });

  it("keeps stored secrets when fields are empty and removes them on request", async () => {
    await savePaymentSettings(
      payments({ stripeEnabled: true, stripePublishableKey: "pk_test_1", stripeSecretKey: "sk_test_secret", stripeWebhookSecret: "whsec_abc", payrexxInstance: "https://MeinShop.payrexx.com/", bankIban: "ch93 0076 2011 6238 5295 7", bankTransferEnabled: true }),
      actor,
    );
    let p = await getSettings("payments");
    expect(p.stripeSecretKey).toBe("sk_test_secret");
    expect(p.payrexxInstance).toBe("meinshop");
    expect(p.bankIban).toBe("CH9300762011623852957");
    // saving again without secrets keeps them (form never receives them)
    await savePaymentSettings(payments({ stripeEnabled: true, stripePublishableKey: "pk_test_1", bankIban: p.bankIban, bankTransferEnabled: true }), actor);
    p = await getSettings("payments");
    expect(p.stripeSecretKey).toBe("sk_test_secret");
    // removing a secret that an enabled method needs is refused
    expect(await fieldErrors(savePaymentSettings(payments({ stripeEnabled: true, stripePublishableKey: "pk_test_1", bankIban: p.bankIban }), actor, ["stripeSecretKey"]))).toHaveProperty("stripeSecretKey");
    await savePaymentSettings(payments({ bankIban: p.bankIban }), actor, ["stripeSecretKey", "stripeWebhookSecret"]);
    p = await getSettings("payments");
    expect(p.stripeSecretKey).toBe("");
    expect(p.stripeWebhookSecret).toBe("");
  });

  it("reports readiness per method", async () => {
    await db.delete(shippingZones);
    await saveSettings("general", { companyName: "", street: "", zip: "", city: "" });
    await savePaymentSettings(payments({ invoiceEnabled: true, pickupPaymentEnabled: true, bankIban: "CH9300762011623852957" }), actor);
    const r = Object.fromEntries((await paymentReadiness()).map((x) => [x.key, x]));
    expect(r.invoice.enabled).toBe(true);
    expect(r.invoice.problems.join(" ")).toMatch(/Absenderadresse/);
    expect(r.pickup.problems.join(" ")).toMatch(/Abholung/);
    expect(r.bank_transfer.enabled).toBe(false);
    await saveSettings("general", { companyName: "Muster AG", street: "Bahnhofstrasse 1", zip: "8001", city: "Zürich" });
    const [zone] = await db.insert(shippingZones).values({ name: "CH", countries: ["CH"] }).returning();
    await db.insert(shippingMethods).values({ zoneId: zone.id, name: "Abholung", type: "pickup" });
    const r2 = Object.fromEntries((await paymentReadiness()).map((x) => [x.key, x]));
    expect(r2.invoice.problems).toEqual([]);
    expect(r2.pickup.problems).toEqual([]);
  });
});
