"use client";

import { useState } from "react";
import { ActionForm, Submit } from "@/components/admin/forms";
import { Icon } from "@/components/admin/kit";
import { saveMenusAction } from "./actions";

type Item = { label: string; url: string };
type Menus = { header: Item[]; footer: Item[] };

/** Two menus (header, footer): rows with label and target, reorder, add from suggestions. */
export function MenuEditor({ initial, auto, suggestions }: { initial: Menus; auto: Menus; suggestions: Item[] }) {
  const [menus, setMenus] = useState<Menus>(initial);
  const set = (which: keyof Menus, list: Item[]) => setMenus((m) => ({ ...m, [which]: list }));

  return (
    <ActionForm action={saveMenusAction} className="mn-form">
      <input type="hidden" name="menus" value={JSON.stringify(menus)} />
      <div className="mn-grid">
        {(["header", "footer"] as const).map((which) => {
          const list = menus[which];
          const isAuto = list.length === 0;
          return (
            <section key={which} className="a-panel mn-menu" aria-labelledby={`mn-${which}`}>
              <div className="a-panel__head">
                <div>
                  <h2 id={`mn-${which}`}>{which === "header" ? "Hauptmenü (oben)" : "Fusszeile (unten)"}</h2>
                  <p className="a-panel__desc">{isAuto ? "Automatisch – so sieht es gerade aus:" : `${list.length} Menüpunkt${list.length === 1 ? "" : "e"}`}</p>
                </div>
                {isAuto ? (
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => set(which, auto[which].length ? auto[which] : [{ label: "Start", url: "/" }])}>
                    <Icon name="edit" size={15} />
                    Selbst festlegen
                  </button>
                ) : (
                  <button type="button" className="a-btn a-btn--quiet a-btn--sm" onClick={() => set(which, [])}>
                    Wieder automatisch
                  </button>
                )}
              </div>
              {isAuto ? (
                <ul className="mn-auto">
                  {auto[which].length ? auto[which].map((i) => <li key={i.url + i.label}>{i.label}</li>) : <li className="a-muted">Keine Einträge</li>}
                </ul>
              ) : (
                <ol className="mn-rows">
                  {list.map((it, i) => (
                    <li key={i} className="mn-row">
                      <span className="mn-row__n" aria-hidden="true">
                        {i + 1}
                      </span>
                      <label className="a-field">
                        <span className="sr-only">Beschriftung {i + 1}</span>
                        <input value={it.label} maxLength={60} placeholder="Beschriftung" onChange={(e) => set(which, list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                      </label>
                      <label className="a-field">
                        <span className="sr-only">Ziel {i + 1}</span>
                        <input value={it.url} maxLength={500} placeholder="/seite oder https://…" spellCheck={false} onChange={(e) => set(which, list.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                      </label>
                      <div className="mn-row__actions">
                        <button type="button" className="a-btn a-btn--quiet a-btn--sm" disabled={i === 0} aria-label={`«${it.label}» nach oben`} onClick={() => set(which, swap(list, i, i - 1))}>
                          ↑
                        </button>
                        <button type="button" className="a-btn a-btn--quiet a-btn--sm" disabled={i === list.length - 1} aria-label={`«${it.label}» nach unten`} onClick={() => set(which, swap(list, i, i + 1))}>
                          ↓
                        </button>
                        <button type="button" className="a-btn a-btn--quiet a-btn--sm" aria-label={`«${it.label}» entfernen`} onClick={() => set(which, list.filter((_, j) => j !== i))}>
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {!isAuto && list.length < 12 && (
                <div className="mn-add">
                  <p className="a-small0 a-muted">Hinzufügen:</p>
                  <div className="mn-add__chips">
                    {suggestions
                      .filter((s) => !list.some((x) => x.url === s.url))
                      .map((s) => (
                        <button key={s.url} type="button" className="a-chip" onClick={() => set(which, [...list, s])}>
                          <Icon name="plus" size={13} />
                          {s.label}
                        </button>
                      ))}
                    <button type="button" className="a-chip" onClick={() => set(which, [...list, { label: "", url: "" }])}>
                      <Icon name="plus" size={13} />
                      Eigener Link
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="a-savebar px-savebar">
        <Submit>Menüs speichern</Submit>
      </div>
    </ActionForm>
  );
}

function swap<T>(list: T[], a: number, b: number) {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
