"use client";

import { useState } from "react";
import { ActionForm, FieldError, Submit } from "@/components/admin/forms";
import { MediaPicker } from "@/components/admin/media-picker";
import { saveProjectAction } from "./actions";

export type ProjectDraft = {
  slug: string;
  title: string;
  client: string;
  date: string;
  description: string;
  external: string;
  cover: string;
  coverUrl: string;
  content: string;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);

export function ProjectForm({
  p,
  saved,
  canMedia,
}: {
  p: ProjectDraft | null;
  saved: boolean;
  canMedia: boolean;
}) {
  const [slug, setSlug] = useState(p?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!p);
  const [picked, setPicked] = useState(false);
  return (
    <ActionForm action={saveProjectAction} className="a-seoform">
      {(state) => (
        <>
          <div className="a-seoform__body">
            {saved && !state && (
              <p className="a-alert a-alert--ok" role="status">
                Gespeichert.
              </p>
            )}
            <input type="hidden" name="original" value={p?.slug ?? ""} />
            <label className="a-field">
              <span>Titel</span>
              <input
                name="title"
                defaultValue={p?.title}
                maxLength={200}
                required
                placeholder="z. B. Neue Website für die Muster AG"
                aria-invalid={state?.fieldErrors?.title ? true : undefined}
                autoFocus={!p}
                onChange={(e) =>
                  !slugTouched && setSlug(slugify(e.target.value))
                }
              />
              <FieldError state={state} name="title" />
            </label>
            <div className="pj-two">
              <label className="a-field">
                <span>Kunde</span>
                <input
                  name="client"
                  defaultValue={p?.client}
                  maxLength={100}
                  required
                  aria-invalid={state?.fieldErrors?.client ? true : undefined}
                />
                <FieldError state={state} name="client" />
              </label>
              <label className="a-field">
                <span>Datum</span>
                <input
                  name="date"
                  type="date"
                  defaultValue={
                    p?.date ?? new Date().toISOString().slice(0, 10)
                  }
                  required
                  aria-invalid={state?.fieldErrors?.date ? true : undefined}
                />
                <FieldError state={state} name="date" />
              </label>
            </div>
            <label className="a-field">
              <span>Adresse der Projektseite</span>
              <span className="pj-slug">
                <span aria-hidden="true">madex-it.ch/</span>
                <input
                  name="slug"
                  value={slug}
                  onChange={(e) => (
                    setSlugTouched(true),
                    setSlug(e.target.value)
                  )}
                  maxLength={140}
                  required
                  className="a-mono"
                  aria-invalid={state?.fieldErrors?.slug ? true : undefined}
                />
              </span>
              {p && slug !== p.slug && (
                <small>
                  Die alte Adresse funktioniert danach nicht mehr – Links darauf
                  führen ins Leere. Legen Sie bei Bedarf eine Weiterleitung an.
                </small>
              )}
              <FieldError state={state} name="slug" />
            </label>
            <label className="a-field">
              <span>
                Website des Kunden <em>optional</em>
              </span>
              <input
                name="external"
                type="url"
                defaultValue={p?.external}
                maxLength={300}
                placeholder="https://www.muster.ch"
                aria-invalid={state?.fieldErrors?.external ? true : undefined}
              />
              <FieldError state={state} name="external" />
            </label>
            <MediaPicker
              name="coverId"
              label="Titelbild"
              canUpload={canMedia}
              onChange={(l) => setPicked(l.length > 0)}
              help="Erscheint in der Übersicht und oben auf der Projektseite. Querformat, mind. 1600 px breit."
            />
            {!picked && (
              <label className="a-field">
                <span>{p ? "Aktuelles Titelbild" : "oder Pfad zum Bild"}</span>
                {p?.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverUrl} alt="" className="pj-cover" />
                )}
                <input
                  name="cover"
                  defaultValue={p?.cover}
                  maxLength={500}
                  className="a-mono"
                  placeholder="/uploads/2026/10/titelbild.jpg"
                  aria-invalid={state?.fieldErrors?.cover ? true : undefined}
                />
                <FieldError state={state} name="cover" />
              </label>
            )}
            <label className="a-field">
              <span>
                Kurzbeschreibung <em>optional</em>
              </span>
              <textarea
                name="description"
                defaultValue={p?.description}
                rows={3}
                maxLength={500}
                aria-invalid={
                  state?.fieldErrors?.description ? true : undefined
                }
              />
              <small>
                Für Google und die Vorschau in der Übersicht. Leer = der erste
                Absatz des Textes.
              </small>
              <FieldError state={state} name="description" />
            </label>
            <label className="a-field">
              <span>Text der Projektseite</span>
              <textarea
                name="content"
                defaultValue={p?.content}
                rows={16}
                maxLength={40_000}
                className="pj-content"
                aria-invalid={state?.fieldErrors?.content ? true : undefined}
              />
              <small>
                Leerzeile = neuer Absatz. «## Titel» für einen Zwischentitel, «-
                Punkt» für eine Aufzählung,
                «![Beschreibung](/uploads/…/bild.jpg)» für ein Bild.
              </small>
              <FieldError state={state} name="content" />
            </label>
          </div>
          <div className="a-savebar">
            <Submit>{p ? "Speichern" : "Projekt veröffentlichen"}</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}
