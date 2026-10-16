/**
 * Invoice (Rechnung) with Swiss QR-bill, payable within `invoiceDueDays`.
 * The order waits ("on_hold", unpaid) until staff marks it paid.
 *
 * The QR reference is derived from the order number: QRR (27 digits) when
 * the configured account is a QR-IBAN, otherwise an ISO 11649 "RF" creditor
 * reference – both let the bank statement be matched to the order.
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { orders } from "@/server/db/schema";
import { date, money } from "@/lib/format";
import { getSettings } from "@/server/settings";
import { orderLabel, type OrderRow } from "@/server/shop/order-core";
import { buildQrPayload, formatIban, formatReference, isChLiIban, isQrIban, makeQrReference, makeScorReference, qrBillSvg, splitStreet, validateQrBill, type QrBillData, type QrReferenceType } from "./qr-bill";
import type { PaymentInstructions, PaymentProvider, PaymentsSettings } from "./types";
import { invoiceUrl } from "./urls";

/** Payment reference for an order (used by invoice and bank transfer). */
export function paymentReferenceFor(order: Pick<OrderRow, "number">, iban: string): { type: QrReferenceType; reference: string; display: string } {
  if (isQrIban(iban)) {
    const reference = makeQrReference(order.number);
    return { type: "QRR", reference, display: formatReference("QRR", reference) };
  }
  const reference = makeScorReference(String(order.number));
  return { type: "SCOR", reference, display: formatReference("SCOR", reference) };
}

export function invoiceDueDate(order: Pick<OrderRow, "createdAt">, dueDays: number) {
  return new Date(order.createdAt.getTime() + dueDays * 86_400_000);
}

/** Creditor address from the general settings (account holder overrides the name). */
export async function creditorAddress() {
  const [g, p] = await Promise.all([getSettings("general"), getSettings("payments")]);
  const { street, buildingNumber } = splitStreet(g.street);
  return {
    name: p.bankAccountHolder || g.companyName || g.siteName,
    street,
    buildingNumber,
    postalCode: g.zip,
    town: g.city,
    country: (g.country || "CH").toUpperCase(),
  };
}

const yymmdd = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" }).slice(2).replace(/-/g, "");

export type InvoiceQr = { data: QrBillData; payload: string; svg: string; errors: string[]; referenceDisplay: string; ibanDisplay: string };

/**
 * QR-bill of an order for the open amount (total − refunds). Returns the
 * problems instead of a code when the account or address is incomplete.
 */
export async function invoiceQrBill(order: OrderRow): Promise<InvoiceQr> {
  const p = await getSettings("payments");
  const iban = p.bankIban;
  const label = await orderLabel(order);
  const creditor = await creditorAddress();
  const billing = order.billingAddress;
  const debtorStreet = splitStreet(billing.street);
  const open = Math.max(0, order.total - order.refundedTotal);
  const ref = isChLiIban(iban) ? paymentReferenceFor(order, iban) : { type: "NON" as const, reference: "", display: "" };
  const data: QrBillData = {
    account: iban,
    creditor,
    amount: open > 0 ? open : null,
    currency: order.currency === "EUR" ? "EUR" : "CHF",
    debtor: {
      name: [billing.company, [billing.firstName, billing.lastName].filter(Boolean).join(" ")].filter(Boolean).join(", ") || order.email,
      street: debtorStreet.street,
      buildingNumber: debtorStreet.buildingNumber,
      postalCode: billing.zip,
      town: billing.city,
      country: billing.country,
    },
    referenceType: ref.type,
    reference: ref.reference,
    message: `Bestellung ${label}`,
    billInfo: `//S1/10/${label.replace(/[/\\]/g, "-")}/11/${yymmdd(order.createdAt)}`,
  };
  const errors = iban ? validateQrBill(data) : ["Keine IBAN hinterlegt (Shop-Einstellungen → Zahlungsarten)."];
  const payload = errors.length ? "" : buildQrPayload(data);
  return {
    data,
    payload,
    svg: payload ? qrBillSvg(payload, { title: "QR-Code für die Zahlung" }) : "",
    errors,
    referenceDisplay: ref.display,
    ibanDisplay: iban ? formatIban(iban) : "",
  };
}

async function instructions(order: OrderRow, s: PaymentsSettings): Promise<PaymentInstructions> {
  const label = await orderLabel(order);
  const due = invoiceDueDate(order, s.invoiceDueDays);
  const ref = isChLiIban(s.bankIban) ? paymentReferenceFor(order, s.bankIban) : null;
  return {
    title: "Zahlung auf Rechnung",
    text: `Sie erhalten die Ware mit Rechnung. Bitte bezahlen Sie ${money(order.total)} bis am ${date(due)} mit dem QR-Einzahlungsschein der Rechnung.`,
    rows: [
      ["Rechnung", label],
      ["Betrag", money(order.total)],
      ["Zahlbar bis", date(due)],
      ...(ref ? ([["Referenz", ref.display]] as [string, string][]) : []),
    ],
    invoiceUrl: invoiceUrl(order),
  };
}

export const invoiceProvider: PaymentProvider = {
  key: "invoice",
  label: "Rechnung",
  description: "Bezahlung nach Erhalt mit QR-Rechnung.",
  online: false,
  initial: { status: "on_hold", paymentStatus: "unpaid" },
  isAvailable(s, ctx) {
    if (!s.invoiceEnabled) return false;
    if (s.invoiceOnlyForCustomers && !ctx.hasAccount) return false;
    return true;
  },
  async start(order, _items, s) {
    if (isChLiIban(s.bankIban)) {
      const ref = paymentReferenceFor(order, s.bankIban);
      await db.update(orders).set({ paymentReference: ref.reference }).where(eq(orders.id, order.id));
    }
    return { type: "instructions", instructions: await instructions(order, s) };
  },
  instructions,
};
