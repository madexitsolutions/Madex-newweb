import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { carts, coupons, customers, notifications, orderEvents, orderItems, orders, payments, stockMovements } from "@/server/db/schema";
import { addToCart, applyCoupon, createCart, getCart, mergeCustomerCart, updateCartItem } from "@/server/shop/cart";
import { placeOrder, restoreCartFromOrder, retryPayment } from "@/server/shop/checkout";
import { ShopError } from "@/server/shop/errors";
import { setStripeFactory } from "@/server/payments/stripe";
import { saveSettings } from "@/server/settings";
import { address, cartWith, checkoutInput, enablePayments, makeProduct, shippingMethodId, stockOf } from "./helpers/shop";

let eco: string;
let pickup: string;

beforeAll(async () => {
  await enablePayments();
  eco = await shippingMethodId("PostPac Economy");
  pickup = await shippingMethodId("Abholung");
});

async function expectShopError(p: Promise<unknown>, code: string) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(ShopError);
  expect((e as ShopError).code).toBe(code);
  return e as ShopError;
}

describe("Warenkorb", () => {
  it("legt an, fügt hinzu, prüft Lager und rechnet", async () => {
    const a = await makeProduct({ price: 2500, stock: 3 });
    const { token, cart } = await createCart();
    expect(cart.items).toEqual([]);
    await addToCart(token, a.variantId, 2);
    const e = await expectShopError(addToCart(token, a.variantId, 2), "out_of_stock");
    expect(e.message).toMatch(/nur noch 3 Stück/);
    const view = await updateCartItem(token, a.variantId, 3);
    expect(view.items[0]).toMatchObject({ quantity: 3, maxQuantity: 3, unitPrice: 2500, subtotal: 7500, available: true, problem: null });
    expect(view.pricing.subtotal).toBe(7500);
    // first shipping method is used as estimate
    expect(view.shippingEstimated).toBe(true);
    expect(view.pricing.shippingTotal).toBe(900);
    expect(view.pricing.total).toBe(8400);
    expect((await updateCartItem(token, a.variantId, 0)).items).toEqual([]);
  });

  it("speichert nur den Hash des Tokens", async () => {
    const { token } = await createCart();
    expect(await db.select().from(carts).where(eq(carts.id, token))).toEqual([]);
    expect(await getCart(token)).not.toBeNull();
    expect(await getCart("x".repeat(30))).toBeNull();
  });

  it("nimmt nicht verfügbare Produkte nicht an und markiert Lagerprobleme", async () => {
    const draft = await makeProduct({ status: "draft" });
    const { token } = await createCart();
    await expectShopError(addToCart(token, draft.variantId, 1), "unavailable");
    const p = await makeProduct({ stock: 5 });
    await addToCart(token, p.variantId, 4);
    const { productVariants } = await import("@/server/db/schema");
    await db.update(productVariants).set({ stock: 2 }).where(eq(productVariants.id, p.variantId));
    const view = (await getCart(token))!;
    expect(view.checkoutReady).toBe(false);
    expect(view.items[0].problem).toMatch(/Nur noch 2 Stück/);
  });

  it("Gutschein anwenden mit verständlicher Fehlermeldung", async () => {
    await db.insert(coupons).values([
      { code: "ZEHN", type: "percent", value: 1000 },
      { code: "AB100", type: "fixed", value: 1000, minSubtotal: 10000 },
    ]);
    const p = await makeProduct({ price: 5000 });
    const token = await cartWith([[p.variantId, 1]]);
    await expectShopError(applyCoupon(token, "GIBTSNICHT"), "coupon_invalid");
    const e = await expectShopError(applyCoupon(token, "ab100"), "coupon_invalid");
    expect(e.message).toMatch(/ab einem Bestellwert/);
    const view = await applyCoupon(token, "zehn");
    expect(view.couponCode).toBe("ZEHN");
    expect(view.pricing.discountTotal).toBe(500);
  });

  it("führt den Gast-Warenkorb mit dem Kundenkonto zusammen", async () => {
    const [c] = await db.insert(customers).values({ email: "merge@example.ch" }).returning();
    const a = await makeProduct({ stock: 5 });
    const b = await makeProduct();
    const { token: old } = await createCart({ customerId: c.id });
    await addToCart(old, a.variantId, 3);
    await addToCart(old, b.variantId, 1);
    const guest = await cartWith([[a.variantId, 4]]);
    const merged = await mergeCustomerCart(guest, c.id);
    expect(merged.customerId).toBe(c.id);
    expect(merged.items.find((i) => i.variantId === a.variantId)?.quantity).toBe(5); // capped at stock
    expect(merged.items.find((i) => i.variantId === b.variantId)?.quantity).toBe(1);
    expect(await getCart(old)).toBeNull();
  });
});

