import { describe, expect, it } from "vitest";
import { money } from "@/lib/format";
import { distribute, priceCart, shippingOptions, validateCoupon, zoneForCountry, type CouponInput, type PricingLineInput, type ShippingMethodInput, type ShippingZoneInput } from "@/server/shop/pricing";

const zones: ShippingZoneInput[] = [
  { id: "z-ch", name: "Schweiz & Liechtenstein", countries: ["CH", "LI"], sort: 0 },
  { id: "z-eu", name: "EU", countries: ["DE", "AT", "FR"], sort: 1 },
  { id: "z-world", name: "Welt", countries: ["*"], sort: 2 },
];
const methods: ShippingMethodInput[] = [
  { id: "m-eco", zoneId: "z-ch", name: "Economy", type: "flat", price: 900, freeAbove: 10000, sort: 0 },
  { id: "m-prio", zoneId: "z-ch", name: "Priority", type: "flat", price: 1200, sort: 1 },
  { id: "m-pick", zoneId: "z-ch", name: "Abholung", type: "pickup", price: 0, sort: 2 },
  { id: "m-big", zoneId: "z-ch", name: "Spedition", type: "flat", price: 4900, minSubtotal: 50000, sort: 3 },
  { id: "m-off", zoneId: "z-ch", name: "Inaktiv", type: "flat", price: 100, active: false, sort: 4 },
  {
    id: "m-eu",
    zoneId: "z-eu",
    name: "Post EU",
    type: "weight",
    price: 0,
    weightRates: [
      { upToGrams: 2000, price: 1900 },
      { upToGrams: 500, price: 1500 },
      { upToGrams: 10000, price: 3500 },
    ],
    sort: 0,
  },
  { id: "m-world", zoneId: "z-world", name: "Welt", type: "flat", price: 4500, sort: 0 },
];

const line = (over: Partial<PricingLineInput> & { key: string }): PricingLineInput => ({ productId: `p-${over.key}`, unitPrice: 1000, quantity: 1, taxRateBp: 810, ...over });

