"use client";

import { useEffect, useRef, useState } from "react";

type Group = { group: string; items: { key: string; label: string; adminOnly: boolean }[] };

function GroupToggle({ checked, mixed, disabled, onChange, label }: { checked: boolean; mixed: boolean; disabled: boolean; onChange: (v: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <label className="s-perm__toggle">
      <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={`Alle in ${label}`} />
      <span>Alle</span>
    </label>
  );
}

/**
 * Checkbox grid of permissions grouped like the catalogue, with a toggle per
 * group. `locked` keys can't be changed by the current user (they keep their
 * state; the server enforces the same rule).
 */
export function PermissionMatrix({ groups, initial, locked = [], readOnly = false }: { groups: Group[]; initial: string[]; locked?: string[]; readOnly?: boolean }) {
  const [sel, setSel] = useState(() => new Set(initial));
  const isLocked = (k: string) => readOnly || locked.includes(k);
  const toggle = (keys: string[], on: boolean) =>
    setSel((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (isLocked(k)) continue;
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="s-perm">
      <p className="s-perm__summary" aria-live="polite">
        {sel.size} von {total} Berechtigungen gewählt
      </p>
      {groups.map((g) => {
        const keys = g.items.map((i) => i.key);
        const editable = keys.filter((k) => !isLocked(k));
        const on = keys.filter((k) => sel.has(k)).length;
        return (
          <fieldset key={g.group} className="s-perm__group">
            <legend>
              <span>{g.group}</span>
              <small>
                {on}/{keys.length}
              </small>
            </legend>
            {!readOnly && <GroupToggle label={g.group} checked={on === keys.length} mixed={on > 0 && on < keys.length} disabled={!editable.length} onChange={(v) => toggle(keys, v)} />}
            <div className="s-perm__items">
              {g.items.map((i) => (
                <label key={i.key} className={`s-perm__item${isLocked(i.key) && !readOnly ? " is-locked" : ""}`}>
                  <input type="checkbox" name="permissions" value={i.key} checked={sel.has(i.key)} disabled={isLocked(i.key)} onChange={(e) => toggle([i.key], e.target.checked)} />
                  <span>
                    {i.label}
                    <small>
                      {i.key}
                      {i.adminOnly && <em className="s-perm__badge">Nur Inhaber/Admin</em>}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            {/* disabled checkboxes are not submitted – keep locked selections */}
            {!readOnly && keys.filter((k) => isLocked(k) && sel.has(k)).map((k) => <input key={k} type="hidden" name="permissions" value={k} />)}
          </fieldset>
        );
      })}
    </div>
  );
}
