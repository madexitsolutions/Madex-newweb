"use client";

import { useActionState, useState } from "react";
import type { SeoPage } from "@/lib/seo-pages";
import type { SeoOverride } from "@/lib/server/settings";
import { saveSeo } from "../../actions";
import { Submit } from "../../ui";

/** One page: Google preview, character counters, override fields. */
export function SeoEditor({ page, override, origin }: { page: SeoPage; override?: SeoOverride; origin: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(override?.title ?? "");
  const [desc, setDesc] = useState(override?.description ?? "");
  const [state, run] = useActionState(saveSeo.bind(null, page.path), undefined);
  const shownTitle = page.path === "/" ? title || page.title : `${title || page.title} | Madex IT Solutions`;
  const shownDesc = desc || page.description;
  const changed = Boolean(override);

  return (
    <article className={`a-seo${open ? " is-open" : ""}`}>
      <button type="button" className="a-seo__row" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="a-seo__path">{page.path}</span>
        <span className="a-seo__title">{shownTitle}</span>
        <span className="a-seo__tags">
          {changed && <span className="a-pill a-pill--confirmed">Angepasst</span>}
          {override?.noindex && <span className="a-pill a-pill--cancelled">Nicht indexiert</span>}
          {shownTitle.length > 60 && <span className="a-pill a-pill--warn">Titel lang</span>}
        </span>
      </button>
      {open && (
        <form action={run} className="a-seo__form">
          <div className="a-serp" aria-label="Vorschau in den Google-Suchergebnissen">
            <small>{origin.replace(/^https?:\/\//, "") + (page.path === "/" ? "" : page.path.replace(/\//g, " › ").replace(/^ › /, " › "))}</small>
            <strong>{shownTitle.length > 62 ? shownTitle.slice(0, 60) + " …" : shownTitle}</strong>
            <p>{shownDesc.length > 160 ? shownDesc.slice(0, 157) + " …" : shownDesc}</p>
          </div>
          {state?.error && <p className="a-alert a-alert--error">{state.error}</p>}
          {state?.message && <p className="a-alert a-alert--ok">{state.message}</p>}
          <label className="a-field">
            <span>
              Titel <em className={shownTitle.length > 60 ? "a-warn" : ""}>{shownTitle.length} / 60 Zeichen</em>
            </span>
            <input name="title" value={title} maxLength={120} placeholder={page.title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="a-field">
            <span>
              Beschreibung <em className={shownDesc.length > 160 ? "a-warn" : ""}>{shownDesc.length} / 160 Zeichen</em>
            </span>
            <textarea name="description" rows={3} value={desc} maxLength={320} placeholder={page.description} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <label className="a-field">
            <span>Vorschaubild für Social Media (optional)</span>
            <input name="image" defaultValue={override?.image} placeholder="/og.jpg oder https://…" />
          </label>
          <label className="a-check">
            <input type="checkbox" name="noindex" defaultChecked={override?.noindex} />
            Seite nicht in Google anzeigen (noindex) und aus der Sitemap entfernen
          </label>
          <div className="a-row">
            <Submit>Speichern</Submit>
            <a className="a-btn a-btn--ghost" href={page.path} target="_blank" rel="noopener">
              Seite ansehen
            </a>
          </div>
        </form>
      )}
    </article>
  );
}
