import Form from "next/form";
import Link from "next/link";
import "../../shop.css";
import { AutoSelect, BulkBar } from "@/components/admin/shop-ui";
import { Empty, Icon, one, PageHeader, Pager, qs, Tabs } from "@/components/admin/kit";
import { money } from "@/lib/format";
import { STATUS_LABEL, STATUS_PILL, type ProductStatus } from "@/lib/catalog";
import { can, requirePermission } from "@/server/auth/session";
import { requireModule } from "@/modules/registry";
import { listProducts, PRODUCT_SORTS, type ProductSort } from "@/server/shop/catalog";
import { categoryTree } from "@/server/shop/categories";
import { bulkProductsAction } from "./actions";

export const metadata = { title: "Produkte" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePermission("products.view");
  await requireModule("shop");
  const sp = await searchParams;
  const q = one(sp.q);
  const status = (["active", "draft", "archived"].includes(one(sp.status)) ? one(sp.status) : "") as ProductStatus | "";
  const kategorie = one(sp.kategorie);
  const lager = (["out", "low"].includes(one(sp.lager)) ? one(sp.lager) : "") as "out" | "low" | "";
  const sort = (one(sp.sort) in PRODUCT_SORTS ? one(sp.sort) : "updated") as ProductSort;
  const page = Math.max(1, Number(one(sp.seite)) || 1);
  const meldung = one(sp.meldung);
  const manage = can(user, "products.manage");

  const [data, tree] = await Promise.all([listProducts({ q, status, categoryId: kategorie || undefined, stock: lager, sort, page }), categoryTree()]);
  const base = { q, status, kategorie, lager, sort: sort === "updated" ? "" : sort };
  const href = (o: Record<string, string | number>) => `/admin/produkte${qs({ ...base, ...o })}`;
  const filtered = Boolean(q || kategorie || lager);
  const tabs = [
    { key: "", label: "Alle", count: data.counts.all },
    { key: "active", label: "Aktiv", count: data.counts.active },
    { key: "draft", label: "Entwurf", count: data.counts.draft },
    { key: "archived", label: "Archiviert", count: data.counts.archived },
  ].map((t) => ({ ...t, href: href({ status: t.key, seite: "" }) }));

  return (
    <>
      <PageHeader
        title="Produkte"
        description="Sortiment mit Varianten, Preisen und Lagerbestand. Aktive Produkte erscheinen im Shop."
        actions={
          <>
            {manage && (
              <Link href="/admin/produkte/import" className="a-btn a-btn--ghost">
                <Icon name="upload" size={16} />
                Importieren
              </Link>
            )}
            <a href={`/admin/produkte/export`} className="a-btn a-btn--ghost" download>
              <Icon name="download" size={16} />
              Exportieren
            </a>
            {manage && (
              <Link href="/admin/produkte/neu" className="a-btn a-btn--primary">
                <Icon name="plus" size={16} />
                Produkt erstellen
              </Link>
            )}
          </>
        }
      />
      {meldung && (
        <p className="a-alert a-alert--ok" role="status">
          <Icon name="check" size={16} />
          {meldung}
        </p>
      )}

      <Tabs items={tabs} active={status} label="Status" />

      <Form action="/admin/produkte" className="s-toolbar" scroll={false} replace>
        {status && <input type="hidden" name="status" value={status} />}
        <label className="a-search">
          <Icon name="search" size={16} />
          <span className="sr-only">Produkte durchsuchen</span>
          <input type="search" name="q" defaultValue={q} placeholder="Name, Artikelnummer, Hersteller …" />
        </label>
        <AutoSelect name="kategorie" defaultValue={kategorie} label="Kategorie">
          <option value="">Alle Kategorien</option>
          {tree.map((c) => (
            <option key={c.id} value={c.id}>
              {"  ".repeat(c.depth)}
              {c.name}
            </option>
          ))}
        </AutoSelect>
        <AutoSelect name="lager" defaultValue={lager} label="Lager">
          <option value="">Jeder Lagerbestand</option>
          <option value="low">Niedriger Bestand (≤ {data.lowStockThreshold})</option>
          <option value="out">Ausverkauft</option>
        </AutoSelect>
        <AutoSelect name="sort" defaultValue={sort} label="Sortierung">
          {Object.entries(PRODUCT_SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </AutoSelect>
        <button type="submit" className="a-btn a-btn--ghost">
          Suchen
        </button>
      </Form>
      {filtered && (
        <p className="a-activefilter">
          {data.total} Treffer{q ? ` für «${q}»` : ""}
          <Link href={`/admin/produkte${qs({ status })}`} aria-label="Filter zurücksetzen">
            <Icon name="close" size={14} />
          </Link>
        </p>
      )}

      <section className="a-panel a-panel--flush">
        {data.rows.length === 0 ? (
          filtered || status ? (
            <Empty icon="search" title="Keine Produkte gefunden" action={<Link href="/admin/produkte" className="a-btn a-btn--ghost">Alle Produkte anzeigen</Link>}>
              Ändern Sie die Suche oder die Filter.
            </Empty>
          ) : (
            <Empty
              icon="box"
              title="Noch keine Produkte"
              action={
                manage ? (
                  <div className="a-inline">
                    <Link href="/admin/produkte/neu" className="a-btn a-btn--primary">
                      Erstes Produkt erstellen
                    </Link>
                    <Link href="/admin/produkte/import" className="a-btn a-btn--ghost">
                      Aus WooCommerce importieren
                    </Link>
                  </div>
                ) : undefined
              }
            >
              Erstellen Sie Ihr erstes Produkt oder importieren Sie Ihr Sortiment als CSV-Datei (z. B. aus WooCommerce).
            </Empty>
          )
        ) : (
          <form action={bulkProductsAction}>
            <input type="hidden" name="back" value={href({ seite: page > 1 ? page : "" })} />
            {manage && (
              <BulkBar
                noun={["Produkt", "Produkte"]}
                actions={[
                  { value: "activate", label: "Aktivieren" },
                  { value: "draft", label: "Als Entwurf" },
                  { value: "archive", label: "Archivieren" },
                  { value: "delete", label: "Löschen", danger: true, confirm: "{n} Produkte endgültig löschen? Bestellungen bleiben erhalten, das lässt sich aber nicht rückgängig machen." },
                ]}
              />
            )}
            <div className="a-tablewrap">
              <table className="a-table a-table--stack">
                <thead>
                  <tr>
                    {manage && (
                      <th className="s-check">
                        <label>
                          <input type="checkbox" data-select-all aria-label="Alle Produkte dieser Seite auswählen" />
                        </label>
                      </th>
                    )}
                    <th>Produkt</th>
                    <th>Status</th>
                    <th>Lager</th>
                    <th className="a-num">Preis</th>
                    <th>Kategorien</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((p) => {
                    const s = p.stock;
                    const stock =
                      s.tracked === 0 ? (
                        <span className="a-muted">Nicht erfasst</span>
                      ) : s.out === s.tracked ? (
                        <span className="s-stock--out">Ausverkauft</span>
                      ) : (
                        <span className={s.out ? "s-stock--out" : s.low ? "s-stock--low" : undefined}>
                          {s.total} an Lager
                          {s.variants > 1 && (
                            <small>
                              {s.variants} Varianten{s.out ? `, ${s.out} ausverkauft` : s.low ? `, ${s.low} knapp` : ""}
                            </small>
                          )}
                        </span>
                      );
                    return (
                      <tr key={p.id}>
                        {manage && (
                          <td className="s-check">
                            <label>
                              <input type="checkbox" name="ids" value={p.id} aria-label={`${p.name} auswählen`} />
                            </label>
                          </td>
                        )}
                        <td>
                          <div className="s-prodcell">
                            {p.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image.url} alt="" className="a-thumb" loading="lazy" />
                            ) : (
                              <span className="s-noimg" aria-hidden="true">
                                <Icon name="image" size={18} />
                              </span>
                            )}
                            <div>
                              <Link href={`/admin/produkte/${p.id}`} className="a-rowlink">
                                {p.name}
                              </Link>
                              <small>
                                {p.vendor ? `${p.vendor} · ` : ""}
                                {p.featured ? "Hervorgehoben · " : ""}/{p.slug}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td data-label="Status">
                          <span className={`a-pill a-pill--${STATUS_PILL[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                        </td>
                        <td data-label="Lager">{stock}</td>
                        <td className="a-num a-nowrap" data-label="Preis">
                          {p.priceMin === p.priceMax ? money(p.priceMin) : `${money(p.priceMin)} – ${money(p.priceMax)}`}
                        </td>
                        <td data-label="Kategorien">
                          <div className="s-cats" title={p.categories.map((c) => c.name).join(", ")}>
                            {p.categories.length ? p.categories.map((c) => c.name).join(", ") : <span className="a-muted">–</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </form>
        )}
        <Pager page={data.page} pages={data.pages} total={data.total} from={(data.page - 1) * data.perPage + 1} to={Math.min(data.total, data.page * data.perPage)} href={(n) => href({ seite: n > 1 ? n : "" })} />
      </section>
    </>
  );
}
