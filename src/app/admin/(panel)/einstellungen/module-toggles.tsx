"use client";

import { useState } from "react";

type Mod = { key: string; name: string; description: string; requires?: string; requiresName?: string; hides: string[]; dependents: string[] };

/** Module switches; a module whose prerequisite is off is shown as inactive. */
export function ModuleToggles({ modules, initial }: { modules: Mod[]; initial: Record<string, boolean> }) {
  const [on, setOn] = useState(initial);
  return (
    <div className="s-modules">
      {modules.map((m) => {
        const blocked = Boolean(m.requires && !on[m.requires]);
        const checked = on[m.key];
        return (
          <label key={m.key} className={`s-module${blocked ? " is-blocked" : ""}`}>
            <input type="checkbox" name={m.key} checked={checked} onChange={(e) => setOn({ ...on, [m.key]: e.target.checked })} />
            <strong>
              {m.name}
              {checked && !blocked ? <span className="a-pill a-pill--ok">An</span> : <span className="a-pill a-pill--muted">Aus</span>}
              {blocked && <span className="a-pill a-pill--warn">Braucht «{m.requiresName}»</span>}
            </strong>
            <p>{m.description}</p>
            {(m.hides.length > 0 || m.dependents.length > 0 || m.requires) && (
              <small>
                {m.requires && <>Setzt das Modul «{m.requiresName}» voraus. </>}
                {m.hides.length > 0 && (
                  <>
                    Ausgeschaltet verschwinden: <b>{m.hides.join(", ")}</b>.{" "}
                  </>
                )}
                {m.dependents.length > 0 && <>Schaltet auch «{m.dependents.join("», «")}» ab. </>}
                Daten bleiben erhalten.
              </small>
            )}
          </label>
        );
      })}
    </div>
  );
}
