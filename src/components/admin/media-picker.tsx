"use client";

/**
 * Media picker: shows the chosen file(s) and opens a dialog to pick from the
 * media library or upload new files. The selection is submitted with the
 * surrounding form as hidden inputs `<input name={name} value={mediaId}>`
 * (one per file, in order).
 *
 *   <MediaPicker name="coverId" label="Titelbild" defaultValue={cover ? [cover] : []} />
 *   <MediaPicker name="imageIds" multiple label="Bilder" defaultValue={images} />
 *
 * Read it on the server with f.get("coverId") or f.getAll("imageIds").
 */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { pickerListAction } from "@/app/admin/media-actions";
import type { MediaRef } from "@/server/media/library";
import { Icon } from "./kit";
import { Uploader } from "./uploader";

export type PickedMedia = { id: string; path: string; alt?: string; url?: string; filename?: string; mime?: string };

const urlOf = (m: PickedMedia) => m.url ?? `/uploads/${m.path}`;
const isImage = (m: PickedMedia) => (m.mime ? m.mime.startsWith("image/") : !/\.pdf$/i.test(m.path));

export function MediaPicker({
  name,
  multiple = false,
  defaultValue = [],
  label = multiple ? "Bilder" : "Bild",
  help,
  imagesOnly = true,
  canUpload = true,
  max = 20,
  onChange,
}: {
  name: string;
  multiple?: boolean;
  defaultValue?: PickedMedia[];
  label?: string;
  help?: string;
  imagesOnly?: boolean;
  canUpload?: boolean;
  max?: number;
  onChange?: (selected: PickedMedia[]) => void;
}) {
  const [selected, setSelected] = useState<PickedMedia[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const commit = (list: PickedMedia[]) => {
    const next = multiple ? list.slice(0, max) : list.slice(-1);
    setSelected(next);
    onChange?.(next);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  return (
    <div className="a-field mx-picker">
      <span id={`${name}-label`}>
        {label}
        {multiple && selected.length > 0 && <em>{selected.length} ausgewählt</em>}
      </span>
      {selected.map((m) => (
        <input key={m.id} type="hidden" name={name} value={m.id} />
      ))}
      <div className={`mx-picker__list${multiple ? " is-multi" : ""}`} role="group" aria-labelledby={`${name}-label`}>
        {selected.map((m, i) => (
          <figure key={m.id} className="mx-picker__item">
            {isImage(m) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlOf(m)} alt={m.alt || ""} />
            ) : (
              <span className="mx-picker__file">
                <Icon name="file" size={22} />
                PDF
              </span>
            )}
            <figcaption>
              <span className="mx-picker__name">{m.filename || m.alt || m.path.split("/").pop()}</span>
              <span className="mx-picker__tools">
                {multiple && i > 0 && (
                  <button type="button" className="a-iconbtn" onClick={() => move(i, -1)} aria-label={`${m.filename ?? "Bild"} nach vorne`}>
                    <Icon name="back" size={16} />
                  </button>
                )}
                {multiple && i < selected.length - 1 && (
                  <button type="button" className="a-iconbtn" onClick={() => move(i, 1)} aria-label={`${m.filename ?? "Bild"} nach hinten`}>
                    <Icon name="arrow" size={16} />
                  </button>
                )}
                <button type="button" className="a-iconbtn" onClick={() => commit(selected.filter((s) => s.id !== m.id))} aria-label={`${m.filename ?? "Bild"} entfernen`}>
                  <Icon name="close" size={16} />
                </button>
              </span>
            </figcaption>
          </figure>
        ))}
        {(multiple || selected.length === 0) && (
          <button type="button" className="mx-picker__add" onClick={() => setOpen(true)}>
            <Icon name="image" size={22} />
            <span>{selected.length ? "Weitere hinzufügen" : multiple ? "Bilder auswählen" : `${label} auswählen`}</span>
          </button>
        )}
      </div>
      {!multiple && selected.length > 0 && (
        <div className="mx-picker__actions">
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setOpen(true)}>
            Ersetzen
          </button>
          <button type="button" className="a-btn a-btn--quiet a-btn--sm" onClick={() => commit([])}>
            Entfernen
          </button>
        </div>
      )}
      {help && <small>{help}</small>}
      <dialog ref={dialog} className="mx-dialog" aria-labelledby={`${name}-dlg`} onClose={() => setOpen(false)} onCancel={() => setOpen(false)}>
        {open && (
          <PickerBody
            titleId={`${name}-dlg`}
            title={multiple ? "Bilder auswählen" : `${label} auswählen`}
            multiple={multiple}
            imagesOnly={imagesOnly}
            canUpload={canUpload}
            initial={selected}
            onCancel={() => setOpen(false)}
            onPick={(list) => {
              commit(list);
              setOpen(false);
            }}
          />
        )}
      </dialog>
    </div>
  );
}