describe("Kasse", () => {
  it("erstellt die Bestellung, bucht Lager ab und legt den Kunden an", async () => {
    const a = await makeProduct({ name: "Tasse", price: 2990, stock: 10 });
    const token = await cartWith([[a.variantId, 2]]);
    const res = await placeOrder(token, checkoutInput({ shippingMethodId: eco, customerNote: "Bitte klingeln", acceptsMarketing: true }), { ip: "1.2.3.4" });
    expect(res.existing).toBe(false);
    expect(res.order).toMatchObject({ status: "on_hold", paymentStatus: "unpaid", paymentMethod: "bank_transfer", total: 5980 + 900 });
    expect(res.payment.type).toBe("instructions");
    if (res.payment.type === "instructions") {
      expect(res.payment.instructions.rows.find(([k]) => k === "IBAN")?.[1]).toBe("CH58 0079 1123 0008 8901 2");
      expect(res.payment.instructions.rows.find(([k]) => k === "Referenz")?.[1]).toMatch(/^RF\d{2} /);
    }
    const [o] = await db.select().from(orders).where(eq(orders.id, res.order.id));
    expect(o.number).toBe(1000);
    expect(o.taxTotal).toBe(Math.round((6880 * 810) / 10810));
    expect(o.shippingMethodName).toBe("PostPac Economy");
    expect(o.shippingAddress).toEqual(address);
    expect(o.customerNote).toBe("Bitte klingeln");
    expect(o.paymentReference).toMatch(/^RF/);
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: "Tasse", sku: expect.stringMatching(/^SKU-/), unitPrice: 2990, quantity: 2, total: 5980, taxRateBp: 810 });
    expect(await stockOf(a.variantId)).toBe(8);
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.variantId, a.variantId));
    expect(moves).toMatchObject([{ delta: -2, reason: "order", reference: "#1000" }]);
    const [c] = await db.select().from(customers).where(eq(customers.id, o.customerId!));
    expect(c).toMatchObject({ email: "anna@example.ch", firstName: "Anna", acceptsMarketing: true, ordersCount: 1, totalSpent: 0 });
    expect(await getCart(token)).toBeNull();
    const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, o.id));
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["created", "status", "email"]));
    const notes = await db.select().from(notifications).where(eq(notifications.type, "order.created"));
    expect(notes.some((n) => n.href === `/madexadm/bestellungen/${o.id}`)).toBe(true);
  });

  it("Doppelklick: ein Warenkorb ergibt genau eine Bestellung", async () => {
    const a = await makeProduct({ stock: 10 });
    const token = await cartWith([[a.variantId, 1]]);
    const [r1, r2] = await Promise.all([placeOrder(token, checkoutInput({ shippingMethodId: eco })), placeOrder(token, checkoutInput({ shippingMethodId: eco }))]);
    expect(r1.order.id).toBe(r2.order.id);
    expect([r1.existing, r2.existing].sort()).toEqual([false, true]);
    const r3 = await placeOrder(token, checkoutInput({ shippingMethodId: eco }));
    expect(r3).toMatchObject({ existing: true, order: { id: r1.order.id } });
    expect(r3.payment.type).toBe("instructions");
    expect(await stockOf(a.variantId)).toBe(9);
  });

  it("Idempotency-Key verhindert eine zweite Bestellung", async () => {
    const a = await makeProduct();
    const r1 = await placeOrder(await cartWith([[a.variantId, 1]]), checkoutInput({ shippingMethodId: eco, idempotencyKey: "key-123" }));
    const r2 = await placeOrder(await cartWith([[a.variantId, 1]]), checkoutInput({ shippingMethodId: eco, idempotencyKey: "key-123" }));
    expect(r2).toMatchObject({ existing: true, order: { id: r1.order.id } });
  });

  it("bricht bei zu wenig Lager ab, ohne etwas zu verändern", async () => {
    const a = await makeProduct({ stock: 2 });
    const token = await cartWith([[a.variantId, 2]]);
    const { productVariants } = await import("@/server/db/schema");
    await db.update(productVariants).set({ stock: 1 }).where(eq(productVariants.id, a.variantId));
    const before = (await db.select().from(orders)).length;
    const e = await expectShopError(placeOrder(token, checkoutInput({ shippingMethodId: eco })), "out_of_stock");
    expect(e.message).toMatch(/nur noch 1 Stück/);
    expect((await db.select().from(orders)).length).toBe(before);
    expect(await stockOf(a.variantId)).toBe(1);
    expect(await getCart(token)).not.toBeNull();
  });

  it("Nachbestellung erlaubt und Artikel ohne Lagerführung", async () => {
    const back = await makeProduct({ stock: 0, backorder: true });
    const free = await makeProduct({ stock: 0, track: false });
    const res = await placeOrder(
      await cartWith([
        [back.variantId, 2],
        [free.variantId, 1],
      ]),
      checkoutInput({ shippingMethodId: eco }),
    );
    expect(res.existing).toBe(false);
    expect(await stockOf(back.variantId)).toBe(-2);
    expect(await stockOf(free.variantId)).toBe(0);
  });

  it("prüft Eingaben, AGB, Versandart, Land und Zahlungsart", async () => {
    const a = await makeProduct();
    const token = await cartWith([[a.variantId, 1]]);
    const v = await expectShopError(placeOrder(token, checkoutInput({ billingAddress: { ...address, zip: "800" }, shippingMethodId: eco })), "validation");
    expect(v.details?.fieldErrors).toMatchObject({ "billingAddress.zip": "Die PLZ besteht aus 4 Ziffern." });
    await expectShopError(placeOrder(token, checkoutInput({ email: "kein-mail", shippingMethodId: eco })), "validation");
    await expectShopError(placeOrder(token, checkoutInput({ acceptTerms: false, shippingMethodId: eco })), "validation");
    await expectShopError(placeOrder(token, checkoutInput()), "shipping_unavailable");
    await expectShopError(placeOrder(token, checkoutInput({ billingAddress: { ...address, country: "DE", zip: "10115" }, shippingMethodId: eco })), "shipping_unavailable");
    // cash only with pickup
    await expectShopError(placeOrder(token, checkoutInput({ paymentMethod: "pickup", shippingMethodId: eco })), "payment_unavailable");
    await expectShopError(placeOrder(token, checkoutInput({ paymentMethod: "stripe", shippingMethodId: eco })), "payment_unavailable");
    const ok = await placeOrder(token, checkoutInput({ paymentMethod: "pickup", shippingMethodId: pickup }));
    expect(ok.order).toMatchObject({ status: "processing", paymentStatus: "unpaid", total: 2990 });
  });

  it("stoppt bei geändertem Gesamtbetrag", async () => {
    const a = await makeProduct({ price: 1000 });
    const token = await cartWith([[a.variantId, 1]]);
    const e = await expectShopError(placeOrder(token, checkoutInput({ shippingMethodId: eco, expectedTotal: 1000 })), "price_changed");
    expect(e.details?.total).toBe(1900);
    expect((await placeOrder(token, checkoutInput({ shippingMethodId: eco, expectedTotal: 1900 }))).order.total).toBe(1900);
  });

  it("zählt Gutscheine und setzt das Limit pro Kunde durch", async () => {
    await db.insert(coupons).values({ code: "EINMAL", type: "fixed", value: 500, usageLimitPerCustomer: 1 });
    const a = await makeProduct({ price: 3000 });
    const t1 = await cartWith([[a.variantId, 1]]);
    await applyCoupon(t1, "EINMAL");
    const r = await placeOrder(t1, checkoutInput({ email: "coupon@example.ch", shippingMethodId: eco }));
    expect(r.order.total).toBe(2500 + 900);
    const [c] = await db.select().from(coupons).where(eq(coupons.code, "EINMAL"));
    expect(c.usedCount).toBe(1);
    const t2 = await cartWith([[a.variantId, 1]]);
    await applyCoupon(t2, "EINMAL"); // cart has no e-mail yet
    const e = await expectShopError(placeOrder(t2, checkoutInput({ email: "COUPON@example.ch", shippingMethodId: eco })), "coupon_invalid");
    expect(e.message).toBe("Sie haben diesen Gutschein bereits eingelöst.");
  });

  it("meldet niedrigen Lagerbestand", async () => {
    const a = await makeProduct({ name: "Knappes Teil", stock: 4 });
    await placeOrder(await cartWith([[a.variantId, 2]]), checkoutInput({ shippingMethodId: eco }));
    const rows = await db.select().from(notifications).where(eq(notifications.type, "stock.low"));
    expect(rows.some((r) => r.title.includes("Knappes Teil"))).toBe(true);
  });

  it("Gastbestellung kann abgeschaltet werden", async () => {
    await saveSettings("shop", { guestCheckout: false });
    const a = await makeProduct();
    await expectShopError(placeOrder(await cartWith([[a.variantId, 1]]), checkoutInput({ shippingMethodId: eco })), "forbidden");
    await saveSettings("shop", { guestCheckout: true });
  });

  it("Online-Zahlung: Weiterleitung, Bestellung wartet, Warenkorb wiederherstellbar", async () => {
    await saveSettings("payments", { stripeEnabled: true, stripeSecretKey: "sk_test_x" });
    let calls = 0;
    setStripeFactory(
      () =>
        ({
          checkout: {
            sessions: {
              create: async (params: { metadata: { orderId: string }; success_url: string }) => {
                calls++;
                expect(params.success_url).toContain(`/bestellung/${params.metadata.orderId}?token=`);
                return { id: `cs_test_${calls}`, url: `https://checkout.stripe.com/c/pay/cs_test_${calls}` };
              },
            },
          },
        }) as never,
    );
    const a = await makeProduct({ stock: 5 });
    const token = await cartWith([[a.variantId, 2]]);
    const res = await placeOrder(token, checkoutInput({ paymentMethod: "stripe", shippingMethodId: eco }));
    expect(res.payment).toEqual({ type: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_1", providerRef: "cs_test_1" });
    expect(res.order).toMatchObject({ status: "pending", paymentStatus: "pending" });
    const pays = await db.select().from(payments).where(eq(payments.orderId, res.order.id));
    expect(pays).toMatchObject([{ provider: "stripe", providerRef: "cs_test_1", status: "pending", kind: "charge" }]);
    // no confirmation before the payment arrives
    const mails = await db
      .select()
      .from(orderEvents)
      .where(and(eq(orderEvents.orderId, res.order.id), eq(orderEvents.type, "email")));
    expect(mails).toEqual([]);
    // double submit returns the pending redirect again
    expect((await placeOrder(token, checkoutInput({ paymentMethod: "stripe", shippingMethodId: eco }))).payment).toMatchObject({ type: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    // pay again creates a new session
    expect(await retryPayment(res.order.id, res.order.accessToken)).toMatchObject({ type: "redirect", providerRef: "cs_test_2" });
    await expectShopError(retryPayment(res.order.id, "falsch"), "not_found");
    // back to the cart
    expect(await stockOf(a.variantId)).toBe(3);
    const restored = await restoreCartFromOrder(res.order.id, res.order.accessToken);
    expect(restored.cart.items.map((i) => [i.variantId, i.quantity])).toEqual([[a.variantId, 2]]);
    expect(await stockOf(a.variantId)).toBe(5);
    const [o] = await db.select().from(orders).where(eq(orders.id, res.order.id));
    expect(o.status).toBe("failed");
  });

  it("Zahlungsanbieter nicht erreichbar: Bestellung bleibt, Fehler wird gemeldet", async () => {
    setStripeFactory(() => ({ checkout: { sessions: { create: async () => Promise.reject(new Error("Netzwerkfehler")) } } }) as never);
    const a = await makeProduct();
    const res = await placeOrder(await cartWith([[a.variantId, 1]]), checkoutInput({ paymentMethod: "stripe", shippingMethodId: eco }));
    expect(res.payment.type).toBe("error");
    const ev = await db.select().from(orderEvents).where(eq(orderEvents.orderId, res.order.id));
    expect(ev.some((e) => e.message.includes("Netzwerkfehler"))).toBe(true);
  });
});
