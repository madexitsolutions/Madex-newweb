import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm, Submit } from "@/components/admin/forms";
import { Empty, Icon, PageHeader, Panel, one } from "@/components/admin/kit";
import { number, relative } from "@/lib/format";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { listNotFound, listRedirects } from "@/server/site/redirects";
import { clearNotFoundAction, deleteRedirectAction, saveRedirectAction } from "./actions";
import "../../system.css";
import "../seiten/website.css";

export const metadata = { title: "Weiterleitungen" };

export default async function RedirectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("seo.manage");
  await requireModule("redirects");
  const sp = await searchParams;
  const [rows, missing] = await Promise.all([listRedirects(), listNotFound(30)]);
  const editing = rows.find((r) => r.id === one(sp.bearbeiten)) ?? null;
  const prefill = one(sp.von);

  return (
    <>
      <PageHeader title="Weiterleitungen" description="Leitet alte Adressen auf neue weiter – zum Beispiel nach einem Relaunch, damit Links und Google-Treffer weiter funktionieren. Unten sehen Sie, welche Adressen Besucher vergeblich aufgerufen haben." />
      {one(sp.gespeichert) === "1" && (
        <p className="a-alert a-alert--ok" role="status">
          Weiterleitung gespeichert.
        </p>
      )}
      <div className="s-twocol">
        <Panel title="Weiterleitungen" description={`${rows.length} aktiv`} flush>
          {rows.length === 0 ? (
            <Empty icon="shuffle" title="Noch keine Weiterleitungen">
              Fügen Sie rechts die erste hinzu – oder übernehmen Sie unten eine Adresse, die nicht gefunden wurde.
            </Empty>
          ) : (
            <div className="a-tablewrap">
              <table className="a-table a-table--stack">
                <thead>
                  <tr>
                    <th scope="col">Alte Adresse</th>
                    <th scope="col">Ziel</th>
                    <th scope="col" className="a-num">
                      Aufrufe
                    </th>
                    <th scope="col">
                      <span className="sr-only">Aktionen</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="ws-path">{r.fromPath}</span>
                        <small>{r.permanent ? "301 · dauerhaft" : "302 · vorübergehend"}</small>
                      </td>
                      <td data-label="Ziel">
                        <span className="ws-path">{r.toUrl}</span>
                      </td>
                      <td data-label="Aufrufe" className="a-num">
                        {number(r.hits)}
                        {r.lastHitAt && <small>{relative(r.lastHitAt)}</small>}
                      </td>
                      <td className="s-rowactions">
                        <Link href={`/madexadm/weiterleitungen?bearbeiten=${r.id}`} className="a-btn a-btn--quiet a-btn--sm" scroll={false}>
                          Bearbeiten
                        </Link>
                        <ActionButton action={deleteRedirectAction} fields={{ id: r.id }} label="Löschen" variant="quiet" question={`Weiterleitung von ${r.fromPath} löschen?`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title={editing ? "Weiterleitung bearbeiten" : "Neue Weiterleitung"}>
          <ActionForm action={saveRedirectAction} className="ws-redirectform" resetOnSuccess={!editing} key={editing?.id ?? prefill ?? "neu"}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <label className="a-field">
              <span>Alte Adresse</span>
              <input name="from" defaultValue={editing?.fromPath ?? prefill} placeholder="/alte-seite" required spellCheck={false} />
            </label>
            <label className="a-field">
              <span>Neues Ziel</span>
              <input name="to" defaultValue={editing?.toUrl ?? ""} placeholder="/neue-seite oder https://…" required spellCheck={false} />
            </label>
            <label className="a-field">
              <span>Art</span>
              <select name="type" defaultValue={editing && !editing.permanent ? "302" : "301"}>
                <option value="301">Dauerhaft (301) – für umgezogene Seiten</option>
                <option value="302">Vorübergehend (302) – z. B. für Aktionen</option>
              </select>
            </label>
            <div className="ws-formfoot">
              <Submit>{editing ? "Speichern" : "Hinzufügen"}</Submit>
              {editing && (
                <Link href="/madexadm/weiterleitungen" className="a-btn a-btn--quiet">
                  Abbrechen
                </Link>
              )}
            </div>
          </ActionForm>
        </Panel>
      </div>
      <Panel
        title="Nicht gefundene Adressen (404)"
        description="Adressen, die Besucher aufgerufen haben, die es nicht gibt. Leiten Sie häufige davon weiter."
        flush
        action={missing.length > 0 && <ActionButton action={clearNotFoundAction} fields={{ all: "1" }} label="Liste leeren" variant="quiet" question="Alle Einträge entfernen?" />}
      >
        {missing.length === 0 ? (
          <p className="a-muted st-pad ws-pad">Bisher wurde keine fehlende Adresse aufgerufen.</p>
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th scope="col">Adresse</th>
                  <th scope="col" className="a-num">
                    Aufrufe
                  </th>
                  <th scope="col">Zuletzt</th>
                  <th scope="col">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {missing.map((m) => (
                  <tr key={m.path}>
                    <td>
                      <span className="ws-path">{m.path}</span>
                      {m.referrer && <small>von {m.referrer}</small>}
                    </td>
                    <td data-label="Aufrufe" className="a-num">
                      {number(m.hits)}
                    </td>
                    <td data-label="Zuletzt">{relative(m.lastAt)}</td>
                    <td className="s-rowactions">
                      <Link href={`/madexadm/weiterleitungen?von=${encodeURIComponent(m.path)}`} className="a-btn a-btn--ghost a-btn--sm" scroll={false}>
                        <Icon name="shuffle" size={14} />
                        Weiterleiten
                      </Link>
                      <ActionButton action={clearNotFoundAction} fields={{ path: m.path }} label="Ignorieren" variant="quiet" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
