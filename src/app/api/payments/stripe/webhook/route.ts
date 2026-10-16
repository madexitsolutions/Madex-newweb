/** Stripe webhook (signature verified with payments.stripeWebhookSecret). */
import { handleStripeWebhook } from "@/server/payments/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleStripeWebhook(req);
}
