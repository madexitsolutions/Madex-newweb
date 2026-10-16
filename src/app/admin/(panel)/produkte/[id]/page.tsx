import Link from "next/link";
import { notFound } from "next/navigation";
import "../../../shop.css";
import { ConfirmForm, Submit } from "@/components/admin/forms";
import { Empty, Icon, one, PageHeader, Panel, Tabs } from "@/components/admin/kit";
import { dateTime, relative } from "@/lib/format";
import { STATUS_LABEL, STATUS_PILL } from "@/lib/catalog";
import { can, requirePermission } from "@/server/auth/session";
import { requireModule } from "@/modules/registry";
import { getProduct, stockHistory, STOCK_REASON_LABEL } from "@/server/shop/catalog";
import { deleteProductAction, duplicateProductAction } from "../actions";
import { ProductEditor } from "../editor";
import { editorContext } from "../shared";

export const metadata = { title: "Produkt bearbeiten" };

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("products.view");
  await requireModule("shop");
  const { id } = await params;
  const sp = await searchParams;
  const full = await getProduct(id);
  if (!full) notFound();
  const { product: p } = full;
  const manage = can(user, "products.manage");
  const variantFilter = full.variants.some((v) => v.id === one(sp.variante)) ? one(sp.variante) : "";
  const [ctx, history] = await Promise.all([editorContext(), stockHistory(p.id, { variantId: variantFilter || undefined, limit: 30 })]);
  const saved = one(sp.gespeichert);
  const meldung = one(sp.meldung);
  const shopUrl = `${ctx.shopBase}/produkt/${p.slug}`;

  return (
    <>
      <PageHeader
        title={p.name}
        crumb={{ href: "/admin/produkte", label: "Produkte" }}
        meta={<span className={`a-pill a-pill--lg a-pill--${STATUS_PILL[p.status]}`}>{STATUS_LABEL[p.status]}</span>}
        description={`Zuletzt geändert ${relative(p.updatedAt)} · ${full.variants.length} Variante${full.variants.length === 1 ? "" : "n"}`}
        actions={
          <>
            {ctx.storefront && p.status === "active" && (
              <a href={`/produkt/${p.slug}`} target="_blank" rel="noopener" className="a-btn a-btn--ghost">
                <Icon name="external" size={16} />
                Im Shop ansehen
              </a>
            )}
            {manage && (
              <form action={duplicateProductAction}>
                <input type="hidden" name="id" value={p.id} />
                <Submit variant="ghost" pending="Wird kopiert …">
                  <Icon name="copy" size={16} />
                  Duplizieren
                </Submit>
              </form>
            )}
            {manage && (
              <ConfirmForm action={deleteProductAction} label="Löschen" question={`«${p.name}» endgültig löschen? Bestellungen mit diesem Produkt bleiben erhalten.`}>
                <input type="hidden" name="id" value={p.id} />
              </ConfirmForm>
            )}
          </>
        }
      />
      {(saved || meldung) && (
        <p className="a-alert a-alert--ok" role="status">
          <Icon name="check" size={16} />
          {meldung || "Änderungen gespeichert."}
          {saved && p.status === "active" && ctx.storefront ? (
            <>
              {" "}
              <a href={`/produkt/${p.slug}`} target="_blank" rel="noopener">
                Im Shop ansehen
              </a>
            </>
          ) : null}
        </p>
      )}
      {!manage && <p className="a-alert a-alert--error">Sie können dieses Produkt nur ansehen. Zum Bearbeiten brauchen Sie das Recht «Produkte bearbeiten».</p>}
      {p.status !== "active" && manage && <p className="a-muted a-small0">Dieses Produkt ist im Shop nicht sichtbar ({STATUS_LABEL[p.status]}). Adresse nach dem Aktivieren: {shopUrl}</p>}

      <fieldset disabled={!manage} className="s-fieldset">
        <ProductEditor
          key={p.updatedAt.toISOString()}
          product={{
            id: p.id,
            name: p.name,
            slug: p.slug,
            status: p.status,
            type: p.type,
            shortDescription: p.shortDescription,
            description: p.description,
            vendor: p.vendor,
            tags: p.tags,
            featured: p.featured,
            taxClassId: p.taxClassId,
            seoTitle: p.seoTitle ?? "",
            seoDescription: p.seoDescription ?? "",
            categoryIds: full.categoryIds,
            images: full.images.map((i) => ({ mediaId: i.mediaId, url: i.url, alt: i.alt })),
            options: p.options,
            variants: full.variants.map((v) => ({
              id: v.id,
              optionValues: v.optionValues,
              sku: v.sku,
              barcode: v.barcode,
              price: v.price,
              compareAtPrice: v.compareAtPrice,
              costPrice: v.costPrice,
              stock: v.stock,
              trackInventory: v.trackInventory,
              allowBackorder: v.allowBackorder,
              weightGrams: v.weightGrams,
              imageId: v.imageId,
              active: v.active,
            })),
          }}
          taxClasses={ctx.taxClasses}
          tree={ctx.tree}
          shopBase={ctx.shopBase}
          lowStock={ctx.lowStock}
          pricesIncludeTax={ctx.pricesIncludeTax}
        />
      </fieldset>

      <Panel title="Lagerbewegungen" description="Jede Änderung am Bestand: Bestellungen, Stornos, Retouren, Importe und manuelle Korrekturen." flush id="lager">
        {full.variants.length > 1 && (
          <div style={{ padding: "0 22px" }}>
            <Tabs
              variant="segment"
              label="Variante"
              active={variantFilter}
              items={[{ key: "", label: "Alle", href: `/admin/produkte/${p.id}#lager` }, ...full.variants.map((v) => ({ key: v.id, label: v.title || "Standard", href: `/admin/produkte/${p.id}?variante=${v.id}#lager` }))]}
            />
          </div>
        )}
        {history.length === 0 ? (
          <Empty icon="list" title="Noch keine Lagerbewegungen">
            Sobald sich der Bestand durch Bestellungen oder eine Korrektur ändert, erscheint die Bewegung hier.
          </Empty>
        ) : (
          <div className="a-tablewrap" style={{ marginTop: 12 }}>
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th>Zeitpunkt</th>
                  {full.variants.length > 1 && <th>Variante</th>}
                  <th>Grund</th>
                  <th className="a-num">Änderung</th>
                  <th className="a-num">Bestand danach</th>
                  <th>Durch</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{dateTime(h.createdAt)}</td>
                    {full.variants.length > 1 && <td data-label="Variante">{h.variantTitle || "Standard"}</td>}
                    <td data-label="Grund">
                      {STOCK_REASON_LABEL[h.reason] ?? h.reason}
                      {h.reference && <small>{h.reference}</small>}
                    </td>
                    <td className="a-num" data-label="Änderung">
                      <span className={`s-delta ${h.delta > 0 ? "s-delta--up" : "s-delta--down"}`}>{h.delta > 0 ? `+${h.delta}` : h.delta}</span>
                    </td>
                    <td className="a-num" data-label="Bestand">
                      {h.stockAfter}
                    </td>
                    <td data-label="Durch">{h.userName ?? (h.reason === "order" ? "Shop" : "System")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {manage && (
        <p className="a-footnote">
          Bestand korrigieren: Lagerbestand oben ändern und speichern – die Differenz wird als manuelle Bewegung erfasst. <Link href="/admin/produkte?lager=low">Alle Produkte mit niedrigem Bestand</Link>
        </p>
      )}
    </>
  );
}
