import { date, money, percent } from "@/lib/format";
import { addressLines, paymentMethodLabel } from "@/lib/orders";
import { invoiceDueDate, invoiceQrBill } from "@/server/payments/invoice";
import { orderLabel, type OrderItemRow, type OrderRow } from "@/server/shop/order-core";
import { orderTaxes } from "@/server/shop/orders";
import { getSettings } from "@/server/settings";
import "./invoice.css";

/** A4 invoice (with Swiss QR-bill when unpaid) or delivery note of an order. */
export async function InvoiceDoc({ order, items, kind }: { order: OrderRow; items: OrderItemRow[]; kind: "rechnung" | "lieferschein" }) {
  const [general, branding, shop, pay, label] = await Promise.all([getSettings("general"), getSettings("branding"), getSettings("shop"), getSettings("payments"), orderLabel(order)]);
  const isInvoice = kind === "rechnung";
  const open = Math.max(0, order.total - order.refundedTotal);
  const unpaid = isInvoice && open > 0 && !["paid", "refunded", "partially_refunded"].includes(order.paymentStatus) && order.status !== "cancelled";
  const qr = unpaid ? await invoiceQrBill(order) : null;
  const taxes = orderTaxes(order, items);
  const sender = [general.companyName || general.siteName, general.street, [general.zip, general.city].filter(Boolean).join(" ")].filter(Boolean);
  const recipient = addressLines(isInvoice ? order.billingAddress : (order.shippingAddress ?? order.billingAddress));

  return (
    <article className="inv">
      <header className="inv__head">
        <div>
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={general.siteName} className="inv__logo" />
          ) : (
            <strong className="inv__name">{general.companyName || general.siteName}</strong>
          )}
        </div>
        <div className="inv__sender">
          {sender.map((l) => (
            <span key={l}>{l}</span>
          ))}
          {general.email && <span>{general.email}</span>}
          {general.phone && <span>{general.phone}</span>}
          {general.vatNumber && <span>{general.vatNumber}</span>}
        </div>
      </header>

      <div className="inv__addr">
        <p className="inv__back">{sender.join(" · ")}</p>
        {recipient.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>

      <h1 className="inv__title">
        {isInvoice ? "Rechnung" : "Lieferschein"} {label}
      </h1>
      <dl className="inv__meta">
        <div>
          <dt>Datum</dt>
          <dd>{date(order.createdAt)}</dd>
        </div>
        <div>
          <dt>Bestellung</dt>
          <dd>{label}</dd>
        </div>
        {isInvoice && (
          <div>
            <dt>Zahlungsart</dt>
            <dd>{paymentMethodLabel(order.paymentMethod)}</dd>
          </div>
        )}
        {unpaid && order.paymentMethod === "invoice" && (
          <div>
            <dt>Zahlbar bis</dt>
            <dd>{date(invoiceDueDate(order, pay.invoiceDueDays))}</dd>
          </div>
        )}
      </dl>

      <table className="inv__table">
        <thead>
          <tr>
            <th scope="col">Artikel</th>
            <th scope="col" className="inv__num">
              Menge
            </th>
            {isInvoice && (
              <>
                <th scope="col" className="inv__num">
                  Preis
                </th>
                <th scope="col" className="inv__num">
                  MWST
                </th>
                <th scope="col" className="inv__num">
                  Betrag
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>
                {i.name}
                {i.variantTitle && <small>{i.variantTitle}</small>}
                {i.sku && <small>Art.-Nr. {i.sku}</small>}
              </td>
              <td className="inv__num">{i.quantity}</td>
              {isInvoice && (
                <>
                  <td className="inv__num">{money(i.unitPrice)}</td>
                  <td className="inv__num">{percent(i.taxRateBp)}</td>
                  <td className="inv__num">{money(i.total)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {isInvoice && (
        <dl className="inv__totals">
          <div>
            <dt>Zwischensumme</dt>
            <dd>{money(order.subtotal)}</dd>
          </div>
          {order.discountTotal > 0 && (
            <div>
              <dt>Rabatt{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
              <dd>− {money(order.discountTotal)}</dd>
            </div>
          )}
          {order.shippingMethodName && (
            <div>
              <dt>{order.shippingMethodName}</dt>
              <dd>{money(order.shippingTotal)}</dd>
            </div>
          )}
          <div className="inv__total">
            <dt>Total {order.currency}</dt>
            <dd>{money(order.total)}</dd>
          </div>
          {taxes.map((t) => (
            <div key={t.rateBp} className="inv__tax">
              <dt>
                inkl. MWST {percent(t.rateBp)} auf {money(t.gross)}
              </dt>
              <dd>{money(t.tax)}</dd>
            </div>
          ))}
          {order.refundedTotal > 0 && (
            <div>
              <dt>Rückerstattet</dt>
              <dd>− {money(order.refundedTotal)}</dd>
            </div>
          )}
        </dl>
      )}

      {isInvoice && !unpaid && order.paymentStatus === "paid" && <p className="inv__paid">Bezahlt – vielen Dank.</p>}
      {shop.invoiceFooter && <p className="inv__foot">{shop.invoiceFooter}</p>}

      {qr && (
        <section className="inv__qr" aria-label="Zahlteil mit QR-Code">
          {qr.errors.length ? (
            <p className="inv__qrerr">Der QR-Einzahlungsschein kann noch nicht erstellt werden: {qr.errors.join(" ")}</p>
          ) : (
            <div className="inv__qrgrid">
              <div className="inv__receipt">
                <h2>Empfangsschein</h2>
                <p>
                  <b>Konto / Zahlbar an</b>
                  <span>{qr.ibanDisplay}</span>
                  <span>{qr.data.creditor.name}</span>
                  <span>
                    {qr.data.creditor.postalCode} {qr.data.creditor.town}
                  </span>
                </p>
                {qr.referenceDisplay && (
                  <p>
                    <b>Referenz</b>
                    <span>{qr.referenceDisplay}</span>
                  </p>
                )}
                <p>
                  <b>Betrag</b>
                  <span>
                    {qr.data.currency} {qr.data.amount != null ? (qr.data.amount / 100).toFixed(2) : ""}
                  </span>
                </p>
              </div>
              <div className="inv__payment">
                <h2>Zahlteil</h2>
                <div className="inv__code" dangerouslySetInnerHTML={{ __html: qr.svg }} />
                <p>
                  <b>Konto / Zahlbar an</b>
                  <span>{qr.ibanDisplay}</span>
                  <span>{qr.data.creditor.name}</span>
                  <span>
                    {qr.data.creditor.postalCode} {qr.data.creditor.town}
                  </span>
                </p>
                {qr.referenceDisplay && (
                  <p>
                    <b>Referenz</b>
                    <span>{qr.referenceDisplay}</span>
                  </p>
                )}
                <p>
                  <b>Zusätzliche Informationen</b>
                  <span>{qr.data.message}</span>
                </p>
                <p>
                  <b>Betrag</b>
                  <span>
                    {qr.data.currency} {qr.data.amount != null ? (qr.data.amount / 100).toFixed(2) : ""}
                  </span>
                </p>
              </div>
            </div>
          )}
        </section>
      )}
    </article>
  );
}
