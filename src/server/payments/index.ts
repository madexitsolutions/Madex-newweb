/**
 * Registry of the payment providers.
 *
 *   const methods = await availablePaymentMethods({ total, shippingMethodType, hasAccount });
 *   const provider = getProvider("stripe");
 */
import { getSettings } from "@/server/settings";
import { bankTransferProvider } from "./bank-transfer";
import { invoiceProvider } from "./invoice";
import { payrexxProvider } from "./payrexx";
import { pickupProvider } from "./pickup";
import { stripeProvider } from "./stripe";
import type { PaymentContext, PaymentProvider } from "./types";

export type { PaymentContext, PaymentInstructions, PaymentProvider, PaymentStart, ReturnUrls } from "./types";

/** In display order. */
export const PROVIDERS: PaymentProvider[] = [stripeProvider, payrexxProvider, invoiceProvider, bankTransferProvider, pickupProvider];

export function getProvider(key: string | null | undefined): PaymentProvider | null {
  return PROVIDERS.find((p) => p.key === key) ?? null;
}

export type PaymentMethodView = { key: string; label: string; description: string; online: boolean };

/** Methods the customer can choose for this cart/checkout. */
export async function availablePaymentMethods(ctx: PaymentContext): Promise<PaymentMethodView[]> {
  const s = await getSettings("payments");
  return PROVIDERS.filter((p) => p.isAvailable(s, ctx)).map((p) => ({ key: p.key, label: p.label, description: p.description, online: p.online }));
}

/** Payment instructions for the thank-you page / e-mail (null for online methods). */
export async function paymentInstructions(order: Parameters<NonNullable<PaymentProvider["instructions"]>>[0]) {
  const p = getProvider(order.paymentMethod);
  if (!p?.instructions) return null;
  return p.instructions(order, await getSettings("payments"));
}
