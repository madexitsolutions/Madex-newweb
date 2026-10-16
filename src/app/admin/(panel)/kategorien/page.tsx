import Link from "next/link";
import "../../shop.css";
import "../../content.css";
import { ActionButton } from "@/components/admin/action-button";
import { Drawer } from "@/components/admin/drawer";
import { Empty, Icon, one, PageHeader, Panel } from "@/components/admin/kit";
import { requireModule, isModuleEnabled } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { categoryTree, descendantIds } from "@/server/shop/categories";
import { db } from "@/server/db";
import { media } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getSettings } from "@/server/settings";
import { deleteCategoryAction } from "./actions";
import { CategoryForm } from "./form";

export const metadata = { title: "Kategorien" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function CategoriesPage({ searchParams }: { searchParams: SP }) {
  await requirePermission("products.manage");
  await requireModule("shop");
  const sp = await searchParams;
  const edit = one(sp.bearbeiten);
  const tree = await categoryTree();
  const current = edit && edit !== "neu" ? tree.find((c) => c.id === edit) : undefined;
  const open = edit === "neu" || Boolean(current);
  const blocked = new Set(current ? [current.id, ...descendantIds(tree, current.id)] : []);
  const [general, storefront] = await Promise.all([getSettings("general"), isModuleEnabled("storefront")]);
  const image = current?.imageId ? (await db.select().from(media).where(eq(media.id, current.imageId)))[0] : undefined;
  const base = (storefront ? "" : general.siteUrl.replace(/\/$/, "")) || "";

  return (
    <>
      <PageHeader
        title="Kategorien"
        description="Gliedern Sie das Sortiment. Ein Produkt kann in mehreren Kategorien sein; Unterkategorien erscheinen eingerückt."
        actions={
          <Link href="/admin/kategorien?bearbeiten=neu" className="a-btn a-btn--primary" scroll={false}>
            <Icon name="plus" size={16} />
            Kategorie erstellen
          </Link>
        }
      />
      <Panel flush>
        {tree.length === 0 ? (
          <Empty icon="layers" title="Noch keine Kategorien" action={<Link href="/admin/kategorien?bearbeiten=neu" className="a-btn a-btn--primary">Erste Kategorie erstellen</Link>}>
            Kategorien helfen Kundinnen und Kunden, im Shop das Richtige zu finden – zum Beispiel «Bekleidung» mit «Damen» und «Herren».
          </Empty>
        ) : (
          <div className="a-tablewrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Kategorie</th>
                  <th>Adresse</th>
                  <th className="a-right">Produkte</th>
                  <th className="a-right">Reihenfolge</th>
                  <th>
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tree.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="a-cellmain" style={{ paddingLeft: c.depth * 22 }}>
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.imageUrl} alt="" className="a-thumb" />
                        ) : (
                          <span className="a-thumb" aria-hidden="true" />
                        )}
                        <div>
                          <Link href={`/admin/kategorien?bearbeiten=${c.id}`} scroll={false} className="a-link">
                            <strong>{c.name}</strong>
                          </Link>
                          {c.depth > 0 && <div className="a-small a-muted">{c.path.slice(0, -1).join(" › ")}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="a-muted">/{c.slug}</td>
                    <td className="a-right a-num">
                      <Link href={`/admin/produkte?kategorie=${c.id}`} className="a-link">
                        {c.productCount}
                      </Link>
                    </td>
                    <td className="a-right a-num">{c.sort}</td>
                    <td className="a-right">
                      <Link href={`/admin/kategorien?bearbeiten=${c.id}`} scroll={false} className="a-btn a-btn--ghost a-btn--sm">
                        Bearbeiten
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {open && (
        <Drawer closeHref="/admin/kategorien" title={current ? `«${current.name}» bearbeiten` : "Neue Kategorie"} subtitle={current ? `${current.productCount} Produkte · ${current.childCount} Unterkategorien` : undefined}>
          <CategoryForm
            key={current?.id ?? "neu"}
            current={current ? { id: current.id, name: current.name, slug: current.slug, parentId: current.parentId, sort: current.sort, description: current.description, seoTitle: current.seoTitle, seoDescription: current.seoDescription } : null}
            parents={tree.filter((c) => !blocked.has(c.id)).map((c) => ({ id: c.id, name: c.name, depth: c.depth }))}
            image={image ? { id: image.id, path: image.path, alt: image.alt, filename: image.filename, mime: image.mime } : null}
            url={`${base}/shop/kategorie/${current?.slug ?? "…"}`}
          />
          {current && (
            <div className="a-danger">
              <h3>Kategorie löschen</h3>
              <p className="a-small a-muted">Die Produkte bleiben erhalten und verlieren nur diese Zuordnung. Unterkategorien rücken eine Ebene nach oben.</p>
              <ActionButton action={deleteCategoryAction} fields={{ id: current.id }} label="Kategorie löschen" variant="danger" question={`Kategorie «${current.name}» wirklich löschen?`} />
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}
