import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { categories, customerAddresses, customers, orders, products, productVariants, stockMovements } from "@/server/db/schema";
import { variantCombinations, generateCouponCode } from "@/lib/catalog";
import { ibanError, isValidIban, formatIban } from "@/lib/iban";
import { parseCsv, toCsv } from "@/server/lib/csv";
import { deleteProducts, duplicateProduct, getProduct, listProducts, priceRange, saveProduct, setProductsStatus, uniqueProductSlug, validateProduct } from "@/server/shop/catalog";
import { buildTree, deleteCategory, ensureCategoryPath, saveCategory, wouldCreateCycle } from "@/server/shop/categories";
import { couponStatus, saveCoupon, validateCouponInput } from "@/server/shop/coupons";
import { anonymiseCustomer, deleteCustomer, exportCustomerData, saveCustomer } from "@/server/shop/customers";
import { InputError } from "@/server/shop/errors";
import { deleteImportFile, exportProductsCsv, parsePrice, planImport, readImportFile, readImportResult, runImport, splitList, storeImportFile, storeImportResult } from "@/server/shop/import-export";
import { deleteTaxClass, saveTaxClass, setDefaultTaxClass } from "@/server/shop/tax-admin";
import { saveMethod, saveZone } from "@/server/shop/shipping-admin";
import { taxClasses } from "@/server/db/schema";

const actor = null;

const simple = (name: string, price = 1990, extra: Record<string, unknown> = {}) => ({ name, status: "active" as const, variants: [{ price, stock: 5, sku: null }], ...extra });

