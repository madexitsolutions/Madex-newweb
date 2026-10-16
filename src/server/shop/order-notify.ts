/**
 * "Announces" an order once: confirmation e-mail to the customer, notice to
 * the shop and an in-app notification for staff. Offline payment methods
 * announce at checkout, online methods (Stripe, Payrexx) when the payment
 * arrives – abandoned payment pages don't produce mails.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { orderEvents } from "@/server/db/schema";
import { sendNewOrderNotice, sendOrderConfirmation } from "@/server/mail/templates/orders";
import { addOrderEvent, loadOrder, notifyStaffNewOrder } from "./order-core";

export async function announceOrder(orderId: string) {
  const [done] = await db
    .select({ id: orderEvents.id })
    .from(orderEvents)
    .where(and(eq(orderEvents.orderId, orderId), sql`${orderEvents.data}->>'announced' = 'true'`))
    .limit(1);
  if (done) return false;
  const o = await loadOrder(orderId);
  if (!o) return false;
  await addOrderEvent(orderId, "status", "Bestellung bestätigt.", { internal: true, data: { announced: true } });
  await sendOrderConfirmation(orderId).catch((e) => console.error("[order] confirmation", e));
  await sendNewOrderNotice(orderId).catch((e) => console.error("[order] notice", e));
  await notifyStaffNewOrder(o);
  return true;
}