describe("distribute", () => {
  it("verteilt exakt und proportional", () => {
    expect(distribute(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(distribute(10, [0, 5, 5])).toEqual([0, 5, 5]);
    expect(distribute(7, [0, 0])).toEqual([4, 3]);
    expect(distribute(999, [333, 333, 334]).reduce((a, b) => a + b)).toBe(999);
    expect(distribute(-10, [1, 3])).toEqual([-3, -7]);
  });
});

describe("Preise inkl. MWST", () => {
  it("rechnet Zwischensumme, Versand und herausgerechnete MWST", () => {
    const r = priceCart({ lines: [line({ key: "a", unitPrice: 2990, quantity: 2 })], pricesIncludeTax: true, country: "CH", shippingMethodId: "m-eco", zones, methods });
    expect(r.subtotal).toBe(5980);
    expect(r.shippingTotal).toBe(900);
    expect(r.total).toBe(6880);
    // VAT on goods + shipping together (shipping follows the goods' rate)
    expect(r.taxTotal).toBe(516);
    expect(r.taxes).toEqual([{ rateBp: 810, net: 6880 - 516, tax: 516, gross: 6880 }]);
    expect(r.lines[0].tax + r.shipping.tax).toBe(516);
    expect(r.itemCount).toBe(2);
  });

  it("rundet die MWST pro Satz und nicht pro Zeile", () => {
    const r = priceCart({ lines: ["a", "b", "c"].map((k) => line({ key: k, unitPrice: 995 })), pricesIncludeTax: true });
    // per line it would be 3 × 75 = 225; on the rate total 2985 it is 223.67 → 224
    expect(r.taxTotal).toBe(224);
    expect(r.lines.reduce((a, l) => a + l.tax, 0)).toBe(224);
  });

  it("verteilt den Versand bei gemischten Sätzen anteilig", () => {
    const r = priceCart({
      lines: [line({ key: "std", unitPrice: 5000 }), line({ key: "food", unitPrice: 3000, taxRateBp: 260 })],
      pricesIncludeTax: true,
      country: "CH",
      shippingMethodId: "m-prio",
      zones,
      methods: methods.map((m) => (m.id === "m-prio" ? { ...m, price: 800 } : m)),
    });
    expect(r.total).toBe(8800);
    const std = r.taxes.find((t) => t.rateBp === 810)!;
    const red = r.taxes.find((t) => t.rateBp === 260)!;
    expect(std.gross).toBe(5500);
    expect(red.gross).toBe(3300);
    expect(std.tax).toBe(412);
    expect(red.tax).toBe(84);
    expect(r.taxTotal).toBe(496);
    expect(r.shipping.tax + r.lines.reduce((a, l) => a + l.tax, 0)).toBe(496);
  });

  it("versteuert den Versand mit eigener Steuerklasse zu deren Satz", () => {
    const r = priceCart({
      lines: [line({ key: "food", unitPrice: 3000, taxRateBp: 260 })],
      pricesIncludeTax: true,
      country: "CH",
      shippingMethodId: "m-prio",
      zones,
      methods: methods.map((m) => (m.id === "m-prio" ? { ...m, taxRateBp: 810 } : m)),
    });
    expect(r.taxes.map((t) => [t.rateBp, t.gross])).toEqual([
      [810, 1200],
      [260, 3000],
    ]);
  });
});

describe("Preise exkl. MWST", () => {
  it("rechnet die MWST dazu", () => {
    const r = priceCart({ lines: [line({ key: "a", unitPrice: 10000 })], pricesIncludeTax: false });
    expect(r.taxTotal).toBe(810);
    expect(r.total).toBe(10810);
    expect(r.taxes[0]).toEqual({ rateBp: 810, net: 10000, tax: 810, gross: 10810 });
  });

  it("rechnet MWST auf Versand und Rabatt korrekt", () => {
    const r = priceCart({ lines: [line({ key: "a", unitPrice: 5000, quantity: 2 })], pricesIncludeTax: false, coupon: { code: "x", type: "fixed", value: 1000 }, country: "CH", shippingMethodId: "m-eco", zones, methods });
    // goods 9000 net (below free-above 10000) + shipping 900 → 9900 net, VAT 801.9 → 802
    expect(r.discountTotal).toBe(1000);
    expect(r.shippingTotal).toBe(900);
    expect(r.taxTotal).toBe(802);
    expect(r.total).toBe(9900 + 802);
  });
});

describe("Gutscheine", () => {
  const base = [line({ key: "shirt", productId: "p-shirt", categoryIds: ["c-kleider"], unitPrice: 4000 }), line({ key: "mug", productId: "p-mug", categoryIds: ["c-kueche"], unitPrice: 6000 })];

  it("Prozent auf alles, anteilig verteilt", () => {
    const r = priceCart({ lines: base, pricesIncludeTax: true, coupon: { code: "zehn", type: "percent", value: 1000 } });
    expect(r.coupon).toMatchObject({ code: "ZEHN", valid: true, discount: 1000 });
    expect(r.lines.map((l) => l.discount)).toEqual([400, 600]);
    expect(r.total).toBe(9000);
    expect(r.taxTotal).toBe(Math.round((9000 * 810) / 10810));
  });

  it("Prozent nur auf eine Kategorie", () => {
    const r = priceCart({ lines: base, pricesIncludeTax: true, coupon: { code: "KLEIDER", type: "percent", value: 2500, categoryIds: ["c-kleider"] } });
    expect(r.lines.map((l) => l.discount)).toEqual([1000, 0]);
    expect(r.discountTotal).toBe(1000);
  });

  it("Prozent nur auf bestimmte Produkte", () => {
    const r = priceCart({ lines: base, pricesIncludeTax: true, coupon: { code: "MUG", type: "percent", value: 5000, productIds: ["p-mug"] } });
    expect(r.lines.map((l) => l.discount)).toEqual([0, 3000]);
  });

  it("Fixbetrag höchstens bis zum berechtigten Wert", () => {
    const r = priceCart({ lines: base, pricesIncludeTax: true, coupon: { code: "F", type: "fixed", value: 5000, categoryIds: ["c-kleider"] } });
    expect(r.discountTotal).toBe(4000);
    expect(r.lines[0].total).toBe(0);
    expect(r.total).toBe(6000);
  });

  it("Fixbetrag mit Rundung über mehrere Zeilen", () => {
    const r = priceCart({ lines: ["a", "b", "c"].map((k) => line({ key: k, unitPrice: 1000 })), pricesIncludeTax: true, coupon: { code: "F", type: "fixed", value: 1000 } });
    expect(r.lines.map((l) => l.discount)).toEqual([334, 333, 333]);
    expect(r.total).toBe(2000);
  });

  it("Gratisversand", () => {
    const r = priceCart({ lines: [line({ key: "a", unitPrice: 2000 })], pricesIncludeTax: true, coupon: { code: "SHIP", type: "free_shipping", value: 0 }, country: "CH", shippingMethodId: "m-prio", zones, methods });
    expect(r.coupon?.freeShipping).toBe(true);
    expect(r.shipping.selected).toMatchObject({ price: 0, basePrice: 1200, free: true });
    expect(r.total).toBe(2000);
  });

  it("ungültiger Gutschein: Fehler, kein Rabatt", () => {
    const r = priceCart({ lines: base, pricesIncludeTax: true, coupon: { code: "ALT", type: "percent", value: 1000, endsAt: new Date("2020-01-01") } });
    expect(r.coupon).toMatchObject({ valid: false, discount: 0, error: "Dieser Gutschein ist abgelaufen." });
    expect(r.total).toBe(10000);
  });

  const now = new Date("2026-10-16T10:00:00Z");
  const c = (over: Partial<CouponInput>): CouponInput => ({ code: "X", type: "percent", value: 1000, ...over });
  const ctx = { subtotal: 3000, lines: [{ productId: "p1", categoryIds: ["c1"] }], now };

  it("prüft Gültigkeit, Limiten und Mindestbestellwert mit klaren Meldungen", () => {
    expect(validateCoupon(c({}), ctx)).toBeNull();
    expect(validateCoupon(null, ctx)).toBe("Dieser Gutscheincode ist ungültig.");
    expect(validateCoupon(c({ active: false }), ctx)).toBe("Dieser Gutscheincode ist ungültig.");
    expect(validateCoupon(c({ startsAt: new Date("2026-11-01T00:00:00Z") }), ctx)).toMatch(/^Dieser Gutschein ist erst ab .*2026 gültig\.$/);
    expect(validateCoupon(c({ endsAt: new Date("2026-10-01") }), ctx)).toBe("Dieser Gutschein ist abgelaufen.");
    expect(validateCoupon(c({ usageLimit: 5, usedCount: 5 }), ctx)).toBe("Dieser Gutschein wurde bereits so oft eingelöst wie möglich.");
    expect(validateCoupon(c({ usageLimit: 5, usedCount: 4 }), ctx)).toBeNull();
    expect(validateCoupon(c({ usageLimitPerCustomer: 1 }), { ...ctx, customerUses: 1 })).toBe("Sie haben diesen Gutschein bereits eingelöst.");
    expect(validateCoupon(c({ usageLimitPerCustomer: 2 }), { ...ctx, customerUses: 2 })).toBe("Sie haben diesen Gutschein bereits 2-mal eingelöst.");
    expect(validateCoupon(c({ minSubtotal: 5000 }), ctx)).toBe(`Dieser Gutschein gilt ab einem Bestellwert von ${money(5000)}. Es fehlen noch ${money(2000)}.`);
    expect(validateCoupon(c({ categoryIds: ["c9"] }), ctx)).toBe("Dieser Gutschein gilt nicht für die Produkte in Ihrem Warenkorb.");
    expect(validateCoupon(c({ productIds: ["p1"] }), ctx)).toBeNull();
  });
});

describe("Versand", () => {
  it("findet die Zone pro Land, sonst «Rest der Welt»", () => {
    expect(zoneForCountry(zones, "li")?.id).toBe("z-ch");
    expect(zoneForCountry(zones, "DE")?.id).toBe("z-eu");
    expect(zoneForCountry(zones, "US")?.id).toBe("z-world");
    expect(zoneForCountry(zones.slice(0, 2), "US")).toBeNull();
    expect(zoneForCountry(zones, null)).toBeNull();
  });

  it("bietet aktive Methoden der Zone an, mit Gratis-ab und Mindestbestellwert", () => {
    const low = shippingOptions({ zones, methods, country: "CH", goodsTotal: 5000, weightGrams: 0 });
    expect(low.options.map((o) => [o.id, o.price])).toEqual([
      ["m-eco", 900],
      ["m-prio", 1200],
      ["m-pick", 0],
    ]);
    const high = shippingOptions({ zones, methods, country: "CH", goodsTotal: 60000, weightGrams: 0 });
    expect(high.options.find((o) => o.id === "m-eco")).toMatchObject({ price: 0, free: true, basePrice: 900 });
    expect(high.options.find((o) => o.id === "m-big")?.price).toBe(4900);
  });

  it("Gratis-ab vergleicht mit dem Wert nach Rabatt", () => {
    const r = priceCart({ lines: [line({ key: "a", unitPrice: 10500 })], pricesIncludeTax: true, coupon: { code: "F", type: "fixed", value: 1000 }, country: "CH", shippingMethodId: "m-eco", zones, methods });
    expect(r.shippingTotal).toBe(900);
    expect(r.total).toBe(9500 + 900);
  });

  it("Gewichtstabellen (unsortiert erfasst) und zu schwere Sendungen", () => {
    const p = (g: number) => shippingOptions({ zones, methods, country: "DE", goodsTotal: 1000, weightGrams: g }).options;
    expect(p(400)[0].price).toBe(1500);
    expect(p(500)[0].price).toBe(1500);
    expect(p(501)[0].price).toBe(1900);
    expect(p(9000)[0].price).toBe(3500);
    expect(p(12000)).toEqual([]);
    const r = priceCart({ lines: [line({ key: "a", weightGrams: 700, quantity: 2 })], pricesIncludeTax: true, country: "AT", shippingMethodId: "m-eu", zones, methods });
    expect(r.weightGrams).toBe(1400);
    expect(r.shippingTotal).toBe(1900);
  });

  it("meldet nicht lieferbare Länder und ungültige Methoden", () => {
    expect(priceCart({ lines: [line({ key: "a" })], pricesIncludeTax: true, country: "US", zones: zones.slice(0, 2), methods }).shipping.error).toBe("Für dieses Land ist leider keine Lieferung möglich.");
    const r = priceCart({ lines: [line({ key: "a" })], pricesIncludeTax: true, country: "DE", shippingMethodId: "m-eco", zones, methods });
    expect(r.shipping.selected).toBeNull();
    expect(r.shipping.error).toMatch(/nicht verfügbar/);
    expect(r.shippingTotal).toBe(0);
  });

  it("digitale Produkte brauchen keinen Versand", () => {
    const r = priceCart({ lines: [line({ key: "ebook", requiresShipping: false, weightGrams: 100 })], pricesIncludeTax: true, country: "CH", shippingMethodId: "m-eco", zones, methods });
    expect(r.requiresShipping).toBe(false);
    expect(r.shipping.methods).toEqual([]);
    expect(r.total).toBe(1000);
  });

  it("leerer Warenkorb", () => {
    const r = priceCart({ lines: [], pricesIncludeTax: true });
    expect(r.total).toBe(0);
    expect(r.taxes).toEqual([]);
  });
});
