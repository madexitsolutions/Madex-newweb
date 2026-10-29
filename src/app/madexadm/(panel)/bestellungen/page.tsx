import Form from "next/form";
import Link from "next/link";
import { AutoSelect } from "@/components/admin/shop-ui";
import { Empty, Icon, PageHeader, Pager, Panel, Tabs, qs } from "@/components/admin/kit";
import { dateTime, money } from "@/lib/format";
import { FULFILLMENT_STATUS, ORDER_STATUS, PAYMENT_STATUS, paymentMethodLabel } from "@/lib/orders";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { ORDER_TABS, listOrders, orderTabCounts, usedPaymentMethods } from "@/server/shop/orders";
import { orderParams } from "./params";
import "../../shop.css";

export const metadata = { title: "Bestellungen" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  await requirePermission("orders.view");
  await requireModule("shop");
  const p = orderParams(await searchParams);
  const [data, counts, methods] = await Promise.all([listOrders(p), orderTabCounts(p), usedPaymentMethods()]);
  const base = { q: p.q, zahlung: p.paymentStatus, zahlart: p.paymentMethod, von: p.from, bis: p.to, tab: p.tab === "offen" ? undefined : p.tab };
  const href = (o: Record<string, string | number | undefined>) => `/madexadm/bestellungen${qs({ ...base, ...o })}`;
  const filtered = Boolean(p.q || p.paymentStatus || p.paymentMethod || p.from || p.to);

  return (
    <>
      <PageHeader
        title="Bestellungen"
        description="Alle Bestellungen aus dem Shop. «Zu erledigen» zeigt, was bezahlt oder freigegeben ist und versendet werden muss."
        actions={
          <a href={`/madexadm/bestellungen/export${qs(base)}`} className="a-btn a-btn--ghost" download>
            <Icon name="download" size={16} />
            CSV exportieren
          </a>
        }
      />
      <Tabs label="Bestellungen" active={p.tab} items={ORDER_TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key], href: href({ tab: t.key === "offen" ? undefined : t.key, seite: undefined }) }))} />
      <Panel flush>
        <Form action="/madexadm/bestellungen" className="a-toolbar">
          <div className="a-toolbar__row">
            {p.tab !== "offen" && <input type="hidden" name="tab" value={p.tab} />}
            <label className="a-field a-field--grow">
              <span className="sr-only">Suchen</span>
              <input type="search" name="q" defaultValue={p.q} placeholder="Nummer, Name oder E-Mail …" />
            </label>
            <AutoSelect name="zahlung" defaultValue={p.paymentStatus ?? ""} label="Zahlungsstatus">
              <option value="">Zahlung: alle</option>
              {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </AutoSelect>
            {methods.length > 1 && (
              <AutoSelect name="zahlart" defaultValue={p.paymentMethod ?? ""} label="Zahlungsart">
                <option value="">Alle Zahlungsarten</option>
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {paymentMethodLabel(m)}
                  </option>
                ))}
              </AutoSelect>
            )}
            <label className="a-field">
              <span className="sr-only">Von</span>
              <input type="date" name="von" defaultValue={p.from} aria-label="Von Datum" />
            </label>
            <label className="a-field">
              <span className="sr-only">Bis</span>
              <input type="date" name="bis" defaultValue={p.to} aria-label="Bis Datum" />
            </label>
            <button type="submit" className="a-btn a-btn--ghost">
              Filtern
            </button>
            {filtered && (
              <Link href={href({ q: undefined, zahlung: undefined, zahlart: undefined, von: undefined, bis: undefined })} className="a-btn a-btn--quiet">
                Zurücksetzen
              </Link>
            )}
          </div>
        </Form>
        {data.rows.length === 0 ? (
          filtered ? (
            <Empty icon="search" title="Keine Bestellungen gefunden">
              Keine Bestellung passt zu Suche und Filtern.
            </Empty>
          ) : p.tab === "offen" ? (
            <Empty icon="check" title="Alles erledigt">
              Keine Bestellung wartet auf den Versand. Neue Bestellungen erscheinen hier und als Zahl im Menü.
            </Empty>
          ) : (
            <Empty icon="cart" title="Noch keine Bestellungen">
              Sobald Kundinnen und Kunden im Shop bestellen, erscheinen die Bestellungen hier.
            </Empty>
          )
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th scope="col">
                    <Link href={href({ sort: "nummer", dir: p.sort === "nummer" && p.dir === "desc" ? "asc" : undefined })}>Bestellung</Link>
                  </th>
                  <th scope="col">
                    <Link href={href({ sort: "kunde", dir: p.sort === "kunde" && p.dir === "desc" ? "asc" : undefined })}>Kunde</Link>
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Zahlung</th>
                  <th scope="col">Versand</th>
                  <th scope="col" className="a-num">
                    <Link href={href({ sort: "betrag", dir: p.sort === "betrag" && p.dir === "desc" ? "asc" : undefined })}>Total</Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/madexadm/bestellungen/${o.id}`} className="a-rowlink">
                        {o.label}
                      </Link>
                      <small>{dateTime(o.createdAt)}</small>
                    </td>
                    <td data-label="Kunde">
                      {o.company || o.name || o.email}
                      <small>{o.company ? o.name : o.email}</small>
                    </td>
                    <td data-label="Status">
                      <span className={`a-pill a-pill--${ORDER_STATUS[o.status].tone}`}>{ORDER_STATUS[o.status].label}</span>
                    </td>
                    <td data-label="Zahlung">
                      <span className={`a-pill a-pill--${PAYMENT_STATUS[o.paymentStatus].tone}`}>{PAYMENT_STATUS[o.paymentStatus].label}</span>
                      <small>{paymentMethodLabel(o.paymentMethod)}</small>
                    </td>
                    <td data-label="Versand">
                      <span className={`a-pill a-pill--${FULFILLMENT_STATUS[o.fulfillmentStatus].tone}`}>{FULFILLMENT_STATUS[o.fulfillmentStatus].label}</span>
                      {o.shippingMethodName && <small>{o.shippingMethodName}</small>}
                    </td>
                    <td data-label="Total" className="a-num">
                      {money(o.total)}
                      <small>
                        {o.itemCount} Artikel{o.refundedTotal > 0 && ` · − ${money(o.refundedTotal)}`}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={data.page} pages={data.pages} total={data.total} from={data.from} to={data.to} href={(n) => href({ seite: n > 1 ? n : undefined })} />
      </Panel>
    </>
  );
}