function PickerBody({
  titleId,
  title,
  multiple,
  imagesOnly,
  canUpload,
  initial,
  onPick,
  onCancel,
}: {
  titleId: string;
  title: string;
  multiple: boolean;
  imagesOnly: boolean;
  canUpload: boolean;
  initial: PickedMedia[];
  onPick: (list: PickedMedia[]) => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: MediaRef[]; pages: number; total: number; error?: string } | null>(null);
  const [chosen, setChosen] = useState<PickedMedia[]>(initial);
  const [pending, start] = useTransition();

  const load = useCallback(
    (query: string, p: number) =>
      start(async () => {
        const r = await pickerListAction({ q: query, page: p, type: imagesOnly ? "image" : "all" });
        setData(r);
      }),
    [imagesOnly],
  );

  useEffect(() => {
    const t = setTimeout(() => load(q, page), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, page, load]);

  const toggle = (m: MediaRef) => {
    const ref: PickedMedia = { id: m.id, path: m.path, alt: m.alt, url: m.url, filename: m.filename, mime: m.mime };
    if (!multiple) return setChosen([ref]);
    setChosen((c) => (c.some((x) => x.id === m.id) ? c.filter((x) => x.id !== m.id) : [...c, ref]));
  };

  return (
    <div className="mx-dialog__inner">
      <header className="mx-dialog__head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="a-iconbtn" onClick={onCancel} aria-label="Schliessen">
          <Icon name="close" size={20} />
        </button>
      </header>
      {canUpload && (
        <div className="mx-dialog__tabs a-tabs a-tabs--segment" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "library"} className={tab === "library" ? "is-active" : undefined} onClick={() => setTab("library")}>
            Mediathek
          </button>
          <button type="button" role="tab" aria-selected={tab === "upload"} className={tab === "upload" ? "is-active" : undefined} onClick={() => setTab("upload")}>
            Hochladen
          </button>
        </div>
      )}
      <div className="mx-dialog__body">
        {tab === "upload" ? (
          <Uploader
            imagesOnly={imagesOnly}
            compact
            onUploaded={(m) => toggle(m)}
            onDone={(list) => {
              if (list.length) {
                setTab("library");
                setQ("");
                setPage(1);
                load("", 1);
              }
            }}
          />
        ) : (
          <>
            <label className="a-search mx-dialog__search">
              <Icon name="search" size={16} />
              <span className="sr-only">Mediathek durchsuchen</span>
              <input
                type="search"
                value={q}
                placeholder="Dateiname oder Alternativtext"
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            {data?.error && <p className="a-alert a-alert--error">{data.error}</p>}
            {data && !data.error && data.items.length === 0 ? (
              <div className="a-emptystate">
                <span className="a-emptystate__icon">
                  <Icon name="image" size={22} />
                </span>
                <p className="a-emptystate__title">{q ? "Keine Treffer" : "Die Mediathek ist leer"}</p>
                <p className="a-emptystate__text">{q ? "Anderen Suchbegriff versuchen." : canUpload ? "Laden Sie unter «Hochladen» das erste Bild hoch." : "Bitten Sie eine Person mit Zugriff auf die Mediathek, Bilder hochzuladen."}</p>
              </div>
            ) : (
              <ul className={`mx-pgrid${pending ? " is-loading" : ""}`} aria-busy={pending}>
                {(data?.items ?? []).map((m) => {
                  const on = chosen.some((c) => c.id === m.id);
                  return (
                    <li key={m.id}>
                      <button type="button" className={`mx-pgrid__tile${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => toggle(m)} onDoubleClick={() => !multiple && onPick([{ id: m.id, path: m.path, alt: m.alt, url: m.url, filename: m.filename, mime: m.mime }])}>
                        {m.mime.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.url} alt="" loading="lazy" />
                        ) : (
                          <span className="mx-picker__file">
                            <Icon name="file" size={22} />
                            PDF
                          </span>
                        )}
                        <span className="mx-pgrid__name">{m.filename}</span>
                        {on && (
                          <span className="mx-pgrid__check" aria-hidden="true">
                            <Icon name="check" size={14} />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {data && data.pages > 1 && (
              <div className="mx-dialog__pager">
                <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Zurück
                </button>
                <span className="a-muted a-small0">
                  Seite {page} von {data.pages}
                </span>
                <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                  Weiter
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <footer className="mx-dialog__foot">
        <span className="a-muted a-small0">{multiple ? `${chosen.length} ausgewählt` : chosen[0]?.filename ? `Ausgewählt: ${chosen[0].filename}` : "Nichts ausgewählt"}</span>
        <span className="mx-dialog__btns">
          <button type="button" className="a-btn a-btn--ghost" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="button" className="a-btn a-btn--primary" onClick={() => onPick(chosen)} disabled={!chosen.length && !initial.length}>
            Übernehmen
          </button>
        </span>
      </footer>
    </div>
  );
}
