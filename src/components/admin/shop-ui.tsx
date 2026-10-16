"use client";

/** Client helpers for the shop admin pages (filters, bulk selection, SEO preview, category picker). */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { generateCouponCode } from "@/lib/catalog";
import { ibanError } from "@/lib/iban";
import { Icon } from "./kit";

/** <select> that submits its (GET) form on change – keep a submit button for keyboard users without JS. */
export function AutoSelect({ name, defaultValue, label, children, className }: { name: string; defaultValue?: string; label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`a-field s-filter${className ? " " + className : ""}`}>
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={defaultValue} aria-label={label} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {children}
      </select>
    </label>
  );
}

/**
 * Selection bar for list tables: counts checked `ids` checkboxes in the
 * surrounding form, offers "select all", and asks before destructive actions.
 */
export function BulkBar({ actions, noun = ["Eintrag", "Einträge"] }: { actions: { value: string; label: string; danger?: boolean; confirm?: string }[]; noun?: [string, string] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const boxes = () => Array.from(form.querySelectorAll<HTMLInputElement>('input[name="ids"]'));
    const all = form.querySelector<HTMLInputElement>("input[data-select-all]");
    const update = () => {
      const list = boxes();
      const checked = list.filter((b) => b.checked).length;
      setN(checked);
      if (all) {
        all.checked = checked > 0 && checked === list.length;
        all.indeterminate = checked > 0 && checked < list.length;
      }
      for (const b of list) b.closest("tr")?.classList.toggle("is-selected", b.checked);
    };
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.dataset.selectAll !== undefined) for (const b of boxes()) b.checked = t.checked;
      update();
    };
    form.addEventListener("change", onChange);
    update();
    return () => form.removeEventListener("change", onChange);
  }, []);
  return (
    <div ref={ref} className={`s-bulk${n ? " is-on" : ""}`} aria-live="polite">
      <span className="s-bulk__count">{n ? `${n} ${n === 1 ? noun[0] : noun[1]} ausgewählt` : `${noun[1]} zum Bearbeiten auswählen`}</span>
      {n > 0 && (
        <div className="s-bulk__actions">
          {actions.map((a) => (
            <button
              key={a.value}
              type="submit"
              name="op"
              value={a.value}
              className={`a-btn a-btn--sm ${a.danger ? "a-btn--danger" : "a-btn--ghost"}`}
              onClick={(e) => {
                if (a.confirm && !confirm(a.confirm.replace("{n}", String(n)))) e.preventDefault();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Text input/textarea with a live character counter (ideal ranges for SEO). */
function Counted({ value, ideal, max }: { value: string; ideal: [number, number]; max: number }) {
  const len = value.length;
  const cls = len === 0 ? "" : len > max ? " is-bad" : len < ideal[0] || len > ideal[1] ? " is-warn" : " is-ok";
  return (
    <em className={`a-counter s-counter${cls}`} aria-live="polite">
      {len} / {ideal[1]}
    </em>
  );
}

/** SEO title + description with counters and a Google preview. */
export function SeoFields({
  title,
  description,
  onTitle,
  onDescription,
  fallbackTitle,
  fallbackDescription,
  url,
  errors,
}: {
  title: string;
  description: string;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  fallbackTitle: string;
  fallbackDescription: string;
  url: string;
  errors?: Record<string, string>;
}) {
  const shownTitle = title || fallbackTitle || "Titel der Seite";
  const shownDesc = description || fallbackDescription || "Ohne Beschreibung wählt Google selbst einen Textausschnitt der Seite.";
  return (
    <div className="a-stack">
      <label className="a-field">
        <span>
          SEO-Titel <Counted value={title} ideal={[30, 60]} max={70} />
        </span>
        <input name="seoTitle" value={title} onChange={(e) => onTitle(e.target.value)} maxLength={200} placeholder={fallbackTitle} aria-invalid={errors?.seoTitle ? true : undefined} />
        <small>Leer lassen, um den Produktnamen zu verwenden. Ideal sind 30–60 Zeichen.</small>
      </label>
      <label className="a-field">
        <span>
          Meta-Beschreibung <Counted value={description} ideal={[70, 160]} max={180} />
        </span>
        <textarea name="seoDescription" rows={3} value={description} onChange={(e) => onDescription(e.target.value)} maxLength={400} placeholder={fallbackDescription} />
        <small>Erscheint in den Suchergebnissen. Ideal sind 70–160 Zeichen.</small>
      </label>
      <div className="a-serp" aria-label="Vorschau in Google">
        <span className="a-serp__label">Vorschau in Google</span>
        <small>{url}</small>
        <strong>{shownTitle.length > 62 ? shownTitle.slice(0, 60) + " …" : shownTitle}</strong>
        <p>{shownDesc.length > 160 ? shownDesc.slice(0, 158) + " …" : shownDesc}</p>
      </div>
    </div>
  );
}

export type TreeChoice = { id: string; name: string; depth: number; path: string[] };

/** Checkbox tree for choosing categories; posts `name` once per selected id. */
export function CategoryPicker({ tree, name, defaultValue, emptyHint }: { tree: TreeChoice[]; name: string; defaultValue: string[]; emptyHint?: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultValue));
  const [filter, setFilter] = useState("");
  const id = useId();
  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? tree.filter((c) => c.path.join(" ").toLowerCase().includes(f)) : tree;
  }, [tree, filter]);
  if (!tree.length) return <p className="a-muted a-small0">{emptyHint ?? "Noch keine Kategorien vorhanden."}</p>;
  return (
    <div className="s-tree">
      {tree.length > 8 && (
        <label className="a-field">
          <span className="sr-only">Kategorien filtern</span>
          <input type="search" placeholder="Kategorie suchen …" value={filter} onChange={(e) => setFilter(e.target.value)} aria-controls={id} />
        </label>
      )}
      <ul className="s-tree__list" id={id}>
        {visible.map((c) => (
          <li key={c.id} style={{ paddingLeft: filter ? 0 : c.depth * 18 }}>
            <label className="a-check">
              <input
                type="checkbox"
                name={name}
                value={c.id}
                checked={selected.has(c.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(c.id);
                  else next.delete(c.id);
                  setSelected(next);
                }}
              />
              <span>{filter ? c.path.join(" › ") : c.name}</span>
            </label>
          </li>
        ))}
        {!visible.length && <li className="a-muted a-small0">Keine Kategorie gefunden.</li>}
      </ul>
      {/* selected but filtered out entries are still submitted */}
      {[...selected]
        .filter((s) => !visible.some((v) => v.id === s))
        .map((s) => (
          <input key={s} type="hidden" name={name} value={s} />
        ))}
      <small className="a-muted">{selected.size ? `${selected.size} ausgewählt` : "Keine Kategorie gewählt"}</small>
    </div>
  );
}

/** Checkbox list with search (e.g. products a coupon applies to). */
export function ChoiceList({ items, name, defaultValue, placeholder, empty }: { items: { id: string; label: string; hint?: string; depth?: number }[]; name: string; defaultValue: string[]; placeholder: string; empty: string }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultValue));
  const [filter, setFilter] = useState("");
  const f = filter.trim().toLowerCase();
  const visible = f ? items.filter((i) => i.label.toLowerCase().includes(f)) : items;
  if (!items.length) return <p className="a-muted a-small0">{empty}</p>;
  return (
    <div className="s-tree">
      <label className="a-field">
        <span className="sr-only">{placeholder}</span>
        <input type="search" placeholder={placeholder} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </label>
      <ul className="s-tree__list">
        {visible.slice(0, 300).map((i) => (
          <li key={i.id} style={{ paddingLeft: f ? 0 : (i.depth ?? 0) * 18 }}>
            <label className="a-check">
              <input
                type="checkbox"
                name={name}
                value={i.id}
                checked={selected.has(i.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(i.id);
                  else next.delete(i.id);
                  setSelected(next);
                }}
              />
              <span>
                {i.label}
                {i.hint && <small>{i.hint}</small>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {[...selected]
        .filter((s) => !visible.slice(0, 300).some((v) => v.id === s))
        .map((s) => (
          <input key={s} type="hidden" name={name} value={s} />
        ))}
      <small className="a-muted">{selected.size ? `${selected.size} ausgewählt` : "Nichts ausgewählt – gilt für alle"}</small>
    </div>
  );
}

/** Fills the coupon code input with a random, unambiguous code. */
export function CouponCodeButton({ target, label = "Code erzeugen" }: { target: string; label?: string }) {
  return (
    <button
      type="button"
      className="a-btn a-btn--ghost s-genbtn"
      onClick={(e) => {
        const input = e.currentTarget.form?.elements.namedItem(target) as HTMLInputElement | null;
        if (!input) return;
        const prefix = (e.currentTarget.form?.elements.namedItem("codePrefix") as HTMLInputElement | null)?.value ?? "";
        input.value = generateCouponCode(8, prefix);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }}
    >
      <Icon name="sparkle" size={16} />
      {label}
    </button>
  );
}

/** Shows an inline hint when the IBAN in the field is invalid (the server checks again). */
export function IbanInput({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [touched, setTouched] = useState(false);
  const err = value.trim() ? ibanError(value) : null;
  return (
    <>
      <input name={name} value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => setTouched(true)} autoComplete="off" spellCheck={false} placeholder="CH93 0076 2011 6238 5295 7" aria-invalid={touched && err ? true : undefined} className="a-mono" />
      {touched && err && <span className="a-field__error">{err}</span>}
    </>
  );
}
