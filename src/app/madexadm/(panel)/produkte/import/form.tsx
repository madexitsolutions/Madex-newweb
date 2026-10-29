"use client";

import { useRef, useState } from "react";
import { ActionForm, Submit } from "@/components/admin/forms";
import { Icon } from "@/components/admin/kit";
import { runImportAction, uploadImportAction } from "../actions";

export function UploadForm() {
  const [name, setName] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <ActionForm action={uploadImportAction} className="a-stack">
      <label
        className={`s-drop${over ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const files = e.dataTransfer.files;
          if (!files.length || !input.current) return;
          input.current.files = files;
          setName(files[0].name);
        }}
      >
        <Icon name="upload" size={22} />
        {name ? <strong>{name}</strong> : <strong>CSV-Datei auswählen</strong>}
        <span>{name ? "Andere Datei wählen" : "oder hierher ziehen (max. 10 MB)"}</span>
        <input ref={input} type="file" name="file" accept=".csv,text/csv" required onChange={(e) => setName(e.currentTarget.files?.[0]?.name ?? "")} />
      </label>
      <div className="a-actions">
        <Submit pending="Datei wird geprüft …">Vorschau anzeigen</Submit>
      </div>
    </ActionForm>
  );
}

export function RunForm({ token, images, disabled }: { token: string; images: number; disabled: boolean }) {
  return (
    <ActionForm action={runImportAction} className="a-stack">
      <input type="hidden" name="datei" value={token} />
      {images > 0 && (
        <label className="a-check">
          <input type="checkbox" name="images" defaultChecked />
          <span>
            {images} Bild{images === 1 ? "" : "er"} herunterladen und in der Mediathek speichern
            <small>Ohne Häkchen werden die Produkte ohne Bilder angelegt. Das Laden kann einige Minuten dauern.</small>
          </span>
        </label>
      )}
      <div className="a-actions">
        <Submit pending="Import läuft … bitte Seite offen lassen" disabled={disabled}>
          Import starten
        </Submit>
      </div>
    </ActionForm>
  );
}
