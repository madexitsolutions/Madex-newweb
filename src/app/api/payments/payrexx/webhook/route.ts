/** Payrexx webhook (unsigned – the transaction is re-read from the Payrexx API). */
import { handlePayrexxWebhook } from "@/server/payments/payrexx";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handlePayrexxWebhook(req);
}
