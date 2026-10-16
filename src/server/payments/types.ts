/**
 * Payment provider contract. Providers are registered in ./index.ts.
 *
 * Flow: checkout creates the order (status/paymentStatus from `initial`) →
 * `start()` returns either a redirect to the provider's payment page or
 * instructions to show (bank details, invoice) → webhooks / staff mark the
 * order paid via markOrderPaid().
 */
import type { OrderStatus, PaymentStatus } from "@/lib/orders";
import type { OrderItemRow, OrderRow } from "@/server/shop/order-core";
import type { Settings } from "@/server/settings";

export type PaymentsSettings = Settings["payments"];

/** What decides whether a method is offered (cart/checkout state). */
export type PaymentContext = {
  total: number;
  country?: string | null;
  /** logged-in customer with an account (for "invoice only for customers") */
  hasAccount?: boolean;
  /** type of the chosen shipping method ("pickup" enables cash on pickup) */
  shippingMethodType?: string | null;
};

export type PaymentInstructions = {
  title: string;
  text: string;
  /** label/value rows (IBAN, reference, amount …) */
  rows: [string, string][];
  /** customer link to the invoice with QR-bill */
  invoiceUrl?: string;
};

export type ReturnUrls = { success: string; cancel: string };

export type PaymentStart =
  | { type: "redirect"; url: string; providerRef?: string }
  | { type: "instructions"; instructions: PaymentInstructions }
  | { type: "error"; message: string };

export type RefundResult = { providerRef: string | null; status: "succeeded" | "pending" };

export interface PaymentProvider {
  key: string;
  label: string;
  description: string;
  /** customer pays on an external page; confirmation e-mail is sent after the payment */
  online: boolean;
  /** state of a new order paid with this method */
  initial: { status: OrderStatus; paymentStatus: PaymentStatus };
  isAvailable(settings: PaymentsSettings, ctx: PaymentContext): boolean;
  /** Starts the payment for a freshly created order. */
  start(order: OrderRow, items: OrderItemRow[], settings: PaymentsSettings, urls: ReturnUrls): Promise<PaymentStart>;
  /** Text for the thank-you page and the confirmation e-mail. */
  instructions?(order: OrderRow, settings: PaymentsSettings): Promise<PaymentInstructions | null>;
  /** Webhook of the provider (route /api/payments/<key>/webhook). Must answer quickly and be idempotent. */
  handleWebhook?(req: Request): Promise<Response>;
  /** Refund through the provider (only when the order was paid there). */
  refund?(order: OrderRow, amount: number, reason: string, settings: PaymentsSettings): Promise<RefundResult>;
}
