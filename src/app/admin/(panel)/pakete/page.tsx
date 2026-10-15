import { listPackages, type Package } from "@/lib/server/packages";
import { removePackage, savePackageAction } from "../../actions";
import { ActionForm, ConfirmForm, Submit } from "../../ui";

export const metadata = { title: "Pakete" };

function Fields({ p }: { p?: Package }) {
  return (
    <>
      <div className="a-row">
        <label className="a-field a-field--grow">
          <span>Name</span>
          <input name="name" defaultValue={p?.name} required maxLength={80} />
        </label>
        <label className="a-field">
          <span>Reihenfolge</span>
          <input name="order" type="number" defaultValue={p?.order ?? 50} min={0} max={999} />
        </label>
      </div>
      <label className="a-field">
        <span>Kurzbeschreibung</span>
        <input name="shortDescription" defaultValue={p?.shortDescription} maxLength={400} />
      </label>
      <label className="a-field">
        <span>Geeignet für</span>
        <input name="audience" defaultValue={p?.audience} maxLength={400} />
      </label>
      <label className="a-field">
        <span>Leistungen (eine pro Zeile)</span>
        <textarea name="features" rows={8} defaultValue={p?.features.join("\n")} />
      </label>
      <label className="a-field">
        <span>Interne Notiz (nicht öffentlich)</span>
        <input name="internalNotes" defaultValue={p?.internalNotes} maxLength={2000} />
      </label>
      <label className="a-check">
        <input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> Im Paket-Finder des Chats anbieten
      </label>
    </>
  );
}

export default async function Packages() {
  const items = await listPackages();
  return (
    <>
      <header className="a-head">
        <h1>Pakete</h1>
        <p className="a-muted">Diese Pakete empfiehlt der Chat im Paket-Finder anhand der Ziele, der Website und der Grösse des Unternehmens.</p>
      </header>
      <details className="a-add">
        <summary className="a-btn a-btn--primary">Paket hinzufügen</summary>
        <ActionForm action={savePackageAction.bind(null, null)} className="a-stack a-card">
          <Fields />
          <div>
            <Submit>Hinzufügen</Submit>
          </div>
        </ActionForm>
      </details>
      <div className="a-stack">
        {items.map((p) => (
          <details key={p.id} className="a-item">
            <summary>
              <span>{p.name}</span>
              <small>
                {p.features.length} Leistungen{!p.active && ", inaktiv"}
              </small>
            </summary>
            <ActionForm action={savePackageAction.bind(null, p.id)} className="a-stack">
              <Fields p={p} />
              <div>
                <Submit>Speichern</Submit>
              </div>
            </ActionForm>
            <ConfirmForm action={removePackage.bind(null, p.id)} label="Paket löschen" question={`Paket «${p.name}» löschen?`} />
          </details>
        ))}
      </div>
    </>
  );
}
