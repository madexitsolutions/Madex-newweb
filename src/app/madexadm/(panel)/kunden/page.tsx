import Form from "next/form";
import Link from "next/link";
import "../../shop.css";
import { AutoSelect } from "@/components/admin/shop-ui";
import { Empty, Icon, one, PageHeader, Pager, Panel, qs, Tabs } from "@/components/admin/kit";
import { date, money } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/session";
import { requireModule } from "@/modules/registry";
import { CUSTOMER_SORTS, customerTags, isAnonymised, listCustomers } from "@/server/shop/customers";
import { customerParams } from "./params";

export const metadata = { title: "Kunden" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomersPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePermission("customers.view");
  await requireModule("shop");
  const sp = await searchParams;
  const p = customerParams(sp);
  const meldung = one(sp.meldung);
  const [data, tags] = await Promise.all([listCustomers(p), customerTags()]);
  const base = { q: p.q, konto: p.account, newsletter: p.newsletter, tag: p.tag, sort: p.sort === "recent" ? "" : p.sort };
  const href = (o: Record<string, string | number>) => `/madexadm/kunden${qs({ ...base, ...o })}`;
  const filtered = Boolean(p.q || p.newsletter || p.tag);
  const tabs = [
    { key: "", label: "Alle", count: data.totals.all },
    { key: "konto", label: "Mit Kundenkonto", count: data.totals.accounts },
    { key: "gast", label: "Gäste", count: data.totals.all - data.totals.accounts },
  ].map((t) => ({ ...t, href: href({ konto: t.key, seite: "" }) }));

  return (
    <>
      <PageHeader
        title="Kunden"
        description="Alle, die bestellt oder ein Kundenkonto eröffnet haben. Umsatz zählt bezahlte Bestellungen abzüglich Rückerstattungen."
        actions={
          <>
            <a href={`/madexadm/kunden/export${qs({ ...base })}`} className="a-btn a-btn--ghost">
              <Icon name="download" size={16} />
              CSV exportieren
            </a>
            {can(user, "customers.manage") && (
              <Link href="/madexadm/kunden/neu" className="a-btn a-btn--primary">
                <Icon name="plus" size={16} />
                Kunde erfassen
              </Link>
            )}
          </>
        }
      />
      {meldung && (
        <p className="a-alert a-alert--ok" role="status">
          {meldung}
        </p>
      )}
      <Tabs items={tabs} active={p.account} label="Kundenart" />
      <Panel flush>
        <Form action="/madexadm/kunden" className="a-toolbar">
          <div className="a-toolbar__row">
            {p.account && <input type="hidden" name="konto" value={p.account} />}
            <label className="a-field a-field--grow">
              <span className="sr-only">Suchen</span>
              <input type="search" name="q" defaultValue={p.q} placeholder="Name, E-Mail oder Telefon …" />
            </label>
            <AutoSelect name="newsletter" defaultValue={p.newsletter} label="Newsletter">
              <option value="">Newsletter: alle</option>
              <option value="ja">Newsletter erlaubt</option>
              <option value="nein">Kein Newsletter</option>
            </AutoSelect>
            {tags.length > 0 && (
              <AutoSelect name="tag" defaultValue={p.tag} label="Tag">
                <option value="">Alle Tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </AutoSelect>
            )}
            <AutoSelect name="sort" defaultValue={p.sort} label="Sortierung">
              {Object.entries(CUSTOMER_SORTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </AutoSelect>
            <button type="submit" className="a-btn a-btn--ghost">
              Suchen
            </button>
          </div>
        </Form>
        {data.rows.length === 0 ? (
          filtered || p.account ? (
            <Empty icon="search" title="Keine passenden Kunden" action={<Link href="/madexadm/kunden" className="a-btn a-btn--ghost">Filter zurücksetzen</Link>} />
          ) : (
            <Empty icon="users" title="Noch keine Kunden">
              Kunden erscheinen hier automatisch mit ihrer ersten Bestellung oder wenn sie im Shop ein Konto eröffnen.
            </Empty>
          )
        ) : (
          <div className="a-tablewrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Kunde</th>
                  <th>Ort</th>
                  <th className="a-right">Bestellungen</th>
                  <th className="a-right">Umsatz</th>
                  <th>Letzte Bestellung</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((c) => {
                  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/madexadm/kunden/${c.id}`} className="a-link">
                          <strong>{isAnonymised(c) ? "Anonymisiert" : name || c.email}</strong>
                        </Link>
                        <div className="a-small a-muted">
                          {name && !isAnonymised(c) ? c.email : null}
                          {c.hasAccount && <span className="a-pill a-pill--accent" style={{ marginLeft: name ? 8 : 0 }}>Konto</span>}
                          {c.disabled && <span className="a-pill a-pill--bad" style={{ marginLeft: 8 }}>Gesperrt</span>}
                        </div>
                      </td>
                      <td>{c.city ?? "–"}</td>
                      <td className="a-right a-num">{c.ordersCount}</td>
                      <td className="a-right a-num">{money(c.totalSpent)}</td>
                      <td>{c.lastOrderAt ? date(c.lastOrderAt) : <span className="a-muted">–</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={data.page} pages={data.pages} total={data.total} from={(data.page - 1) * data.perPage + 1} to={(data.page - 1) * data.perPage + data.rows.length} href={(n) => href({ seite: n })} />
      </Panel>
    </>
  );
}
