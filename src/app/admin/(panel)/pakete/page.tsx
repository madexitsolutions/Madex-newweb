import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { listPackages, type Package } from "@/lib/server/packages";
import { removePackage, savePackageAction } from "../../actions";
import { ActionForm, ConfirmForm, Submit } from "../../ui";
import { Drawer } from "../../drawer";
import { Empty, Icon, PageHeader, one } from "../../kit";

export const metadata = { title: "Pakete" };

function Fields({ p }: { p?: Package }) {
  return (
    <>
      <div className="a-fields2 a-fields2--main">
        <label className="a-field">
          <span>Name</span>
          <input name="name" defaultValue={p?.name} required maxLength={80} placeholder="z. B. Starter" />
        </label>
        <label className="a-field">
          <span>Reihenfolge</span>
          <input name="order" type="number" defaultValue={p?.order ?? 50} min={0} max={999} />
        </label>
      </div>
      <label className="a-field">
        <span>Kurzbeschreibung</span>
        <input name="shortDescription" defaultValue={p?.shortDescription} maxLength={400} />
        <small>Ein Satz, den der Chat bei der Empfehlung zeigt.</small>
      </label>
      <label className="a-field">
        <span>Geeignet für</span>
        <input name="audience" defaultValue={p?.audience} maxLength={400} placeholder="z. B. Kleine Betriebe ohne eigene Website" />
      </label>
      <label className="a-field">
        <span>Leistungen</span>
        <textarea name="features" rows={8} defaultValue={p?.features.join("\n")} />
        <small>Eine Leistung pro Zeile.</small>
      </label>
      <label className="a-field">
        <span>Interne Notiz (nicht öffentlich)</span>
        <input name="internalNotes" defaultValue={p?.internalNotes} maxLength={2000} />
      </label>
      <label className="a-check a-check--box">
        <input type="checkbox" name="active" defaultChecked={p?.active ?? true} />
        <span>
          Im Paket-Finder des Chats anbieten
          <small>Inaktive Pakete bleiben gespeichert, werden aber nicht empfohlen.</small>
        </span>
      </label>
    </>
  );
}

export default async function Packages({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const items = await listPackages();
  const editing = one(sp.edit) ? items.find((p) => p.id === one(sp.edit)) : undefined;
  const adding = one(sp.neu) === "1";

  return (
    <>
      <PageHeader
        title="Pakete"
        description="Diese Pakete empfiehlt der Chat im Paket-Finder anhand der Ziele, der Website und der Grösse des Unternehmens."
        actions={
          <Link href="/admin/pakete?neu=1" scroll={false} className="a-btn a-btn--primary">
            <Icon name="plus" size={16} />
            Paket hinzufügen
          </Link>
        }
      />

      <section className="a-panel a-panel--flush">
        {items.length === 0 ? (
          <Empty
            icon="box"
            title="Noch keine Pakete"
            action={
              <Link href="/admin/pakete?neu=1" scroll={false} className="a-btn a-btn--primary">
                <Icon name="plus" size={16} />
                Erstes Paket anlegen
              </Link>
            }
          >
            Ohne Pakete kann der Chat keine Empfehlung abgeben und verweist an Ihr Team.
          </Empty>
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th>Paket</th>
                  <th>Geeignet für</th>
                  <th className="a-num">Leistungen</th>
                  <th className="a-num">Reihenfolge</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Aktion</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className={editing?.id === p.id ? "is-selected" : undefined}>
                    <td>
                      <Link href={`/admin/pakete?edit=${p.id}`} scroll={false} className="a-rowlink">
                        {p.name}
                      </Link>
                      {p.shortDescription && <small className="a-clip a-clip--wide">{p.shortDescription}</small>}
                    </td>
                    <td className="a-clip">{p.audience || <span className="a-muted">–</span>}</td>
                    <td className="a-num" data-label="Leistungen">{p.features.length}</td>
                    <td className="a-num a-muted" data-label="Reihenfolge">{p.order}</td>
                    <td>{p.active ? <span className="a-state a-state--ok">Im Chat aktiv</span> : <span className="a-state a-state--muted">Inaktiv</span>}</td>
                    <td className="a-actions">
                      <Link href={`/admin/pakete?edit=${p.id}`} scroll={false} className="a-btn a-btn--ghost a-btn--sm">
                        <Icon name="edit" size={15} />
                        Bearbeiten
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="a-footnote">Die Reihenfolge bestimmt, in welcher Abfolge der Chat Pakete vorschlägt (kleinere Zahl zuerst).</p>

      {adding && (
        <Drawer closeHref="/admin/pakete" title="Neues Paket">
          <ActionForm action={savePackageAction.bind(null, null)} className="a-seoform">
            <div className="a-seoform__body">
              <Fields />
            </div>
            <div className="a-savebar">
              <Submit>Hinzufügen</Submit>
              <Link href="/admin/pakete" scroll={false} className="a-btn a-btn--quiet">
                Abbrechen
              </Link>
            </div>
          </ActionForm>
        </Drawer>
      )}
      {editing && (
        <Drawer closeHref="/admin/pakete" title={editing.name} subtitle={`${editing.features.length} Leistungen · ${editing.active ? "im Chat aktiv" : "inaktiv"}`}>
          <ActionForm key={editing.id} action={savePackageAction.bind(null, editing.id)} className="a-seoform">
            <div className="a-seoform__body">
              <Fields p={editing} />
            </div>
            <div className="a-savebar">
              <Submit>Speichern</Submit>
            </div>
          </ActionForm>
          <div className="a-danger a-danger--inset">
            <div>
              <h2>Paket löschen</h2>
              <p>Der Chat empfiehlt es danach nicht mehr.</p>
            </div>
            <ConfirmForm action={removePackage.bind(null, editing.id)} label="Löschen" question={`Paket «${editing.name}» löschen?`} />
          </div>
        </Drawer>
      )}
    </>
  );
}
