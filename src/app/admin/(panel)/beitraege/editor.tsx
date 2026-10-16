"use client";

import { useState } from "react";
import { ActionForm, FieldError, Submit } from "@/components/admin/forms";
import { Icon } from "@/components/admin/kit";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { RichText } from "@/components/admin/rich-text";
import { SeoFields } from "@/components/admin/seo-fields";
import { slugify } from "@/lib/format";
import { savePostAction } from "./actions";

export type EditorPost = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover: PickedMedia | null;
  category: string;
  tags: string[];
  authorId: string;
  seoTitle: string;
  seoDescription: string;
  status: "draft" | "scheduled" | "published";
  /** datetime-local value in Swiss time */
  publishedAt: string;
};

/** "2026-10-20T09:30" → "20.10.2026, 09:30" (no timezone conversion, same on server and client) */
const fmtLocal = (v: string) => {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5]}` : v;
};

const STATUS = [
  { key: "draft", label: "Entwurf", text: "Nur im Dashboard sichtbar." },
  { key: "published", label: "Veröffentlicht", text: "Sofort auf der Website sichtbar." },
  { key: "scheduled", label: "Geplant", text: "Erscheint automatisch zum gewählten Zeitpunkt." },
] as const;

export function PostEditor({ post, authors, categories, tags, siteHost, canMedia }: { post: EditorPost; authors: { id: string; name: string }[]; categories: string[]; tags: string[]; siteHost: string; canMedia: boolean }) {
  const [title, setTitle] = useState(post.title);
  const [slug, setSlug] = useState(post.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(post.id));
  const [excerpt, setExcerpt] = useState(post.excerpt);
  const [status, setStatus] = useState(post.status);
  const [when, setWhen] = useState(post.publishedAt);
  const effectiveSlug = slugTouched ? slug : slugify(title);

  return (
    <ActionForm action={savePostAction} className="px-form">
      {(state) => (
        <>
          {post.id && <input type="hidden" name="id" value={post.id} />}
          <div className="a-split px-split">
            <div className="a-stack">
              <section className="a-panel px-main">
                <label className="a-field">
                  <span>Titel</span>
                  <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} className="px-title" placeholder="Worum geht es?" aria-invalid={state?.fieldErrors?.title ? true : undefined} autoFocus={!post.id} />
                  <FieldError state={state} name="title" />
                </label>
                <label className="a-field">
                  <span>
                    Adresse (Slug) <em>wird aus dem Titel erzeugt</em>
                  </span>
                  <div className="px-slug">
                    <span className="px-slug__prefix" aria-hidden="true">
                      …/
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
                      aria-invalid={state?.fieldErrors?.slug ? true : undefined}
                      spellCheck={false}
                    />
                    {slugTouched && (
                      <button
                        type="button"
                        className="a-btn a-btn--quiet a-btn--sm"
                        onClick={() => {
                          setSlugTouched(false);
                          setSlug(slugify(title));
                        }}
                      >
                        Aus Titel
                      </button>
                    )}
                  </div>
                  <small>Kleinbuchstaben, Zahlen und Bindestriche. Muss eindeutig sein – sonst wird eine Zahl angehängt.</small>
                  <FieldError state={state} name="slug" />
                </label>
                <label className="a-field">
                  <span>
                    Kurztext <em>{excerpt.length} / 600</em>
                  </span>
                  <textarea name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} maxLength={600} placeholder="Zwei, drei Sätze für Übersichten und Vorschauen." />
                  <FieldError state={state} name="excerpt" />
                </label>
                <RichText name="body" label="Text" defaultValue={post.body} minHeight={320} help="Überschriften, Listen, Links und Zitate. Eingefügter Text wird ohne Formatierung übernommen." />
              </section>
              <section className="a-panel">
                <div className="a-panel__head">
                  <div>
                    <h2>Suchmaschinen</h2>
                    <p className="a-panel__desc">Leer lassen, um Titel und Kurztext zu verwenden.</p>
                  </div>
                </div>
                <SeoFields defaultTitle={post.seoTitle} defaultDescription={post.seoDescription} fallbackTitle={title} fallbackDescription={excerpt} url={`${siteHost} › ${effectiveSlug || "beitrag"}`} titleError={state?.fieldErrors?.seoTitle} descriptionError={state?.fieldErrors?.seoDescription} />
              </section>
            </div>
            <div className="a-stack">
              <section className="a-panel">
                <fieldset className="px-status">
                  <legend>Status</legend>
                  {STATUS.map((s) => (
                    <label key={s.key} className={`px-status__opt${status === s.key ? " is-on" : ""}`}>
                      <input type="radio" name="status" value={s.key} checked={status === s.key} onChange={() => setStatus(s.key)} />
                      <span>
                        <strong>{s.label}</strong>
                        <small>{s.text}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {status !== "draft" && (
                  <label className="a-field px-when">
                    <span>
                      {status === "scheduled" ? "Veröffentlichen am" : "Veröffentlichungsdatum"} <em>Schweizer Zeit</em>
                    </span>
                    <input type="datetime-local" name="publishedAt" value={when} onChange={(e) => setWhen(e.target.value)} required={status === "scheduled"} aria-invalid={state?.fieldErrors?.publishedAt ? true : undefined} />
                    <small>{status === "scheduled" ? "Datum und Uhrzeit, ab der der Beitrag sichtbar ist." : "Leer = jetzt. Ein früheres Datum datiert den Beitrag zurück."}</small>
                    <FieldError state={state} name="publishedAt" />
                  </label>
                )}
                {status === "draft" && when && <input type="hidden" name="publishedAt" value={when} />}
              </section>
              <section className="a-panel">
                <MediaPicker name="coverId" label="Titelbild" defaultValue={post.cover ? [post.cover] : []} canUpload={canMedia} help="Querformat, mindestens 1200 px breit." />
              </section>
              <section className="a-panel a-stack px-meta">
                <label className="a-field">
                  <span>Kategorie</span>
                  <input name="category" defaultValue={post.category} list="px-categories" maxLength={80} placeholder="z. B. News" />
                  <datalist id="px-categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label className="a-field">
                  <span>Schlagwörter</span>
                  <input name="tags" defaultValue={post.tags.join(", ")} placeholder="Getrennt mit Komma" list="px-tags" />
                  <datalist id="px-tags">
                    {tags.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  <small>Mit Komma trennen, z. B. «Event, Zürich».</small>
                  <FieldError state={state} name="tags" />
                </label>
                <label className="a-field">
                  <span>Autor/in</span>
                  <select name="authorId" defaultValue={post.authorId}>
                    <option value="">Ohne Angabe</option>
                    {authors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            </div>
          </div>
          <div className="a-savebar px-savebar">
            <Submit pending="Wird gespeichert …">{status === "draft" ? "Entwurf speichern" : status === "scheduled" ? "Planen" : post.status === "published" ? "Speichern" : "Veröffentlichen"}</Submit>
            <span className="a-muted a-small0 px-savebar__hint">
              <Icon name={status === "draft" ? "edit" : status === "scheduled" ? "clock" : "globe"} size={15} />
              {status === "draft" ? "Nicht öffentlich" : status === "scheduled" ? (when ? `Erscheint am ${fmtLocal(when)}` : "Datum wählen") : "Öffentlich sichtbar"}
            </span>
          </div>
        </>
      )}
    </ActionForm>
  );
}