describe("Produkte", () => {
  it("erzeugt Variantenkombinationen", () => {
    expect(variantCombinations([])).toEqual([[]]);
    const combos = variantCombinations([
      { name: "Grösse", values: ["S", "M", "L"] },
      { name: "Farbe", values: ["Rot", "Blau"] },
    ]);
    expect(combos).toHaveLength(6);
    expect(combos[0]).toEqual(["S", "Rot"]);
    expect(combos[5]).toEqual(["L", "Blau"]);
  });

  it("vergibt eindeutige Adressen (Slugs)", async () => {
    const a = await saveProduct(null, simple("Kaffee Tasse"), actor);
    const b = await saveProduct(null, simple("Kaffee Tasse"), actor);
    expect(a.slug).toBe("kaffee-tasse");
    expect(b.slug).toBe("kaffee-tasse-2");
    expect(await uniqueProductSlug("Kaffee Tasse")).toBe("kaffee-tasse-3");
    await expect(saveProduct(null, simple("Andere", 100, { slug: "kaffee-tasse" }), actor)).rejects.toBeInstanceOf(InputError);
  });

  it("speichert Varianten, hält die Preisspanne und das Lager aktuell", async () => {
    const options = [
      { name: "Grösse", values: ["S", "M"] },
      { name: "Farbe", values: ["Rot", "Blau"] },
    ];
    const variants = variantCombinations(options).map((ov, i) => ({ optionValues: ov, price: 2000 + i * 500, stock: 10, sku: `TS-${i}` }));
    const p = await saveProduct(null, { name: "T-Shirt", status: "active", options, variants }, actor);
    expect(p.priceMin).toBe(2000);
    expect(p.priceMax).toBe(3500);
    const full = (await getProduct(p.id))!;
    expect(full.variants.map((v) => v.title)).toEqual(["S / Rot", "S / Blau", "M / Rot", "M / Blau"]);
    // movements were recorded for the initial stock
    const mv = await db.select().from(stockMovements).where(eq(stockMovements.variantId, full.variants[0].id));
    expect(mv[0].delta).toBe(10);

    // deactivate the most expensive variant, change stock relative to what the editor loaded
    const edited = full.variants.map((v, i) => ({ ...v, stockOriginal: v.stock, stock: i === 0 ? 7 : v.stock, active: i !== 3 }));
    // meanwhile an order took 2 pieces of the first variant
    await db.update(productVariants).set({ stock: 8 }).where(eq(productVariants.id, full.variants[0].id));
    const saved = await saveProduct(p.id, { name: "T-Shirt", status: "active", options, variants: edited }, actor);
    expect(saved.priceMax).toBe(3000);
    const [first] = await db.select().from(productVariants).where(eq(productVariants.id, full.variants[0].id));
    expect(first.stock).toBe(5); // 8 + (7 − 10)

    // removing an option value removes its variants
    const fewer = { name: "T-Shirt", options: [{ name: "Grösse", values: ["S", "M"] }, { name: "Farbe", values: ["Rot"] }], variants: edited.filter((v) => v.optionValues[1] === "Rot") };
    await saveProduct(p.id, fewer, actor);
    expect((await getProduct(p.id))!.variants).toHaveLength(2);
  });

  it("prüft Varianten und Vergleichspreise", () => {
    expect(() => validateProduct({ name: "X", variants: [{ price: 100 }, { price: 200 }] })).toThrow(InputError);
    expect(() => validateProduct({ name: "X", variants: [{ price: 100, compareAtPrice: 90 }] })).toThrow(/Vergleichspreis/);
    expect(() =>
      validateProduct({
        name: "X",
        options: [{ name: "Grösse", values: ["S"] }],
        variants: [
          { optionValues: ["S"], price: 1 },
          { optionValues: ["s"], price: 1 },
        ],
      }),
    ).toThrow(/zweimal/);
    expect(priceRange([{ price: 5, active: false }])).toEqual({ priceMin: 5, priceMax: 5 });
  });

  it("verhindert doppelte Artikelnummern im Shop", async () => {
    await saveProduct(null, { name: "A", variants: [{ price: 100, sku: "DUP-1" }] }, actor);
    await expect(saveProduct(null, { name: "B", variants: [{ price: 100, sku: "DUP-1" }] }, actor)).rejects.toThrow(/DUP-1/);
  });

  it("dupliziert, ändert Status und löscht", async () => {
    const p = await saveProduct(null, { name: "Original", status: "active", variants: [{ price: 500, sku: "ORIG", stock: 3 }] }, actor);
    const copy = await duplicateProduct(p.id, actor);
    expect(copy.status).toBe("draft");
    expect(copy.name).toBe("Original (Kopie)");
    const cv = (await getProduct(copy.id))!.variants[0];
    expect(cv.sku).toBeNull();
    expect(cv.stock).toBe(0);
    expect(await setProductsStatus([copy.id], "archived", actor)).toBe(1);
    const list = await listProducts({ status: "archived" });
    expect(list.rows.some((r) => r.id === copy.id)).toBe(true);
    expect(await deleteProducts([copy.id], actor)).toBe(1);
    expect(await getProduct(copy.id)).toBeNull();
  });
});

describe("Kategorien", () => {
  it("verhindert Zyklen", async () => {
    const a = await saveCategory(null, { name: "Kleidung" }, actor);
    const b = await saveCategory(null, { name: "Shirts", parentId: a.id }, actor);
    const c = await saveCategory(null, { name: "Kurzarm", parentId: b.id }, actor);
    const all = await db.select().from(categories);
    expect(wouldCreateCycle(all, a.id, c.id)).toBe(true);
    expect(wouldCreateCycle(all, a.id, a.id)).toBe(true);
    expect(wouldCreateCycle(all, c.id, a.id)).toBe(false);
    await expect(saveCategory(a.id, { name: "Kleidung", parentId: c.id }, actor)).rejects.toThrow(/unter sich selbst/);
    const tree = buildTree(all);
    expect(tree.find((t) => t.id === c.id)?.path).toEqual(["Kleidung", "Shirts", "Kurzarm"]);
    // deleting the middle moves the child up
    await deleteCategory(b.id, actor);
    const [kurz] = await db.select().from(categories).where(eq(categories.id, c.id));
    expect(kurz.parentId).toBe(a.id);
    // path creation reuses existing categories
    const leaf = await ensureCategoryPath(["kleidung", "Kurzarm"]);
    expect(leaf).toBe(c.id);
  });
});

