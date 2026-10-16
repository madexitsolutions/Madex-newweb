"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm, FieldError, Submit } from "@/components/admin/forms";
import { Icon } from "@/components/admin/kit";
import { Uploader } from "@/components/admin/uploader";
import { deleteMediaAction, updateAltAction } from "@/app/admin/media-actions";

export function LibraryUploader({ startOpen }: { startOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  return (
    <section className="a-panel mx-uppanel">
      <div className="mx-uppanel__head">
        <div>
          <h2>Dateien hochladen</h2>
          <p className="a-panel__desc">Bilder für Produkte, Beiträge und Seiten sowie PDF-Dokumente.</p>
        </div>
        <button type="button" className="a-btn a-btn--ghost a-btn--sm" aria-expanded={open} aria-controls="mx-uploader" onClick={() => setOpen(!open)}>
          <Icon name={open ? "close" : "upload"} size={16} />
          {open ? "Ausblenden" : "Hochladen"}
        </button>
      </div>
      <div id="mx-uploader" hidden={!open}>
        <Uploader onDone={(list) => list.length && router.refresh()} />
      </div>
    </section>
  );
}

export function AltForm({ id, alt }: { id: string; alt: string }) {
  return (
    <ActionForm action={updateAltAction} className="mx-altform">
      {(state) => (
        <>
          <input type="hidden" name="id" value={id} />
          <label className="a-field">
            <span>Alternativtext</span>
            <textarea name="alt" defaultValue={alt} rows={2} maxLength={300} aria-invalid={state?.fieldErrors?.alt ? true : undefined} placeholder="Was ist auf dem Bild zu sehen?" />
            <small>Beschreibt das Bild für Screenreader und Suchmaschinen. Leer lassen bei reiner Dekoration.</small>
            <FieldError state={state} name="alt" />
          </label>
          <div>
            <Submit>Speichern</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function DeleteMediaForm({ id, used, back }: { id: string; used: number; back: string }) {
  return (
    <ActionForm action={deleteMediaAction} className="mx-delete">
      {(state) => (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="back" value={back} />
          {used > 0 && (
            <label className="a-check">
              <input type="checkbox" name="confirm" aria-invalid={state?.fieldErrors?.confirm ? true : undefined} />
              <span>
                Trotzdem löschen
                <small>Die Datei verschwindet an {used === 1 ? "der oben genannten Stelle" : `allen ${used} oben genannten Stellen`}.</small>
              </span>
            </label>
          )}
          <Submit variant="danger" pending="Wird gelöscht …">
            Datei löschen
          </Submit>
        </>
      )}
    </ActionForm>
  );
}
