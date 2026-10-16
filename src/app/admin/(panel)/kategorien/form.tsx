"use client";

import { ActionForm, Submit } from "@/components/admin/forms";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { RichText } from "@/components/admin/rich-text";
import { SeoFields } from "@/components/admin/seo-fields";
import { saveCategoryAction } from "./actions";

type Current = { id: string; name: string; slug: string; parentId: string | null; sort: number; description: string; seoTitle: string | null; seoDescription: string | null } | null;

export function CategoryForm({ current, parents, image, url }: { current: Current; parents: { id: string; name: string; depth: number }[]; image: PickedMedia | null; url: string }) {
  return (
    <ActionForm action={saveCategoryAction} className="a-stack">
      {(state) => (
        <>
          {current && <input type="hidden" name="id" value={current.id} />}
          <label className="a-field">
            <span>Name</span>
            <input name="name" defaultValue={current?.name} required maxLength={120} aria-invalid={Boolean(state?.fieldErrors?.name) || undefined} />
            {state?.fieldErrors?.name && <span className="a-field__error">{state.fieldErrors.name}</span>}
          </label>
          <label className="a-field">
            <span>
              Adresse (Slug) <em>leer = aus dem Namen</em>
            </span>
            <input name="slug" defaultValue={current?.slug} maxLength={120} aria-invalid={Boolean(state?.fieldErrors?.slug) || undefined} />
            {state?.fieldErrors?.slug && <span className="a-field__error">{state.fieldErrors.slug}</span>}
          </label>
          <div className="a-fields2">
            <label className="a-field">
              <span>Übergeordnete Kategorie</span>
              <select name="parentId" defaultValue={current?.parentId ?? ""} aria-invalid={Boolean(state?.fieldErrors?.parentId) || undefined}>
                <option value="">– keine (oberste Ebene) –</option>
                {parents.map((c) => (
                    <option key={c.id} value={c.id}>
                      {" ".repeat(c.depth)}
                      {c.name}
                    </option>
                  ))}
              </select>
              {state?.fieldErrors?.parentId && <span className="a-field__error">{state.fieldErrors.parentId}</span>}
            </label>
            <label className="a-field">
              <span>Reihenfolge</span>
              <input name="sort" type="number" step={1} defaultValue={current?.sort ?? 0} />
              <small>Kleinere Zahlen stehen weiter oben.</small>
            </label>
          </div>
          <RichText name="description" label="Beschreibung" defaultValue={current?.description ?? ""} minHeight={140} help="Erscheint oben auf der Kategorieseite im Shop." />
          <MediaPicker name="imageId" label="Bild" defaultValue={image ? [image] : []} />
          <SeoFields defaultTitle={current?.seoTitle ?? ""} defaultDescription={current?.seoDescription ?? ""} fallbackTitle={current?.name ?? ""} url={url} />
          <div className="a-actions">
            <Submit>{current ? "Speichern" : "Kategorie erstellen"}</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}