describe("Gutscheine", () => {
  it("prüft Felder", () => {
    expect(validateCouponInput({ code: " sommer 10 ", type: "percent", value: 1000 }).code).toBe("SOMMER10");
    expect(() => validateCouponInput({ code: "AB", type: "percent", value: 1000 })).toThrow(/mindestens 3/);
    expect(() => validateCouponInput({ code: "GRÜN", type: "percent", value: 1000 })).toThrow(/Buchstaben/);
    expect(() => validateCouponInput({ code: "X100", type: "percent", value: 12_000 })).toThrow(/100 %/);
    expect(() => validateCouponInput({ code: "FIX", type: "fixed", value: 0 })).toThrow();
    expect(() => validateCouponInput({ code: "LIM", type: "fixed", value: 500, usageLimit: 1, usageLimitPerCustomer: 2 })).toThrow(/Pro Kunde/);
    expect(() => validateCouponInput({ code: "DATE", type: "fixed", value: 500, startsAt: new Date("2026-02-01"), endsAt: new Date("2026-01-01") })).toThrow(/Ende/);
    expect(validateCouponInput({ code: "SHIP", type: "free_shipping", value: 999 }).value).toBe(0);
  });

  it("erzeugt Codes und erkennt den Status", async () => {
    const code = generateCouponCode(8, "Sommer");
    expect(code).toMatch(/^SOMMER-[A-Z2-9]{8}$/);
    await saveCoupon(null, { code: "WELCOME", type: "fixed", value: 1000 }, actor);
    await expect(saveCoupon(null, { code: "welcome", type: "fixed", value: 1000 }, actor)).rejects.toThrow(/bereits/);
    const now = new Date("2026-06-01");
    expect(couponStatus({ active: true, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0 }, now)).toBe("active");
    expect(couponStatus({ active: true, startsAt: new Date("2026-07-01"), endsAt: null, usageLimit: null, usedCount: 0 }, now)).toBe("scheduled");
    expect(couponStatus({ active: true, startsAt: null, endsAt: new Date("2026-05-01"), usageLimit: null, usedCount: 0 }, now)).toBe("expired");
    expect(couponStatus({ active: true, startsAt: null, endsAt: null, usageLimit: 5, usedCount: 5 }, now)).toBe("used_up");
    expect(couponStatus({ active: false, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0 }, now)).toBe("inactive");
  });
});

describe("IBAN", () => {
  it("prüft mod 97 und Länge", () => {
    expect(isValidIban("CH93 0076 2011 6238 5295 7")).toBe(true);
    expect(isValidIban("LI21 0881 0000 2324 013A A")).toBe(true);
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(ibanError("CH93 0076 2011 6238 5295 8")).toMatch(/Prüfziffer/);
    expect(ibanError("CH93 0076 2011 6238 5295")).toMatch(/21 Zeichen/);
    expect(ibanError("CH44 3199 9123 0008 8901 2")).toMatch(/QR-IBAN/);
    expect(formatIban("ch9300762011623852957")).toBe("CH93 0076 2011 6238 5295 7");
  });
});

