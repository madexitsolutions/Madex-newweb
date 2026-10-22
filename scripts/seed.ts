/**
 * Demo data for trying out the dashboard: company data, shop with products and
 * orders, posts, pages and inquiries. Run with the dev server stopped:
 *   npm run db:seed
 * Running it twice adds nothing new where data already exists.
 */
import { count } from "drizzle-orm";
import { getDb } from "../src/server/db";
import { bootstrap } from "../src/server/db/bootstrap";
import { runMigrations } from "../src/server/db/migrate";
import { inquiries, orders, posts, products } from "../src/server/db/schema";
import { saveSettings } from "../src/server/settings";

const COLORS = ["#025159", "#028d86", "#c47f2c", "#5b6c8f", "#8c3b4a", "#3f7d4e", "#6b5b95", "#2f6f8f"];

function svg(label: string, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><rect width="1200" height="1200" fill="${color}"/><circle cx="900" cy="300" r="380" fill="#ffffff" opacity="0.08"/><circle cx="250" cy="1000" r="300" fill="#000000" opacity="0.08"/><text x="600" y="640" font-family="Arial, sans-serif" font-size="96" font-weight="700" fill="#ffffff" text-anchor="middle">${label}</text></svg>`;
}

async function main() {
  try {
    await runMigrations();
  } catch {
    /* development database synced by db:push */
  }
  const db = getDb();
  await bootstrap(db);
  const { saveUpload } = await import("../src/server/media/store");
  const { saveCategory } = await import("../src/server/shop/categories");
  const { saveProduct } = await import("../src/server/shop/catalog");
  const { createCart, addToCart } = await import("../src/server/shop/cart");
  const { placeOrder } = await import("../src/server/shop/checkout");
  const { markPaid, fulfilOrder } = await import("../src/server/shop/orders");
  const { savePost } = await import("../src/server/content/posts");
  const { createInquiry } = await import("../src/server/content/inquiries");

  await saveSettings("general", { siteName: "Muster AG", companyName: "Muster AG", street: "Bahnhofstrasse 12", zip: "8400", city: "Winterthur", email: "info@muster-ag.ch", phone: "+41 52 000 00 00", vatNumber: "CHE-123.456.789 MWST" });
  await saveSettings("modules", { shop: true, storefront: true, blog: true, inquiries: true, seo: true });
  await saveSettings("payments", { bankTransferEnabled: true, bankAccountHolder: "Muster AG", bankIban: "CH93 0076 2011 6238 5295 7", bankName: "Muster Bank", invoiceEnabled: true, pickupPaymentEnabled: true });
  await saveSettings("shop", { termsUrl: "/agb", privacyUrl: "/datenschutz" });

  const [{ n: productCount }] = await db.select({ n: count() }).from(products);
  if (productCount === 0) {
    const image = async (label: string, color: string) => (await saveUpload(new File([svg(label, color)], `${label.toLowerCase().replace(/\W+/g, "-")}.svg`, { type: "image/svg+xml" }), { folder: "demo", alt: label })).id;
    const cat = async (name: string, sort: number) => (await saveCategory(null, { name, sort }, null)).id;
    const kleider = await cat("Kleider", 1);
    const zuhause = await cat("Zuhause", 2);
    const geschenke = await cat("Geschenke", 3);

    const demo: { name: string; cats: string[]; price: number; compareAt?: number; featured?: boolean; short: string; sizes?: string[]; stock?: number }[] = [
      { name: "Bio-T-Shirt Classic", cats: [kleider], price: 3490, featured: true, short: "Weiches T-Shirt aus Bio-Baumwolle, fair produziert.", sizes: ["S", "M", "L", "XL"] },
      { name: "Kapuzenpullover", cats: [kleider], price: 7900, compareAt: 8900, short: "Warmer Hoodie mit Känguru-Tasche.", sizes: ["S", "M", "L"] },
      { name: "Wollmütze", cats: [kleider, geschenke], price: 2900, short: "Gestrickt aus Schweizer Schafwolle.", stock: 4 },
      { name: "Keramiktasse", cats: [zuhause, geschenke], price: 2400, featured: true, short: "Handgemacht, spülmaschinenfest, 300 ml." },
      { name: "Leinen-Geschirrtuch", cats: [zuhause], price: 1590, short: "Saugstark und langlebig, 2er-Set." },
      { name: "Duftkerze Arve", cats: [zuhause, geschenke], price: 3200, short: "Mit echtem Arvenöl aus Graubünden." },
      { name: "Geschenkkarte", cats: [geschenke], price: 5000, short: "Freude schenken – einlösbar im ganzen Shop." },
      { name: "Notizbuch A5", cats: [geschenke], price: 1890, short: "Punktraster, 160 Seiten, Fadenbindung.", stock: 0 },
    ];
    for (const [i, d] of demo.entries()) {
      const img = await image(d.name, COLORS[i % COLORS.length]);
      await saveProduct(
        null,
        {
          name: d.name,
          status: "active",
          shortDescription: d.short,
          description: `<p>${d.short}</p><p>Ein Demo-Produkt der Vorlage. Bearbeiten oder löschen Sie es unter Produkte.</p>`,
          featured: d.featured ?? false,
          categoryIds: d.cats,
          images: [{ mediaId: img, alt: d.name }],
          options: d.sizes ? [{ name: "Grösse", values: d.sizes }] : [],
          variants: d.sizes ? d.sizes.map((s) => ({ optionValues: [s], price: d.price, compareAtPrice: d.compareAt ?? null, stock: 20, sku: `DEMO-${i + 1}-${s}` })) : [{ price: d.price, compareAtPrice: d.compareAt ?? null, stock: d.stock ?? 25, sku: `DEMO-${i + 1}` }],
        },
        null,
      );
    }
    console.log(`[seed] ${demo.length} Produkte in 3 Kategorien angelegt.`);
  }

  const [{ n: orderCount }] = await db.select({ n: count() }).from(orders);
  if (orderCount === 0) {
    // a few orders through the real checkout
    const { productVariants, shippingMethods } = await import("../src/server/db/schema");
    const [ship] = await db.select({ id: shippingMethods.id }).from(shippingMethods).limit(1);
    const variants = await db.select({ id: productVariants.id, stock: productVariants.stock }).from(productVariants);
    const buyable = variants.filter((v) => v.stock > 0);
    const people = [
      ["Anna", "Meier", "anna.meier@example.ch", "Seestrasse 4", "8002", "Zürich"],
      ["Luca", "Rossi", "luca.rossi@example.ch", "Via Nassa 18", "6900", "Lugano"],
      ["Sarah", "Keller", "sarah.keller@example.ch", "Marktgasse 9", "3011", "Bern"],
      ["Marco", "Frei", "marco.frei@example.ch", "Rheinweg 21", "4058", "Basel"],
      ["Julia", "Brunner", "julia.brunner@example.ch", "Bahnhofplatz 2", "9000", "St. Gallen"],
    ];
    for (const [i, p] of people.entries()) {
      const { token } = await createCart();
      await addToCart(token, buyable[(i * 3) % buyable.length].id, 1 + (i % 2));
      await addToCart(token, buyable[(i * 5 + 2) % buyable.length].id, 1);
      const res = await placeOrder(token, { email: p[2], billingAddress: { firstName: p[0], lastName: p[1], street: p[3], zip: p[4], city: p[5], country: "CH" }, shippingMethodId: ship?.id, paymentMethod: i % 2 ? "invoice" : "bank_transfer", acceptTerms: true }, { source: "storefront" });
      if (i < 3) await markPaid(res.order.id, null, { reference: `DEMO-${i + 1}` });
      if (i < 2) await fulfilOrder(res.order.id, null, { carrier: "post", trackingNumber: `99.00.${100000 + i}.12345678`, notify: false });
    }
    console.log(`[seed] ${people.length} Bestellungen angelegt.`);
  }

  const [{ n: postCount }] = await db.select({ n: count() }).from(posts);
  if (postCount === 0) {
    const items = [
      ["Unser neuer Online-Shop ist da", "Ab sofort können Sie unsere Produkte bequem online bestellen – mit Lieferung in die ganze Schweiz."],
      ["Betriebsferien über Weihnachten", "Vom 24. Dezember bis 2. Januar bleibt unser Laden geschlossen. Online-Bestellungen versenden wir ab dem 3. Januar."],
      ["Drei Tipps für nachhaltiges Schenken", "Gute Geschenke müssen nicht viel kosten. Wir zeigen, worauf es ankommt."],
    ];
    for (const [i, [title, excerpt]] of items.entries()) await savePost(null, { title, excerpt, body: `<p>${excerpt}</p><p>Ein Demo-Beitrag der Vorlage.</p>`, status: "published", publishedAt: new Date(Date.now() - (i + 1) * 5 * 86_400_000), category: "News" });
    console.log("[seed] 3 Beiträge angelegt.");
  }

  const [{ n: inquiryCount }] = await db.select({ n: count() }).from(inquiries);
  if (inquiryCount === 0) {
    const asks = [
      ["Petra Huber", "petra.huber@example.ch", "Guten Tag, liefern Sie auch nach Deutschland? Freundliche Grüsse"],
      ["Thomas Graf", "thomas.graf@example.ch", "Wir möchten 40 Tassen mit unserem Logo bestellen. Ist das möglich?"],
    ];
    for (const [name, email, message] of asks) await createInquiry({ form: "kontakt", name, email, message, sourceUrl: "/kontakt", startedAt: Date.now() - 120_000 }, { ip: "127.0.0.1" });
    console.log("[seed] 2 Anfragen angelegt.");
  }
  console.log("[seed] Fertig.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
