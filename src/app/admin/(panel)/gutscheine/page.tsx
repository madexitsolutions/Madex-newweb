import Form from "next/form";
import Link from "next/link";
import "../../shop.css";
import { ActionButton } from "@/components/admin/action-button";
import { Drawer } from "@/components/admin/drawer";
import { Empty, Icon, one, PageHeader, Pager, Panel, qs, Tabs } from "@/components/admin/kit";
import { date, money } from "@/lib/format";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { products } from "@/server/db/schema";
import { categoryTree } from "@/server/shop/categories";
import { COUPON_STATUS_LABEL, COUPON_STATUS_PILL, couponValueLabel, getCoupon, listCoupons, type CouponStatus } from "@/server/shop/coupons";
import { asc } from "drizzle-orm";
import { deleteCouponAction, toggleCouponAction } from "./actions";
import { CouponForm } from "./form";

export const metadata = { title: "Gutscheine" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const STATUSES: CouponStatus[] = ["active", "scheduled", "expired", "used_up", "inactive"];

export default async function CouponsPage({ searchParams }: { searchParams: SP }) {
  await requirePermission("discounts.manage");
  await requireModule("shop");
  const sp = await searchParams;
  const q = one(sp.q);
  const status = (STATUSES.includes(one(sp.status) as CouponStatus) ? one(sp.status) : "") as CouponStatus | "";
  const page = Math.max(1, Number(one(sp.seite)) || 1);
  const edit = one(sp.bearbeiten);
  const meldung = one(sp.meldung);
  const data = await listCoupons({ q, status, page });
  const href = (o: Record<string, string | number>) => `/admin/gutscheine${qs({ q, status, ...o })}`;
  const current = edit && edit !== "neu" ? await getCoupon(edit) : null;
  const open = edit === "neu" || Boolean(current);
  const [productList, tree] = open ? await Promise.all([db.select({ id: products.id, name: products.name }).from(products).orderBy(asc(products.name)), categoryTree()]) : [[], []];
  const closeHref = href({ seite: page > 1 ? page : "" });

  const tabs = [{ key: "", label: "Alle", count: data.counts.all }, ...STATUSES.map((k) => ({ key: k, label: COUPON_STATUS_LABEL[k], count: data.counts[k] }))].map((t) => ({ ...t, href: href({ status: t.key }) }));

  return (
    <>
      <PageHeader
        title="Gutscheine"
        description="Rabattcodes für den Shop: Prozent, fester Betrag oder Gratisversand, mit Laufzeit und Nutzungsgrenzen."
        actions={
          <Link href={href({ bearbeiten: "neu" })} className="a-btn a-btn--primary" scroll={false}>
            <Icon name="plus" size={16} />
            Gutschein erstellen
          </Link>
        }
      />
      {meldung && (
        <p className="a-alert a-alert--ok" role="status">
          {meldung}
        </p>
      )}
      <Tabs items={tabs} active={status} label="Status" />
      <Panel flush>
        <Form action="/admin/gutscheine" className="a-toolbar">
          <div className="a-toolbar__row">
            {status && <input type="hidden" name="status" value={status} />}
            <label className="a-field a-field--grow">
              <span className="sr-only">Suchen</span>
              <input type="search" name="q" defaultValue={q} placeholder="Code oder Beschreibung suchen …" />
            </label>
            <button type="submit" className="a-btn a-btn--ghost">
              Suchen
            </button>
          </div>
        </Form>
        {data.rows.length === 0 ? (
          q || status ? (
            <Empty icon="search" title="Keine passenden Gutscheine" action={<Link href="/admin/gutscheine" className="a-btn a-btn--ghost">Filter zurücksetzen</Link>} />
          ) : (
            <Empty icon="percent" title="Noch keine Gutscheine" action={<Link href={href({ bearbeiten: "neu" })} className="a-btn a-btn--primary">Ersten Gutschein erstellen</Link>}>
              Mit einem Code wie WILLKOMMEN10 belohnen Sie Erstbestellungen oder bewerben eine Aktion.
            </Empty>
          )
        ) : (
          <div className="a-tablewrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Rabatt</th>
                  <th>Status</th>
                  <th className="a-right">Genutzt</th>
                  <th>Gültig</th>
                  <th>
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={href({ bearbeiten: c.id, seite: page > 1 ? page : "" })} scroll={false} className="a-link">
                        <strong className="a-mono-cell">{c.code}</strong>
                      </Link>
                      {c.description && <div className="a-small a-muted">{c.description}</div>}
                    </td>
                    <td>
                      {couponValueLabel(c)}
                      {c.minSubtotal ? <div className="a-small a-muted">ab {money(c.minSubtotal)}</div> : null}
                    </td>
                    <td>
                      <span className={`a-pill a-pill--${COUPON_STATUS_PILL[c.status]}`}>{COUPON_STATUS_LABEL[c.status]}</span>
                    </td>
                    <td className="a-right a-num">
                      {c.usedCount}
                      {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                    </td>
                    <td className="a-small">
                      {c.startsAt || c.endsAt ? `${c.startsAt ? date(c.startsAt) : "sofort"} – ${c.endsAt ? date(c.endsAt) : "unbegrenzt"}` : "unbegrenzt"}
                    </td>
                    <td className="a-right">
                      <ActionButton action={toggleCouponAction} fields={{ id: c.id, active: c.active ? "0" : "1" }} label={c.active ? "Deaktivieren" : "Aktivieren"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={data.page} pages={data.pages} total={data.total} from={(data.page - 1) * data.perPage + 1} to={(data.page - 1) * data.perPage + data.rows.length} href={(p) => href({ seite: p })} />
      </Panel>

      {open && (
        <Drawer closeHref={closeHref} title={current ? `Gutschein ${current.code}` : "Neuer Gutschein"} subtitle={current ? `${current.usedCount}× eingelöst` : undefined}>
          <CouponForm
            key={current?.id ?? "neu"}
            current={current}
            categories={tree.map((c) => ({ id: c.id, label: c.name, depth: c.depth }))}
            products={productList.map((p) => ({ id: p.id, label: p.name }))}
          />
          {current && (
            <div className="a-danger">
              <h3>Gutschein löschen</h3>
              <p className="a-small a-muted">Bestellungen, in denen der Code verwendet wurde, behalten ihren Rabatt. Zum vorübergehenden Stoppen besser deaktivieren.</p>
              <ActionButton action={deleteCouponAction} fields={{ id: current.id }} label="Gutschein löschen" variant="danger" question={`Gutschein ${current.code} endgültig löschen?`} />
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}