describe("Steuern und Versand", () => {
  it("hat genau eine Standard-Steuerklasse", async () => {
    const t = await saveTaxClass(null, { name: "Test 5 %", rateBp: 500, isDefault: true }, actor);
    let defaults = (await db.select().from(taxClasses)).filter((x) => x.isDefault);
    expect(defaults.map((d) => d.id)).toEqual([t.id]);
    await expect(deleteTaxClass(t.id, actor)).rejects.toThrow(/Standard/);
    const normal = (await db.select().from(taxClasses)).find((x) => x.name === "Normalsatz")!;
    await setDefaultTaxClass(normal.id, actor);
    defaults = (await db.select().from(taxClasses)).filter((x) => x.isDefault);
    expect(defaults.map((d) => d.id)).toEqual([normal.id]);
    await deleteTaxClass(t.id, actor);
  });

  it("prüft Zonen und Gewichtsstufen", async () => {
    await expect(saveZone(null, { name: "Doppelt", countries: ["CH"] }, actor)).rejects.toThrow(/bereits in der Zone/);
    const z = await saveZone(null, { name: "EU", countries: ["de", "AT"] }, actor);
    expect(z.countries).toEqual(["DE", "AT"]);
    await expect(saveMethod(null, { zoneId: z.id, name: "Paket", type: "weight", weightRates: [{ upToGrams: 2000, price: 1500 }, { upToGrams: 1000, price: 900 }] }, actor)).rejects.toThrow(/aufsteigend/);
    const m = await saveMethod(null, { zoneId: z.id, name: "Paket", type: "weight", weightRates: [{ upToGrams: 1000, price: 900 }, { upToGrams: 5000, price: 1500 }] }, actor);
    expect(m.weightRates).toHaveLength(2);
  });
});

describe("CSV", () => {
  it("liest und schreibt Anführungszeichen, Zeilenumbrüche und Semikolon", () => {
    const csv = toCsv([["a", 'b "c"', "d\ne"], ["1", "2;3", ""]]);
    expect(parseCsv(csv)).toEqual([["a", 'b "c"', "d\ne"], ["1", "2;3", ""]]);
    expect(parseCsv("x;y\n1;2\n")).toEqual([["x", "y"], ["1", "2"]]);
    expect(toCsv([["=SUMME(A1)"]], { excel: true })).toBe("'=SUMME(A1)\r\n");
    expect(splitList("Kleidung > Shirts, Zubehör\\, Diverses")).toEqual(["Kleidung > Shirts", "Zubehör, Diverses"]);
    expect(parsePrice("1'234.50")).toBe(123450);
    expect(parsePrice("19,90")).toBe(1990);
    expect(Number.isNaN(parsePrice("abc"))).toBe(true);
  });
});

const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000a49444154789c6300010000050001" + "0d0a2db40000000049454e44ae426082", "hex");

const WOO = `ID,Type,SKU,Name,Published,"Is featured?","Short description",Description,"Tax class","In stock?",Stock,"Backorders allowed?","Weight (kg)","Sale price","Regular price",Categories,Tags,Images,Parent,Position,"Attribute 1 name","Attribute 1 value(s)","Attribute 1 visible","Attribute 1 global","Attribute 2 name","Attribute 2 value(s)","Attribute 2 visible","Attribute 2 global"
101,variable,HOODIE,"Hoodie Bergsee",1,1,"Warmer Hoodie aus Bio-Baumwolle","Weich und warm.\\n\\nIn der Schweiz gestaltet.",,1,,0,0.6,,,"Kleidung > Pullover, Neuheiten","bio, winter","https://img.example.ch/hoodie.png, https://img.example.ch/hoodie-back.png",,0,Grösse,"S, M, L",1,1,Farbe,"Blau, Grau",1,1
102,variation,HOODIE-S-BLAU,"Hoodie Bergsee - S, Blau",1,0,,,parent,1,4,0,,59.00,79.00,,,https://img.example.ch/hoodie-blau.png,id:101,1,Grösse,S,,1,Farbe,Blau,,1
103,variation,HOODIE-M-BLAU,"Hoodie Bergsee - M, Blau",1,0,,,parent,1,0,1,0.65,,79.00,,,,id:101,2,Grösse,M,,1,Farbe,Blau,,1
104,variation,HOODIE-L-GRAU,"Hoodie Bergsee - L, Grau",1,0,,,parent,1,2,0,,,85.00,,,,id:101,3,Grösse,L,,1,Farbe,Grau,,1
105,simple,MUG-1,"Tasse «Zürich»",0,0,,"<p>Spülmaschinenfest</p>",reduced-rate,1,12,0,0.35,,"24,50",Küche,,https://img.example.ch/broken.png,,0,,,,,,,,
106,simple,,"Ohne Preis",1,0,,,,1,,0,,,,,,,,0,,,,,,,,
107,variation,ORPHAN,"Waise",1,0,,,,1,1,0,,,10,,,,id:999,1,Grösse,S,,1,,,,
108,grouped,SET,"Set",1,0,,,,1,,0,,,,,,,,0,,,,,,,,
`;

