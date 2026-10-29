import Link from "next/link";
import { notFound } from "next/navigation";
import "../../../shop.css";
import { ActionButton } from "@/components/admin/action-button";
import { Empty, Icon, one, PageHeader, Panel } from "@/components/admin/kit";
import { date, dateTime, money } from "@/lib/format";
import { ORDER_STATUS, PAYMENT_STATUS, addressLines } from "@/lib/orders";
import { requireModule } from "@/modules/registry";
import { can, requirePermission } from "@/server/auth/session";
import { getCustomer, isAnonymised } from "@/server/shop/customers";
import { getSettings } from "@/server/settings";
import { anonymiseCustomerAction, deleteAddressAction, deleteCustomerAction } from "../actions";
import { CustomerForm } from "../form";

export const metadata = { title: "Kunde" };

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("customers.view");
  await requireModule("shop");
  const { id } = await params;
  const meldung = one((await searchParams).meldung);
  const data = await getCustomer(id);
  if (!data) notFound();
  const { customer: c, addresses, orders, stats } = data;
  const manage = can(user, "customers.manage");
  const anon = isAnonymised(c);
  const name = anon ? "Anonymisierter Kunde" : [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
  const { orderPrefix } = await getSettings("shop");

  return (
    <>
      <PageHeader
        title={name}
        crumb={{ href: "/madexadm/kunden", label: "Kunden" }}
        meta={
          <>
            {c.hasAccount && <span className="a-pill a-pill--accent">Kundenkonto</span>}
            {c.disabled && <span className="a-pill a-pill--bad">Gesperrt</span>}
            {anon && <span className="a-pill a-pill--muted">Anonymisiert</span>}
          </>
        }
        description={anon ? "Die Personendaten wurden entfernt. Die Bestellungen bleiben für die Buchhaltung erhalten." : `Kunde seit ${date(c.createdAt)} · ${c.email}`}
        actions={
          manage &&
          !anon && (
            <a href={`/madexadm/kunden/${c.id}/daten`} className="a-btn a-btn--ghost">
              <Icon name="download" size={16} />
              Daten exportieren
            </a>
          )
        }
      />
      {meldung && (
        <p className="a-alert a-alert--ok" role="status">
          {meldung}
        </p>
      )}
      <div className="a-kpis">
        <div className="a-kpi">
          <span className="a-kpi__label">Bestellungen</span>
          <strong>{stats.orders}</strong>
        </div>
        <div className="a-kpi">
          <span className="a-kpi__label">Umsatz</span>
          <strong>{money(stats.spent)}</strong>
        </div>
        <div className="a-kpi">
          <span className="a-kpi__label">Ø Bestellwert</span>
          <strong>{money(stats.average)}</strong>
        </div>
        <div className="a-kpi">
          <span className="a-kpi__label">Letzte Bestellung</span>
          <strong>{stats.lastOrderAt ? date(stats.lastOrderAt) : "–"}</strong>
        </div>
      </div>

      <div className="a-split">
        <div className="a-stack">
          <Panel title="Bestellungen" flush>
            {orders.length === 0 ? (
              <Empty icon="cart" title="Noch keine Bestellungen" />
            ) : (
              <div className="a-tablewrap">
                <table className="a-table">
                  <thead>
                    <tr>
                      <th>Nr.</th>
                      <th>Datum</th>
                      <th>Status</th>
                      <th>Zahlung</th>
                      <th className="a-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link href={`/madexadm/bestellungen/${o.id}`} className="a-link">
                            <strong>
                              {orderPrefix}
                              {o.number}
                            </strong>
                          </Link>
                        </td>
                        <td>{dateTime(o.createdAt)}</td>
                        <td>
                          <span className={`a-pill a-pill--${ORDER_STATUS[o.status].tone}`}>{ORDER_STATUS[o.status].label}</span>
                        </td>
                        <td>
                          <span className={`a-pill a-pill--${PAYMENT_STATUS[o.paymentStatus].tone}`}>{PAYMENT_STATUS[o.paymentStatus].label}</span>
                        </td>
                        <td className="a-right a-num">{money(o.total - o.refundedTotal, o.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          {manage && !anon && (
            <Panel title="Daten bearbeiten" className="a-panel--form">
              <CustomerForm current={c} />
            </Panel>
          )}
        </div>

        <div className="a-stack">
          <Panel title="Adressen" description="Im Kundenkonto gespeicherte Adressen.">
            {addresses.length === 0 ? (
              <p className="a-muted a-small0">Keine gespeicherten Adressen.</p>
            ) : (
              <ul className="a-stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {addresses.map((ad) => (
                  <li key={ad.id}>
                    <address style={{ fontStyle: "normal" }}>
                      {ad.label && <strong>{ad.label}</strong>}
                      {addressLines(ad.address).map((l) => (
                        <div key={l}>{l}</div>
                      ))}
                    </address>
                    <div className="a-inline">
                      {ad.isDefault && <span className="a-pill a-pill--muted">Standard</span>}
                      {manage && <ActionButton action={deleteAddressAction} fields={{ customerId: c.id, addressId: ad.id }} label="Entfernen" question="Diese Adresse entfernen?" />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {manage && !anon && (
            <div className="a-danger">
              <h3>Personendaten entfernen</h3>
              <p className="a-small a-muted">
                {stats.orders > 0
                  ? "Bestellungen müssen 10 Jahre aufbewahrt werden. «Anonymisieren» entfernt Name, Adresse, E-Mail und Telefon aus Kundenprofil und Bestellungen, Beträge bleiben."
                  : "Dieser Kunde hat keine Bestellungen und kann vollständig gelöscht werden."}
              </p>
              {stats.orders > 0 ? (
                <ActionButton action={anonymiseCustomerAction} fields={{ id: c.id }} label="Anonymisieren" variant="danger" question={`Personendaten von ${name} unwiderruflich entfernen?`} />
              ) : (
                <ActionButton action={deleteCustomerAction} fields={{ id: c.id }} label="Kunde löschen" variant="danger" question={`${name} endgültig löschen?`} />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
