/**
 * Order e-mails (customer and shop). Every send is logged in the order
 * timeline (type "email") and in email_log.
 */
import { date, money } from "@/lib/format";
import { addressLines, paymentMethodLabel } from "@/lib/orders";
import { getSettings } from "@/server/settings";
import { appUrl } from "@/server/lib/app-url";
import { paymentInstructions } from "@/server/payments";
import { orderStatusUrl } from "@/server/payments/urls";
import { addOrderEvent, loadOrder, loadOrderItems, orderLabel, type OrderItemRow, type OrderRow } from "@/server/shop/order-core";
import { sendMail } from "../mailer";
import { esc, type EmailContent } from "../template";

const td = "padding:8px 6px;border-bottom:1px solid #e6eceb;font-size:14px;color:#12262a;vertical-align:top";
const tdR = `${td};text-align:right;white-space:nowrap`;

/** Items and totals as an e-mail safe HTML table. */
export function orderTableHtml(o: OrderRow, items: Pick<OrderItemRow, "name" | "variantTitle" | "sku" | "quantity" | "unitPrice" | "total">[]) {
  const rows = items
    .map(
      (i) =>
        `<tr><td style="${td}">${esc(i.name)}${i.variantTitle ? `<br><span style="color:#5b6b6d;font-size:13px">${esc(i.variantTitle)}</span>` : ""}</td><td style="${tdR}">${i.quantity} ×</td><td style="${tdR}">${esc(money(i.unitPrice * i.quantity))}</td></tr>`,
    )
    .join("");
  const sum: [string, string, boolean?][] = [["Zwischensumme", money(o.subtotal)]];
  if (o.discountTotal) sum.push([`Rabatt${o.couponCode ? ` (${o.couponCode})` : ""}`, `– ${money(o.discountTotal)}`]);
  if (o.shippingMethodName || o.shippingTotal) sum.push([`Versand${o.shippingMethodName ? ` (${o.shippingMethodName})` : ""}`, o.shippingTotal ? money(o.shippingTotal) : "kostenlos"]);
  if (!o.pricesIncludeTax) sum.push(["MWST", money(o.taxTotal)]);
  sum.push(["Total", money(o.total), true]);
  if (o.pricesIncludeTax && o.taxTotal) sum.push(["darin enthaltene MWST", money(o.taxTotal)]);
  if (o.refundedTotal) sum.push(["Rückerstattet", `– ${money(o.refundedTotal)}`]);
  const sumRows = sum
    .map(([k, v, strong]) => `<tr><td colspan="2" style="padding:6px;font-size:14px;color:${strong ? "#12262a" : "#5b6b6d"};${strong ? "font-weight:bold;border-top:2px solid #12262a" : ""}">${esc(k)}</td><td style="padding:6px;font-size:14px;text-align:right;white-space:nowrap;${strong ? "font-weight:bold;border-top:2px solid #12262a" : ""}">${esc(v)}</td></tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 12px">${rows}${sumRows}</table>`;
}

async function logSend(o: OrderRow, kind: string, label: string, to: string, res: { ok: boolean; error?: string }) {
  await addOrderEvent(o.id, "email", res.ok ? `E-Mail «${label}» an ${to} gesendet.` : `E-Mail «${label}» an ${to} nicht gesendet: ${res.error ?? "unbekannter Fehler"}.`, { data: { kind, to, ok: res.ok } });
  return res;
}

async function sendToCustomer(o: OrderRow, kind: string, label: string, subject: string, content: EmailContent) {
  const res = await sendMail({ to: o.email, subject, template: `order.${kind}`, content, related: { type: "order", id: o.id } });
  return logSend(o, kind, label, o.email, res);
}

async function load(orderId: string) {
  const o = await loadOrder(orderId);
  if (!o) throw new Error("Bestellung nicht gefunden");
  return { o, items: await loadOrderItems(o.id), label: await orderLabel(o) };
}

/** Order confirmation with items, totals, VAT, addresses and payment instructions. */
export async function sendOrderConfirmation(orderId: string) {
  const { o, items, label } = await load(orderId);
  const general = await getSettings("general");
  const instr = await paymentInstructions(o);
  const paid = ["paid", "partially_refunded", "refunded"].includes(o.paymentStatus);
  const rows: [string, string][] = [
    ["Bestellnummer", label],
    ["Datum", date(o.createdAt)],
    ["Zahlungsart", paymentMethodLabel(o.paymentMethod) + (paid ? " (bezahlt)" : "")],
    ["Rechnungsadresse", addressLines(o.billingAddress).join("\n")],
  ];
  if (o.shippingAddress) rows.push(["Lieferadresse", addressLines(o.shippingAddress).join("\n")]);
  if (o.customerNote) rows.push(["Ihre Bemerkung", o.customerNote]);
  const paragraphs: string[] = [];
  if (instr && !paid) {
    paragraphs.push(`${instr.title}: ${instr.text}`);
    for (const [k, v] of instr.rows) rows.push([k, v]);
  }
  const content: EmailContent = {
    title: `Vielen Dank für Ihre Bestellung ${label}`,
    intro: `Guten Tag ${o.billingAddress.firstName} ${o.billingAddress.lastName}\nWir haben Ihre Bestellung erhalten${paid ? " und die Zahlung ist eingegangen" : ""}. Hier die Übersicht:`,
    html: orderTableHtml(o, items),
    paragraphs,
    rows,
    cta: instr?.invoiceUrl ? { label: "Rechnung mit QR-Einzahlungsschein öffnen", url: instr.invoiceUrl } : { label: "Bestellung ansehen", url: await orderStatusUrl(o) },
    footnote: `Fragen zur Bestellung? Antworten Sie einfach auf diese E-Mail${general.phone ? ` oder rufen Sie uns an: ${general.phone}` : ""}.`,
  };
  return sendToCustomer(o, "confirmation", "Bestellbestätigung", `Bestellbestätigung ${label}`, content);
}

/** Notice to the shop (shop.orderNotifyEmails + email.notifyNewOrder). */
export async function sendNewOrderNotice(orderId: string) {
  const { o, items, label } = await load(orderId);
  const [shop, mail] = await Promise.all([getSettings("shop"), getSettings("email")]);
  const to = [...new Set([...shop.orderNotifyEmails, ...mail.notifyNewOrder].map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!to.length) return { ok: false, error: "Keine Empfänger" };
  const res = await sendMail({
    to,
    subject: `Neue Bestellung ${label} – ${money(o.total)}`,
    template: "order.new_notice",
    related: { type: "order", id: o.id },
    content: {
      title: `Neue Bestellung ${label}`,
      intro: `${[o.billingAddress.firstName, o.billingAddress.lastName].join(" ")} (${o.email}) hat bestellt.`,
      html: orderTableHtml(o, items),
      rows: [
        ["Zahlungsart", paymentMethodLabel(o.paymentMethod)],
        ["Versand", o.shippingMethodName || "–"],
        ["Lieferadresse", addressLines(o.shippingAddress ?? o.billingAddress).join("\n")],
        ...(o.customerNote ? ([["Bemerkung", o.customerNote]] as [string, string][]) : []),
      ],
      cta: { label: "Im Dashboard öffnen", url: appUrl(`/madexadm/bestellungen/${o.id}`) },
    },
  });
  return logSend(o, "new_notice", "Neue Bestellung (Shop)", to.join(", "), res);
}

export async function sendShippedEmail(orderId: string, f: { trackingNumber?: string | null; trackingUrl?: string | null; carrier?: string | null; items?: { name: string; variantTitle?: string; quantity: number }[]; partial?: boolean }) {
  const { o, label } = await load(orderId);
  const rows: [string, string][] = [["Bestellnummer", label]];
  if (f.carrier) rows.push(["Versanddienst", f.carrier]);
  if (f.trackingNumber) rows.push(["Sendungsnummer", f.trackingNumber]);
  if (f.items?.length) rows.push(["Artikel", f.items.map((i) => `${i.quantity} × ${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""}`).join("\n")]);
  rows.push(["Lieferadresse", addressLines(o.shippingAddress ?? o.billingAddress).join("\n")]);
  return sendToCustomer(o, "shipped", f.partial ? "Teillieferung versendet" : "Versandbestätigung", `${f.partial ? "Teillieferung" : "Ihre Bestellung"} ${label} ist unterwegs`, {
    title: f.partial ? `Ein Teil Ihrer Bestellung ${label} ist unterwegs` : `Ihre Bestellung ${label} ist unterwegs`,
    intro: `Guten Tag ${o.billingAddress.firstName} ${o.billingAddress.lastName}\nWir haben ${f.partial ? "einen Teil Ihrer Bestellung" : "Ihre Bestellung"} heute versendet.`,
    rows,
    cta: f.trackingUrl ? { label: "Sendung verfolgen", url: f.trackingUrl } : undefined,
  });
}

export async function sendCancelledEmail(orderId: string, reason?: string) {
  const { o, label } = await load(orderId);
  return sendToCustomer(o, "cancelled", "Stornierung", `Bestellung ${label} storniert`, {
    title: `Ihre Bestellung ${label} wurde storniert`,
    intro: `Guten Tag ${o.billingAddress.firstName} ${o.billingAddress.lastName}\nIhre Bestellung vom ${date(o.createdAt)} über ${money(o.total)} wurde storniert.`,
    paragraphs: reason ? [`Grund: ${reason}`] : [],
    footnote: "Falls Sie bereits bezahlt haben, erstatten wir den Betrag zurück. Bei Fragen antworten Sie einfach auf diese E-Mail.",
  });
}

export async function sendRefundedEmail(orderId: string, refunded: number, reason?: string) {
  const { o, label } = await load(orderId);
  const via = o.paymentMethod === "stripe" || o.paymentMethod === "payrexx" ? "auf das ursprüngliche Zahlungsmittel" : "auf Ihr Konto";
  return sendToCustomer(o, "refunded", "Rückerstattung", `Rückerstattung zu Bestellung ${label}`, {
    title: `Rückerstattung von ${money(refunded)}`,
    intro: `Guten Tag ${o.billingAddress.firstName} ${o.billingAddress.lastName}\nWir haben Ihnen zur Bestellung ${label} ${money(refunded)} ${via} zurückerstattet. Je nach Bank dauert die Gutschrift einige Tage.`,
    rows: [
      ["Bestellnummer", label],
      ["Rückerstattet", money(refunded)],
      ["Total rückerstattet", money(o.refundedTotal)],
      ...(reason ? ([["Grund", reason]] as [string, string][]) : []),
    ],
  });
}

export async function sendCustomerNoteEmail(orderId: string, message: string) {
  const { o, label } = await load(orderId);
  return sendToCustomer(o, "note", "Mitteilung", `Mitteilung zu Ihrer Bestellung ${label}`, {
    title: `Mitteilung zu Ihrer Bestellung ${label}`,
    intro: `Guten Tag ${o.billingAddress.firstName} ${o.billingAddress.lastName}`,
    paragraphs: [message],
    cta: { label: "Bestellung ansehen", url: await orderStatusUrl(o) },
  });
}

/** Low stock list to email.notifyLowStock. */
export async function sendLowStockEmail(list: { name: string; sku: string | null; stock: number }[]) {
  const { notifyLowStock } = await getSettings("email");
  if (!notifyLowStock.length || !list.length) return { ok: false, error: "Keine Empfänger" };
  return sendMail({
    to: notifyLowStock,
    subject: list.length === 1 ? `Lagerbestand niedrig: ${list[0].name}` : `Lagerbestand niedrig: ${list.length} Artikel`,
    template: "stock.low",
    content: {
      title: "Lagerbestand niedrig",
      intro: "Diese Artikel sollten nachbestellt werden:",
      rows: list.map((v) => [v.name + (v.sku ? ` (${v.sku})` : ""), v.stock <= 0 ? "ausverkauft" : `${v.stock} Stück`]),
      cta: { label: "Produkte öffnen", url: appUrl("/madexadm/produkte") },
    },
  });
}
