"use client";

import { useState } from "react";
import { ActionForm, FieldError, Submit } from "@/components/admin/forms";
import { Icon } from "@/components/admin/kit";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { SeoFields } from "@/components/admin/seo-fields";
import { importSitemapAction, saveSeoAction } from "./actions";

export type SeoFormEntry = { path: string; title: string; description: string; canonical: string; ogImage: string; noindex: boolean; ogMedia: PickedMedia | null };

export function SeoEntryForm({ entry, siteHost, canMedia, saved }: { entry: SeoFormEntry | null; siteHost: string; canMedia: boolean; saved?: boolean }) {
  const [path, setPath] = useState(entry?.path ?? "/");
  const [ogImage, setOgImage] = useState(entry?.ogMedia ? "" : (entry?.ogImage ?? ""));
  const [hasMedia, setHasMedia] = useState(Boolean(entry?.ogMedia));
  return (
    <ActionForm action={saveSeoAction} className="a-seoform">
      {(state) => (
        <>
          {saved && !state && (
            <p className="a-alert a-alert--ok sx-saved" role="status">
              Gespeichert.
            </p>
          )}
          <div className="a-seoform__body">
            {entry && <input type="hidden" name="original" value={entry.path} />}
            <label className="a-field">
              <span>Pfad</span>
              <input name="path" value={path} onChange={(e) => setPath(e.target.value)} required maxLength={500} className="a-mono" placeholder="/ueber-uns" aria-invalid={state?.fieldErrors?.path ? true : undefined} spellCheck={false} autoFocus={!entry} />
              <small>Pfad der Seite auf der Website, z. B. /kontakt. Eine ganze Adresse wird gekürzt.</small>
              <FieldError state={state} name="path" />
            </label>
            <SeoFields titleName="title" descriptionName="description" defaultTitle={entry?.title} defaultDescription={entry?.description} url={`${siteHost}${path === "/" ? "" : path.replace(/\//g, " › ").replace(/^ › /, " › ")}`} titleError={state?.fieldErrors?.title} descriptionError={state?.fieldErrors?.description} />
            <label className="a-field">
              <span>
                Kanonische Adresse <em>optional</em>
              </span>
              <input name="canonical" defaultValue={entry?.canonical} maxLength={1000} placeholder="https://…" aria-invalid={state?.fieldErrors?.canonical ? true : undefined} />
              <small>Nur setzen, wenn derselbe Inhalt unter mehreren Adressen erreichbar ist.</small>
              <FieldError state={state} name="canonical" />
            </label>
            <div className="sx-og">
              <MediaPicker name="ogMediaId" label="Vorschaubild für soziale Netzwerke" defaultValue={entry?.ogMedia ? [entry.ogMedia] : []} canUpload={canMedia} onChange={(l) => setHasMedia(l.length > 0)} help="1200 × 630 px empfohlen." />
              {!hasMedia && (
                <label className="a-field">
                  <span>
                    … oder Bild-Adresse <em>optional</em>
                  </span>
                  <input name="ogImage" value={ogImage} onChange={(e) => setOgImage(e.target.value)} maxLength={1000} placeholder="https://…/bild.jpg" aria-invalid={state?.fieldErrors?.ogImage ? true : undefined} />
                  <FieldError state={state} name="ogImage" />
                </label>
              )}
            </div>
            <label className="a-check a-check--box">
              <input type="checkbox" name="noindex" defaultChecked={entry?.noindex} />
              <span>
                Nicht in Suchmaschinen aufnehmen (noindex)
                <small>Für Danke-Seiten, interne Seiten oder Duplikate.</small>
              </span>
            </label>
          </div>
          <div className="a-savebar">
            <Submit>{entry ? "Speichern" : "Hinzufügen"}</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function SitemapImport({ siteUrl }: { siteUrl: string }) {
  return (
    <ActionForm action={importSitemapAction} className="sx-import">
      <Submit variant="ghost" pending="Sitemap wird gelesen …">
        <Icon name="download" size={16} />
        Pfade aus Sitemap übernehmen
      </Submit>
      <small className="a-muted">{siteUrl ? `${siteUrl.replace(/\/$/, "")}/sitemap.xml` : "Website-Adresse in den Einstellungen fehlt"}</small>
    </ActionForm>
  );
}
