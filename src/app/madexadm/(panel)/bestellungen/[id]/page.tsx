import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm, Submit } from "@/components/admin/forms";
import { Icon, PageHeader, Panel } from "@/components/admin/kit";
import { centsToInput, dateTime, money, percent } from "@/lib/format";
import { CARRIERS, FULFILLMENT_STATUS, ORDER_STATUS, PAYMENT_STATUS, addressLines, paymentMethodLabel } from "@/lib/orders";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { getOrderDetail } from "@/server/shop/orders";
import { cancelAction, fulfilAction, markPaidAction, noteAction, refundAction, resendAction } from "../actions";
import "../../../shop.css";
import "../orders.css";

export const metadata = { title: "Bestellung" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("orders.view");
  await requireModule("shop");
  const { id } = await params;
  const d = /^[0-9a-f-]{36}$/i.test(id) ? await getOrderDetail(id) : null;
  if (!d) notFound();
  const o = d.order;
  const canManage = user.permissions.has("orders.manage");
  const canRefund = user.permissions.has("orders.refund") && d.can.refund;
  const openItems = d.items.filter((i) => i.quantity - i.refundedQuantity > i.fulfilledQuantity);
  const fields = { id: o.id };

  return (
    <>
      <PageHeader
        crumb={{ href: "/madexadm/bestellungen", label: "Bestellungen" }}
        title={`Bestellung ${d.label}`}
        meta={
          <>
            <span className={`a-pill a-pill--lg a-pill--${ORDER_STATUS[o.status].tone}`}>{ORDER_STATUS[o.status].label}</span>
            <span className={`a-pill a-pill--${PAYMENT_STATUS[o.paymentStatus].tone}`}>{PAYMENT_STATUS[o.paymentStatus].label}</span>
            <span className={`a-pill a-pill--${FULFILLMENT_STATUS[o.fulfillmentStatus].tone}`}>{FULFILLMENT_STATUS[o.fulfillmentStatus].label}</span>
          </>
        }
        description={`${dateTime(o.createdAt)} · ${ORDER_STATUS[o.status].hint}`}
        actions={
          <>
            <a href={`/madexadm/druck/rechnung/${o.id}`} target="_blank" rel="noopener" className="a-btn a-btn--ghost">
              <Icon name="print" size={16} />
              Rechnung
            </a>
            <a href={`/madexadm/druck/lieferschein/${o.id}`} target="_blank" rel="noopener" className="a-btn a-btn--ghost">
              <Icon name="truck" size={16} />
              Lieferschein
            </a>
          </>
        }
      />

      <div className="a-grid2 a-grid2--wide">
        <div className="a-stack">
          <Panel title="Artikel" flush>
            <div className="a-tablewrap">
              <table className="a-table a-table--stack">
                <thead>
                  <tr>
                    <th scope="col">Artikel</th>
                    <th scope="col" className="a-num">
                      Preis
                    </th>
                    <th scope="col" className="a-num">
                      Menge
                    </th>
                    <th scope="col" className="a-num">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div className="a-cellmain">
                          {i.imagePath ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={i.imagePath.startsWith("/") ? i.imagePath : `/uploads/${i.imagePath}`} alt="" className="a-thumb" />
                          ) : (
                            <span className="a-thumb od-nothumb" aria-hidden="true">
                              <Icon name="box" size={18} />
                            </span>
                          )}
                          <div>
                            {i.productId ? (
                              <Link href={`/madexadm/produkte/${i.productId}`} className="a-rowlink">
                                {i.name}
                              </Link>
                            ) : (
                              <strong>{i.name}</strong>
                            )}
                            <small>{[i.variantTitle, i.sku && `Art.-Nr. ${i.sku}`].filter(Boolean).join(" · ")}</small>
                            {(i.fulfilledQuantity > 0 || i.refundedQuantity > 0) && (
                              <small>
                                {i.fulfilledQuantity > 0 && `${i.fulfilledQuantity} versendet`}
                                {i.fulfilledQuantity > 0 && i.refundedQuantity > 0 && " · "}
                                {i.refundedQuantity > 0 && `${i.refundedQuantity} zurückgenommen`}
                              </small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td data-label="Preis" className="a-num">
                        {money(i.unitPrice)}
                      </td>
                      <td data-label="Menge" className="a-num">
                        {i.quantity}
                      </td>
                      <td data-label="Total" className="a-num">
                        {money(i.total)}
                        {i.discount > 0 && <small>− {money(i.discount)} Rabatt</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="od-totals">
              <div>
                <dt>Zwischensumme</dt>
                <dd>{money(o.subtotal)}</dd>
              </div>
              {o.discountTotal > 0 && (
                <div>
                  <dt>Rabatt {o.couponCode && <code>{o.couponCode}</code>}</dt>
                  <dd>− {money(o.discountTotal)}</dd>
                </div>
              )}
              <div>
                <dt>Versand {o.shippingMethodName && `(${o.shippingMethodName})`}</dt>
                <dd>{money(o.shippingTotal)}</dd>
              </div>
              {d.taxes.map((t) => (
                <div key={t.rateBp} className="od-totals__tax">
                  <dt>inkl. MWST {percent(t.rateBp)}</dt>
                  <dd>{money(t.tax)}</dd>
                </div>
              ))}
              <div className="od-totals__total">
                <dt>Total</dt>
                <dd>{money(o.total)}</dd>
              </div>
              {o.refundedTotal > 0 && (
                <div className="od-totals__refund">
                  <dt>Rückerstattet</dt>
                  <dd>− {money(o.refundedTotal)}</dd>
                </div>
              )}
            </dl>
          </Panel>

          {canManage && (d.can.markPaid || d.can.fulfil || d.can.cancel || canRefund) && (
            <Panel title="Nächste Schritte">
              <div className="od-actions">
                {d.can.markPaid && (
                  <details className="od-action" open={o.status === "on_hold"}>
                    <summary>
                      <Icon name="card" size={16} />
                      Zahlung erhalten
                    </summary>
                    <ActionForm action={markPaidAction} className="od-form">
                      <input type="hidden" name="id" value={o.id} />
                      <p className="a-muted a-small0">Für Rechnung, Vorauskasse oder Barzahlung: sobald das Geld da ist.</p>
                      <label className="a-field">
                        <span>
                          Referenz <em>optional</em>
                        </span>
                        <input name="reference" placeholder="z. B. Buchungsnummer der Bank" />
                      </label>
                      <Submit>Als bezahlt markieren</Submit>
                    </ActionForm>
                  </details>
                )}
                {d.can.fulfil && (
                  <details className="od-action" open={o.status === "processing"}>
                    <summary>
                      <Icon name="truck" size={16} />
                      Versenden
                    </summary>
                    <ActionForm action={fulfilAction} className="od-form">
                      <input type="hidden" name="id" value={o.id} />
                      {openItems.length > 1 && (
                        <fieldset className="od-items">
                          <legend>Welche Artikel? (leer = alle offenen)</legend>
                          {openItems.map((i) => (
                            <label key={i.id} className="a-field od-qty">
                              <span>
                                {i.name}
                                {i.variantTitle && ` · ${i.variantTitle}`}
                              </span>
                              <input type="number" name={`qty_${i.id}`} min={0} max={i.quantity - i.refundedQuantity - i.fulfilledQuantity} placeholder={String(i.quantity - i.refundedQuantity - i.fulfilledQuantity)} />
                            </label>
                          ))}
                        </fieldset>
                      )}
                      <div className="a-fields2">
                        <label className="a-field">
                          <span>Versanddienst</span>
                          <select name="carrier" defaultValue="post">
                            <option value="">Ohne Sendungsverfolgung</option>
                            {Object.entries(CARRIERS).map(([k, c]) => (
                              <option key={k} value={k}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="a-field">
                          <span>
                            Sendungsnummer <em>optional</em>
                          </span>
                          <input name="trackingNumber" spellCheck={false} />
                        </label>
                      </div>
                      <label className="a-check">
                        <input type="checkbox" name="notify" defaultChecked />
                        <span>Kundin/Kunde per E-Mail informieren</span>
                      </label>
                      <Submit>Als versendet markieren</Submit>
                    </ActionForm>
                  </details>
                )}
                {canRefund && (
                  <details className="od-action">
                    <summary>
                      <Icon name="refresh" size={16} />
                      Rückerstatten
                    </summary>
                    <ActionForm action={refundAction} className="od-form">
                      <input type="hidden" name="id" value={o.id} />
                      <fieldset className="od-items">
                        <legend>Zurückgenommene Artikel (optional)</legend>
                        {d.items
                          .filter((i) => i.quantity - i.refundedQuantity > 0)
                          .map((i) => (
                            <label key={i.id} className="a-field od-qty">
                              <span>{i.name}</span>
                              <input type="number" name={`qty_${i.id}`} min={0} max={i.quantity - i.refundedQuantity} placeholder="0" />
                            </label>
                          ))}
                      </fieldset>
                      <div className="a-fields2">
                        <label className="a-field">
                          <span>Betrag CHF</span>
                          <input name="amount" inputMode="decimal" defaultValue={centsToInput(o.total - o.refundedTotal)} />
                          <small>Höchstens {money(o.total - o.refundedTotal)}.</small>
                        </label>
                        <label className="a-field">
                          <span>
                            Grund <em>optional</em>
                          </span>
                          <input name="reason" />
                        </label>
                      </div>
                      <label className="a-check">
                        <input type="checkbox" name="restock" defaultChecked />
                        <span>Zurückgenommene Artikel wieder an Lager buchen</span>
                      </label>
                      {d.provider?.canRefund ? (
                        <label className="a-check">
                          <input type="checkbox" name="manual" />
                          <span>
                            Nur erfassen
                            <small>Ohne Haken wird der Betrag über {d.provider.label} automatisch zurückgezahlt.</small>
                          </span>
                        </label>
                      ) : (
                        <input type="hidden" name="manual" value="1" />
                      )}
                      <label className="a-check">
                        <input type="checkbox" name="notify" defaultChecked />
                        <span>Kundin/Kunde per E-Mail informieren</span>
                      </label>
                      <Submit variant="danger">Rückerstattung erfassen</Submit>
                    </ActionForm>
                  </details>
                )}
                {d.can.cancel && (
                  <details className="od-action">
                    <summary>
                      <Icon name="close" size={16} />
                      Stornieren
                    </summary>
                    <ActionForm action={cancelAction} className="od-form">
                      <input type="hidden" name="id" value={o.id} />
                      <label className="a-field">
                        <span>
                          Grund <em>optional</em>
                        </span>
                        <input name="reason" />
                      </label>
                      <label className="a-check">
                        <input type="checkbox" name="restock" defaultChecked />
                        <span>Artikel wieder an Lager buchen</span>
                      </label>
                      <label className="a-check">
                        <input type="checkbox" name="notify" defaultChecked />
                        <span>Kundin/Kunde per E-Mail informieren</span>
                      </label>
                      <Submit variant="danger">Bestellung stornieren</Submit>
                    </ActionForm>
                  </details>
                )}
              </div>
            </Panel>
          )}

          <Panel title="Verlauf" description="Notizen für Kundinnen und Kunden sind auf der Bestellseite sichtbar.">
            {canManage && (
              <ActionForm action={noteAction} className="od-note" resetOnSuccess>
                <input type="hidden" name="id" value={o.id} />
                <label className="a-field">
                  <span className="sr-only">Notiz</span>
                  <textarea name="message" rows={2} placeholder="Notiz hinzufügen …" maxLength={5000} />
                </label>
                <div className="od-note__row">
                  <label className="a-check">
                    <input type="checkbox" name="visible" />
                    <span>Für Kunde sichtbar</span>
                  </label>
                  <label className="a-check">
                    <input type="checkbox" name="notify" />
                    <span>per E-Mail senden</span>
                  </label>
                  <Submit variant="ghost">Notiz speichern</Submit>
                </div>
              </ActionForm>
            )}
            <ol className="od-timeline">
              {d.events.map((e) => (
                <li key={e.id} className={e.internal ? "is-internal" : undefined}>
                  <p>{e.message}</p>
                  <small>
                    {dateTime(e.createdAt)}
                    {e.userName && ` · ${e.userName}`}
                    {!e.internal && e.type === "note" && " · für Kunde sichtbar"}
                  </small>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="a-stack">
          <Panel title="Kunde">
            <div className="od-contact">
              {d.customer ? (
                <Link href={`/madexadm/kunden/${d.customer.id}`} className="a-link">
                  {[d.customer.firstName, d.customer.lastName].filter(Boolean).join(" ") || d.customer.email}
                </Link>
              ) : (
                <strong>Gast</strong>
              )}
              <a href={`mailto:${o.email}`} className="a-link">
                {o.email}
              </a>
              {o.phone && <a href={`tel:${o.phone.replace(/\s+/g, "")}`}>{o.phone}</a>}
              {d.customer && d.customer.ordersCount > 1 && (
                <small className="a-muted">
                  {d.customer.ordersCount} Bestellungen · {money(d.customer.totalSpent)}
                </small>
              )}
            </div>
            {o.customerNote && (
              <blockquote className="od-quote">
                <small>Bemerkung der Kundin/des Kunden</small>
                {o.customerNote}
              </blockquote>
            )}
          </Panel>
          <Panel title="Adressen">
            <div className="od-addr">
              <div>
                <h3>Rechnung</h3>
                <address>
                  {addressLines(o.billingAddress, { homeCountry: "XX" }).map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </address>
              </div>
              <div>
                <h3>Lieferung</h3>
                {o.shippingAddress ? (
                  <address>
                    {addressLines(o.shippingAddress, { homeCountry: "XX" }).map((l) => (
                      <span key={l}>{l}</span>
                    ))}
                  </address>
                ) : (
                  <p className="a-muted">Wie Rechnung</p>
                )}
              </div>
            </div>
          </Panel>
          <Panel title="Zahlung und Versand">
            <dl className="od-facts">
              <div>
                <dt>Zahlungsart</dt>
                <dd>{paymentMethodLabel(o.paymentMethod)}</dd>
              </div>
              {o.paymentReference && (
                <div>
                  <dt>Referenz</dt>
                  <dd>
                    <code>{o.paymentReference}</code>
                  </dd>
                </div>
              )}
              {d.payments.map((p) => (
                <div key={p.id}>
                  <dt>{dateTime(p.createdAt)}</dt>
                  <dd>
                    {money(p.amount)} · {p.status === "succeeded" ? "erfolgreich" : p.status === "pending" ? "offen" : p.status === "failed" ? "fehlgeschlagen" : "abgebrochen"}
                  </dd>
                </div>
              ))}
              <div>
                <dt>Versandart</dt>
                <dd>{o.shippingMethodName || "–"}</dd>
              </div>
              {o.trackingNumber && (
                <div>
                  <dt>Sendung</dt>
                  <dd>
                    {o.trackingUrl ? (
                      <a href={o.trackingUrl} target="_blank" rel="noopener" className="a-link">
                        {o.trackingNumber}
                      </a>
                    ) : (
                      o.trackingNumber
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt>Quelle</dt>
                <dd>{o.source === "storefront" ? "Shop" : o.source}</dd>
              </div>
            </dl>
          </Panel>
          {canManage && (
            <Panel title="E-Mails erneut senden">
              <div className="od-resend">
                <ActionButton action={resendAction} fields={{ ...fields, kind: "confirmation" }} label="Bestellbestätigung" />
                {o.fulfillmentStatus !== "unfulfilled" && <ActionButton action={resendAction} fields={{ ...fields, kind: "shipped" }} label="Versandbestätigung" />}
                <ActionButton action={resendAction} fields={{ ...fields, kind: "notice" }} label="Meldung an uns" />
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
