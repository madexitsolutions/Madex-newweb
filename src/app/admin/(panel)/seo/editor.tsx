"use client";

import { useActionState, useState } from "react";
import type { SeoPage } from "@/lib/seo-pages";
import type { SeoOverride } from "@/lib/server/settings";
import { saveSeo } from "../../actions";
import { Submit } from "../../ui";
import { Icon } from "../../kit";
import { DESC_MAX, DESC_MIN, TITLE_MAX, fullTitle } from "./rules";

function Counter({ n, max, min }: { n: number; max: number; min?: number }) {
  const bad = n > max || (min !== undefined && n < min);
  return (
    <em className={`a-counter${bad ? " is-bad" : ""}`}>
      {n} / {max} Zeichen{min !== undefined && n < min ? ` · mind. ${min}` : ""}
    </em>
  );
}

/** Edit form for one page: Google preview, character counters, override fields. */
export function SeoEditor({ page, override, origin }: { page: SeoPage; override?: SeoOverride; origin: string }) {
  const [title, setTitle] = useState(override?.title ?? "");
  const [desc, setDesc] = useState(override?.description ?? "");
  const [image, setImage] = useState(override?.image ?? "");
  const [noindex, setNoindex] = useState(Boolean(override?.noindex));
  const [state, run] = useActionState(saveSeo.bind(null, page.path), undefined);
  const shownTitle = fullTitle(page.path, title || page.title);
  const shownDesc = desc || page.description;
  const dirty = title || desc || image || noindex;
  const crumbs = origin.replace(/^https?:\/\//, "") + (page.path === "/" ? "" : page.path.split("/").filter(Boolean).map((s) => ` › ${s}`).join(""));

  return (
    <form action={run} className="a-seoform">
      <div className="a-seoform__body">
        <div className="a-serp" aria-label="Vorschau in den Google-Suchergebnissen">
          <span className="a-serp__label">Vorschau bei Google</span>
          <small>{crumbs}</small>
          <strong>{shownTitle.length > TITLE_MAX + 2 ? shownTitle.slice(0, TITLE_MAX) + " …" : shownTitle}</strong>
          <p>{shownDesc.length > DESC_MAX ? shownDesc.slice(0, DESC_MAX - 3) + " …" : shownDesc}</p>
        </div>

        {state?.error && (
          <p className="a-alert a-alert--error" role="alert">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p className="a-alert a-alert--ok" role="status">
            {state.message}
          </p>
        )}

        <label className="a-field">
          <span>
            Titel <Counter n={shownTitle.length} max={TITLE_MAX} />
          </span>
          <input name="title" value={title} maxLength={120} placeholder={page.title} onChange={(e) => setTitle(e.target.value)} />
          <small>{page.path === "/" ? "Erscheint genau so bei Google." : "«| Madex IT Solutions» wird automatisch angehängt."} Leer lassen für den Standardtitel.</small>
        </label>
        <label className="a-field">
          <span>
            Beschreibung <Counter n={shownDesc.length} max={DESC_MAX} min={DESC_MIN} />
          </span>
          <textarea name="description" rows={4} value={desc} maxLength={320} placeholder={page.description} onChange={(e) => setDesc(e.target.value)} />
          <small>Ideal sind 120–160 Zeichen, die zum Klicken einladen. Leer lassen für den Standardtext.</small>
        </label>
        <label className="a-field">
          <span>Vorschaubild für Social Media (optional)</span>
          <input name="image" value={image} onChange={(e) => setImage(e.target.value)} placeholder="/og.jpg oder https://…" />
        </label>
        <label className="a-check a-check--box">
          <input type="checkbox" name="noindex" checked={noindex} onChange={(e) => setNoindex(e.target.checked)} />
          <span>
            Seite nicht in Google anzeigen (noindex)
            <small>Entfernt die Seite auch aus der Sitemap.</small>
          </span>
        </label>
      </div>
      <div className="a-savebar">
        <Submit>Speichern</Submit>
        {dirty && (
          <button
            type="button"
            className="a-btn a-btn--quiet"
            onClick={() => {
              setTitle("");
              setDesc("");
              setImage("");
              setNoindex(false);
            }}
          >
            Standard wiederherstellen
          </button>
        )}
        <a className="a-btn a-btn--quiet a-savebar__end" href={page.path} target="_blank" rel="noopener">
          <Icon name="external" size={16} />
          Seite ansehen
        </a>
      </div>
    </form>
  );
}
