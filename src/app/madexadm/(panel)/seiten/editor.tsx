"use client";

import { useState } from "react";
import { ActionForm, FieldError, Submit } from "@/components/admin/forms";
import { Icon } from "@/components/admin/kit";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { RichText } from "@/components/admin/rich-text";
import { SeoFields } from "@/components/admin/seo-fields";
import { slugify } from "@/lib/format";
import { savePageAction } from "./actions";

export type EditorPage = {
  id: string | null;
  title: string;
  slug: string;
  body: string;
  status: "draft" | "published";
  cover: PickedMedia | null;
  showTitle: boolean;
  seoTitle: string;
  seoDescription: string;
  noindex: boolean;
};

export function PageEditor({ page, siteHost, siteBase, canMedia, placeholders }: { page: EditorPage; siteHost: string; siteBase: string; canMedia: boolean; placeholders: readonly (readonly [string, string])[] }) {
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(page.id));
  const [status, setStatus] = useState(page.status);
  const effectiveSlug = slugTouched ? slug : slugify(title);

  return (
    <ActionForm action={savePageAction} className="px-form">
      {(state) => (
        <>
          {page.id && <input type="hidden" name="id" value={page.id} />}
          <div className="a-split px-split">
            <div className="a-stack">
              <section className="a-panel px-main">
                <label className="a-field">
                  <span>Titel</span>
                  <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} className="px-title" placeholder="z. B. Über uns" aria-invalid={state?.fieldErrors?.title ? true : undefined} autoFocus={!page.id} />
                  <FieldError state={state} name="title" />
                </label>
                <label className="a-field">
                  <span>
                    Adresse <em>wird aus dem Titel erzeugt</em>
                  </span>
                  <div className="px-slug">
                    <span className="px-slug__prefix" aria-hidden="true">
                      {siteHost}/
                    </span>
                    <input
                      name="slug"
                      value={effectiveSlug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                      }}
                      onBlur={() => setSlug(slugify(effectiveSlug))}
                      maxLength={96}
                      spellCheck={false}
                    />
                  </div>
                  <FieldError state={state} name="slug" />
                </label>
                <RichText name="body" label="Inhalt" defaultValue={page.body} minHeight={380} help="Überschriften, Listen, Links und Zitate. Platzhalter wie {{firma}} werden mit den Firmendaten ersetzt." />
              </section>
              <section className="a-panel">
                <div className="a-panel__head">
                  <div>
                    <h2>Suchmaschinen</h2>
                    <p className="a-panel__desc">Leer lassen, um den Titel und den Anfang des Inhalts zu verwenden.</p>
                  </div>
                </div>
                <SeoFields defaultTitle={page.seoTitle} defaultDescription={page.seoDescription} fallbackTitle={title} fallbackDescription="" url={`${siteHost} › ${effectiveSlug || "seite"}`} titleError={state?.fieldErrors?.seoTitle} descriptionError={state?.fieldErrors?.seoDescription} />
                <label className="a-check a-check--box ws-noindex">
                  <input type="checkbox" name="noindex" defaultChecked={page.noindex} />
                  <span>
                    Nicht in Google anzeigen
                    <small>Für Danke-Seiten, interne Seiten usw.</small>
                  </span>
                </label>
              </section>
            </div>
            <div className="a-stack">
              <section className="a-panel">
                <fieldset className="px-status">
                  <legend>Status</legend>
                  {(
                    [
                      ["draft", "Entwurf", "Nur im Dashboard sichtbar."],
                      ["published", "Veröffentlicht", `Sichtbar unter /${effectiveSlug || "…"}.`],
                    ] as const
                  ).map(([k, l, t]) => (
                    <label key={k} className={`px-status__opt${status === k ? " is-on" : ""}`}>
                      <input type="radio" name="status" value={k} checked={status === k} onChange={() => setStatus(k)} />
                      <span>
                        <strong>{l}</strong>
                        <small>{t}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {page.id && page.status === "published" && (
                  <p className="a-small">
                    <a href={`${siteBase}/${page.slug}`} target="_blank" rel="noopener" className="a-link">
                      Seite ansehen
                      <Icon name="external" size={14} />
                    </a>
                  </p>
                )}
              </section>
              <section className="a-panel a-stack">
                <MediaPicker name="coverId" label="Titelbild" defaultValue={page.cover ? [page.cover] : []} canUpload={canMedia} help="Optional. Querformat, mindestens 1600 px breit – erscheint gross oben auf der Seite." />
                <label className="a-check a-check--box">
                  <input type="checkbox" name="showTitle" defaultChecked={page.showTitle} />
                  <span>Titel auf der Seite anzeigen</span>
                </label>
              </section>
              <section className="a-panel">
                <h2 className="ws-sidetitle">Platzhalter</h2>
                <p className="a-muted a-small0">Werden auf der Website mit den Angaben aus Einstellungen → Allgemein ersetzt.</p>
                <dl className="ws-tokens">
                  {placeholders.map(([k, l]) => (
                    <div key={k}>
                      <dt>
                        <code>{k}</code>
                      </dt>
                      <dd>{l}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </div>
          <div className="a-savebar px-savebar">
            <Submit pending="Wird gespeichert …">{status === "draft" ? "Entwurf speichern" : page.status === "published" ? "Speichern" : "Veröffentlichen"}</Submit>
            <span className="a-muted a-small0 px-savebar__hint">
              <Icon name={status === "draft" ? "edit" : "globe"} size={15} />
              {status === "draft" ? "Nicht öffentlich" : "Öffentlich sichtbar"}
            </span>
          </div>
        </>
      )}
    </ActionForm>
  );
}