describe("Import und Export", () => {
  it("plant einen WooCommerce-Import als Probelauf mit Fehlern pro Zeile", async () => {
    const plan = await planImport(WOO);
    expect(plan.format).toBe("woocommerce");
    const hoodie = plan.products.find((p) => p.name === "Hoodie Bergsee")!;
    expect(hoodie.action).toBe("create");
    expect(hoodie.input.options).toEqual([
      { name: "Grösse", values: ["S", "M", "L"] },
      { name: "Farbe", values: ["Blau", "Grau"] },
    ]);
    expect(hoodie.input.variants).toHaveLength(3);
    const s = hoodie.input.variants[0];
    expect(s.price).toBe(5900);
    expect(s.compareAtPrice).toBe(7900);
    expect(s.weightGrams).toBe(600); // from the parent
    expect(hoodie.input.variants[1].allowBackorder).toBe(true);
    expect(hoodie.categoryPaths).toEqual([["Kleidung", "Pullover"], ["Neuheiten"]]);
    expect(hoodie.input.description).toContain("<p>Weich und warm.</p>");
    const noPrice = plan.products.find((p) => p.name === "Ohne Preis")!;
    expect(noPrice.action).toBe("skip");
    expect(noPrice.errors.join()).toMatch(/Preis fehlt/);
    expect(plan.issues.some((i) => i.message.includes("id:999"))).toBe(true);
    expect(plan.issues.some((i) => i.message.includes("gruppiertes"))).toBe(true);
    expect(plan.summary.create).toBe(2);
    // nothing was written
    expect((await db.select().from(products).where(eq(products.name, "Hoodie Bergsee"))).length).toBe(0);
  });

  it("importiert WooCommerce-Produkte mit Bildern, Kategorien und Lager", async () => {
    const fetcher = async (url: string) => (url.includes("broken") ? new Response("nope", { status: 404 }) : new Response(PNG, { headers: { "content-type": "image/png" } }));
    const res = await runImport(WOO, actor, { fetcher });
    expect(res.created).toBe(2);
    expect(res.skipped).toBe(1);
    expect(res.warnings.some((w) => w.includes("broken.png"))).toBe(true);
    const [hoodie] = await db.select().from(products).where(eq(products.name, "Hoodie Bergsee"));
    expect(hoodie.status).toBe("active");
    expect(hoodie.featured).toBe(true);
    expect(hoodie.priceMin).toBe(5900);
    expect(hoodie.priceMax).toBe(8500);
    const full = (await getProduct(hoodie.id))!;
    expect(full.images.length).toBe(3); // 2 product images + 1 variant image
    expect(full.variants[0].imageId).not.toBeNull();
    const mv = await db.select().from(stockMovements).where(eq(stockMovements.variantId, full.variants[0].id));
    expect(mv[0].reason).toBe("import");
    const [mug] = await db.select().from(products).where(eq(products.name, "Tasse «Zürich»"));
    expect(mug.status).toBe("draft");
    expect(mug.priceMin).toBe(2450);
    const reduced = (await db.select().from(taxClasses)).find((t) => t.rateBp === 260)!;
    expect(mug.taxClassId).toBe(reduced.id);

    // importing again updates instead of duplicating, stock is set absolutely
    const again = WOO.replace("HOODIE-S-BLAU,\"Hoodie Bergsee - S, Blau\",1,0,,,parent,1,4", "HOODIE-S-BLAU,\"Hoodie Bergsee - S, Blau\",1,0,,,parent,1,9");
    const res2 = await runImport(again, actor, { fetcher });
    expect(res2.created).toBe(0);
    expect(res2.updated).toBe(2);
    const v = (await getProduct(hoodie.id))!.variants.find((x) => x.sku === "HOODIE-S-BLAU")!;
    expect(v.stock).toBe(9);
  });

  it("exportiert im eigenen Format und liest es wieder ein", async () => {
    const csv = await exportProductsCsv();
    expect(csv).toContain("handle,name,status");
    expect(csv).toContain("HOODIE-M-BLAU");
    const plan = await planImport(csv);
    expect(plan.format).toBe("predashboard");
    const hoodie = plan.products.find((p) => p.key === "hoodie-bergsee")!;
    expect(hoodie.action).toBe("update");
    expect(hoodie.errors).toEqual([]);
    const created = await planImport("handle,name,price,stock,option1_name,option1_value\nneu-produkt,Neues Produkt,12.50,3,Farbe,Rot\nneu-produkt,,13.00,1,Farbe,Grün\n");
    expect(created.products[0].action).toBe("create");
    expect(created.products[0].input.variants).toHaveLength(2);
  });
});

