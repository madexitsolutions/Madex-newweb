/**
 * Prepayment by bank transfer (Vorauskasse): the order waits ("on_hold",
 * unpaid) until the money arrives and staff marks it paid. The reference
 * (QRR or RF, derived from the order number) and a QR-bill on the invoice
 * page make the transfer easy to match.
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { orders } from "@/server/db/schema";
import { money } from "@/lib/format";
import { orderLabel, type OrderRow } from "@/server/shop/order-core";
import { paymentReferenceFor } from "./invoice";
import { formatIban, isChLiIban } from "./qr-bill";
import type { PaymentInstructions, PaymentProvider, PaymentsSettings } from "./types";
import { invoiceUrl } from "./urls";

async function instructions(order: OrderRow, s: PaymentsSettings): Promise<PaymentInstructions> {
  const label = await orderLabel(order);
  const ref = isChLiIban(s.bankIban) ? paymentReferenceFor(order, s.bankIban) : null;
  const rows: [string, string][] = [
    ["Kontoinhaber", s.bankAccountHolder || "–"],
    ["IBAN", s.bankIban ? formatIban(s.bankIban) : "–"],
  ];
  if (s.bankName) rows.push(["Bank", s.bankName]);
  rows.push(["Betrag", money(order.total)]);
  rows.push(ref ? ["Referenz", ref.display] : ["Zahlungszweck", `Bestellung ${label}`]);
  return {
    title: "Zahlung per Vorauskasse",
    text: s.bankInstructions || `Bitte überweisen Sie ${money(order.total)} mit der Referenz unten. Wir versenden die Bestellung, sobald die Zahlung eingegangen ist.`,
    rows,
    invoiceUrl: isChLiIban(s.bankIban) ? invoiceUrl(order) : undefined,
  };
}

export const bankTransferProvider: PaymentProvider = {
  key: "bank_transfer",
  label: "Vorauskasse",
  description: "Überweisung vorab, Versand nach Zahlungseingang.",
  online: false,
  initial: { status: "on_hold", paymentStatus: "unpaid" },
  isAvailable: (s) => s.bankTransferEnabled && Boolean(s.bankIban),
  async start(order, _items, s) {
    if (isChLiIban(s.bankIban)) {
      const ref = paymentReferenceFor(order, s.bankIban);
      await db.update(orders).set({ paymentReference: ref.reference }).where(eq(orders.id, order.id));
    }
    return { type: "instructions", instructions: await instructions(order, s) };
  },
  instructions,
};
