"use client";

import { useRef, useState, type DragEvent } from "react";
import { Icon } from "./kit";
import type { MediaRef } from "@/server/media/library";

export const UPLOAD_URL = "/admin/medien/hochladen";
const MAX = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WebP", "image/gif": "GIF", "image/avif": "AVIF", "image/svg+xml": "SVG", "application/pdf": "PDF" };

type Item = { key: string; name: string; size: number; progress: number; state: "queued" | "uploading" | "done" | "error"; error?: string; media?: MediaRef };

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString("de-CH", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function send(file: File, onProgress: (p: number) => void): Promise<MediaRef> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", UPLOAD_URL);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const body = xhr.response as { media?: MediaRef; error?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.media) resolve(body.media);
      else reject(new Error(body?.error ?? (xhr.status === 413 ? "Die Datei ist zu gross." : `Hochladen fehlgeschlagen (HTTP ${xhr.status}).`)));
    };
    xhr.onerror = () => reject(new Error("Keine Verbindung zum Server. Bitte erneut versuchen."));
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

/**
 * Drag & drop / file chooser for several files with per-file progress and
 * errors. Calls onUploaded for each stored file and onDone when the batch ends.
 */
export function Uploader({ onUploaded, onDone, imagesOnly = false, compact = false }: { onUploaded?: (m: MediaRef) => void; onDone?: (uploaded: MediaRef[]) => void; imagesOnly?: boolean; compact?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const accept = Object.keys(TYPES).filter((t) => !imagesOnly || t.startsWith("image/"));

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function start(files: File[]) {
    if (!files.length) return;
    const batch: { item: Item; file: File }[] = files.map((file, i) => {
      const key = `${Date.now()}-${i}-${file.name}`;
      let error: string | undefined;
      if (!accept.includes(file.type)) error = `Dateityp nicht erlaubt. Erlaubt: ${accept.map((t) => TYPES[t]).join(", ")}.`;
      else if (file.size > MAX) error = `Grösser als 10 MB (${kb(file.size)}). Bitte verkleinern.`;
      return { file, item: { key, name: file.name, size: file.size, progress: 0, state: error ? "error" : "queued", error } };
    });
    setItems((list) => [...batch.map((b) => b.item), ...list].slice(0, 50));
    const queue = batch.filter((b) => b.item.state === "queued");
    const done: MediaRef[] = [];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const { item, file } = next;
        patch(item.key, { state: "uploading" });
        try {
          const m = await send(file, (p) => patch(item.key, { progress: p }));
          patch(item.key, { state: "done", progress: 100, media: m });
          done.push(m);
          onUploaded?.(m);
        } catch (e) {
          patch(item.key, { state: "error", error: e instanceof Error ? e.message : "Fehler beim Hochladen." });
        }
      }
    };
    await Promise.all([worker(), worker()]);
    onDone?.(done);
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void start([...e.dataTransfer.files]);
  };

  const active = items.some((i) => i.state === "uploading" || i.state === "queued");

  return (
    <div className="mx-up">
      <div
        className={`mx-drop${over ? " is-over" : ""}${compact ? " mx-drop--compact" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <span className="mx-drop__icon">
          <Icon name="upload" size={22} />
        </span>
        <p>
          <strong>Dateien hierher ziehen</strong> oder{" "}
          <button type="button" className="mx-drop__pick" onClick={() => input.current?.click()}>
            vom Gerät auswählen
          </button>
        </p>
        <small>
          {imagesOnly ? "JPG, PNG, WebP, GIF, AVIF oder SVG" : "Bilder (JPG, PNG, WebP, GIF, AVIF, SVG) und PDF"} · max. 10 MB pro Datei · mehrere gleichzeitig möglich
        </small>
        <input
          ref={input}
          type="file"
          multiple
          accept={accept.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label="Dateien auswählen"
          onChange={(e) => {
            void start([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>
      {items.length > 0 && (
        <ul className="mx-queue" aria-live="polite" aria-busy={active}>
          {items.map((i) => (
            <li key={i.key} className={`mx-queue__item is-${i.state}`}>
              <span className="mx-queue__icon" aria-hidden="true">
                <Icon name={i.state === "done" ? "check" : i.state === "error" ? "alert" : "upload"} size={16} />
              </span>
              <span className="mx-queue__main">
                <span className="mx-queue__name">{i.name}</span>
                {i.state === "error" ? (
                  <small className="a-warn">{i.error}</small>
                ) : (
                  <span className="mx-queue__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={i.progress} aria-label={`Fortschritt ${i.name}`}>
                    <i style={{ width: `${i.progress}%` }} />
                  </span>
                )}
              </span>
              <small className="mx-queue__state">{i.state === "done" ? "Fertig" : i.state === "error" ? "Fehler" : i.state === "queued" ? "Wartet" : `${i.progress} %`}</small>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && !active && (
        <button type="button" className="a-btn a-btn--quiet a-btn--sm mx-queue__clear" onClick={() => setItems([])}>
          Liste leeren
        </button>
      )}
    </div>
  );
}