describe("Kunden", () => {
  it("exportiert Daten und anonymisiert samt Bestellungen", async () => {
    const c = await saveCustomer(
      null,
      { email: "Heidi.Muster@example.ch", firstName: "Heidi", lastName: "Muster", phone: "+41 79 000 00 00", acceptsMarketing: true, defaultAddress: { firstName: "Heidi", lastName: "Muster", street: "Bahnhofstrasse 1", zip: "8001", city: "Zürich", country: "ch" } },
      actor,
    );
    expect(c.email).toBe("heidi.muster@example.ch");
    const addr = { firstName: "Heidi", lastName: "Muster", street: "Bahnhofstrasse 1", zip: "8001", city: "Zürich", country: "CH" };
    await db.insert(orders).values({ number: 5001, accessToken: "t", customerId: c.id, email: c.email, phone: "+41 79", subtotal: 5000, total: 5000, billingAddress: addr, shippingAddress: addr, ip: "1.2.3.4", customerNote: "Bitte klingeln" });
    const data = (await exportCustomerData(c.id))!;
    expect(data.orders).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain("passwordHash");

    await expect(deleteCustomer(c.id, actor)).rejects.toThrow(/Anonymisieren/);
    await anonymiseCustomer(c.id, actor);
    const [after] = await db.select().from(customers).where(eq(customers.id, c.id));
    expect(after.email).not.toContain("heidi");
    expect(after.firstName).toBe("Anonymisiert");
    expect(after.acceptsMarketing).toBe(false);
    expect(await db.select().from(customerAddresses).where(eq(customerAddresses.customerId, c.id))).toHaveLength(0);
    const [o] = await db.select().from(orders).where(eq(orders.number, 5001));
    expect(o.email).toBe(after.email);
    expect(o.billingAddress.street).toBe("");
    expect(o.billingAddress.country).toBe("CH");
    expect(o.ip).toBe("");
    expect(o.total).toBe(5000);

    const guest = await saveCustomer(null, { email: "gast@example.ch" }, actor);
    expect(await deleteCustomer(guest.id, actor)).toBe(true);
  });
});

describe("import temp files", () => {
  it("keeps the upload and the result per token and rejects bad tokens", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const prev = process.env.DATA_DIR;
    process.env.DATA_DIR = await mkdtemp(join(tmpdir(), "import-"));
    try {
      const token = await storeImportFile("handle,name\n");
      expect(await readImportFile(token)).toBe("handle,name\n");
      expect(await readImportFile("../../etc/passwd")).toBeNull();
      const result = { created: 2, updated: 1, skipped: 0, images: 0, warnings: ["w"], errors: [] };
      await storeImportResult(token, result);
      await deleteImportFile(token);
      expect(await readImportFile(token)).toBeNull();
      expect(await readImportResult(token)).toEqual(result);
      expect(await readImportResult("nope")).toBeNull();
    } finally {
      if (prev === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = prev;
    }
  });
});
