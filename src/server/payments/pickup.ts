/** Cash (or card at the counter) on pickup – only offered with a pickup shipping method. */
import { money } from "@/lib/format";
import type { PaymentInstructions, PaymentProvider } from "./types";

async function instructions(order: { total: number }): Promise<PaymentInstructions> {
  return {
    title: "Bezahlung bei Abholung",
    text: `Sie bezahlen ${money(order.total)} bei der Abholung. Wir melden uns, sobald die Bestellung bereitliegt.`,
    rows: [["Betrag", money(order.total)]],
  };
}

export const pickupProvider: PaymentProvider = {
  key: "pickup",
  label: "Barzahlung bei Abholung",
  description: "Bezahlung vor Ort bei der Abholung.",
  online: false,
  initial: { status: "processing", paymentStatus: "unpaid" },
  isAvailable: (s, ctx) => s.pickupPaymentEnabled && ctx.shippingMethodType === "pickup",
  async start(order) {
    return { type: "instructions", instructions: await instructions(order) };
  },
  instructions: (order) => instructions(order),
};
