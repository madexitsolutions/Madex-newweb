"use client";

import { useState } from "react";

export const SEO_TITLE_MAX = 60;
export const SEO_DESC_MIN = 70;
export const SEO_DESC_MAX = 160;

function Counter({ n, min = 0, max, id }: { n: number; min?: number; max: number; id: string }) {
  const bad = n > max || (n > 0 && n < min);
  return (
    <em id={id} className={`a-counter${bad ? " is-bad" : ""}`} aria-live="polite">
      {n} / {min ? `${min}–${max}` : max}
    </em>
  );
}

/** Google search result preview (title cut at ~60, description at ~160 characters). */
export function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + " …" : s);
  return (
    <div className="a-serp" aria-label="Vorschau in Google">
      <span className="a-serp__label">Vorschau in Google</span>
      <small>{url}</small>
      <strong>{cut(title || "Titel der Seite", SEO_TITLE_MAX + 5)}</strong>
      <p>{description ? cut(description, SEO_DESC_MAX + 5) : "Ohne Beschreibung wählt Google selbst einen Textausschnitt der Seite."}</p>
    </div>
  );
}

/**
 * SEO title + meta description with live counters and a Google preview.
 * `fallbackTitle` / `fallbackDescription` are shown in the preview when the
 * fields are empty (e.g. the post title and excerpt).
 */
export function SeoFields({
  titleName = "seoTitle",
  descriptionName = "seoDescription",
  defaultTitle = "",
  defaultDescription = "",
  fallbackTitle = "",
  fallbackDescription = "",
  url,
  titleError,
  descriptionError,
}: {
  titleName?: string;
  descriptionName?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
  url: string;
  titleError?: string;
  descriptionError?: string;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [desc, setDesc] = useState(defaultDescription);
  return (
    <div className="sx-seo">
      <label className="a-field">
        <span>
          SEO-Titel <Counter n={title.length} max={SEO_TITLE_MAX} id={`${titleName}-count`} />
        </span>
        <input name={titleName} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={fallbackTitle || "Titel für Suchmaschinen"} aria-describedby={`${titleName}-count ${titleName}-help`} aria-invalid={titleError ? true : undefined} />
        <small id={`${titleName}-help`}>Bis {SEO_TITLE_MAX} Zeichen, sonst kürzt Google. Leer = Standardtitel.</small>
        {titleError && <span className="a-field__error">{titleError}</span>}
      </label>
      <label className="a-field">
        <span>
          Meta-Beschreibung <Counter n={desc.length} min={SEO_DESC_MIN} max={SEO_DESC_MAX} id={`${descriptionName}-count`} />
        </span>
        <textarea name={descriptionName} value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={400} placeholder={fallbackDescription || "Kurze Zusammenfassung, die neugierig macht"} aria-describedby={`${descriptionName}-count ${descriptionName}-help`} aria-invalid={descriptionError ? true : undefined} />
        <small id={`${descriptionName}-help`}>
          Ideal {SEO_DESC_MIN}–{SEO_DESC_MAX} Zeichen.
        </small>
        {descriptionError && <span className="a-field__error">{descriptionError}</span>}
      </label>
      <SerpPreview title={title || fallbackTitle} description={desc || fallbackDescription} url={url} />
    </div>
  );
}
