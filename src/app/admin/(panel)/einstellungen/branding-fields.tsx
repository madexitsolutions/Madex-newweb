"use client";

import { useState } from "react";
import { Icon } from "@/components/admin/kit";
import { contrast, formatRatio } from "@/lib/color";

const HEX = /^#[0-9a-fA-F]{6}$/;

function ColorField({ name, label, value, onChange, help }: { name: string; label: string; value: string; onChange: (v: string) => void; help: string }) {
  const [text, setText] = useState(value);
  return (
    <div className="a-field">
      <span id={`${name}-label`}>{label}</span>
      <div className="s-colorfield">
        <input
          type="color"
          aria-labelledby={`${name}-label`}
          value={HEX.test(value) ? value : "#000000"}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value);
          }}
        />
        <input
          type="text"
          name={name}
          value={text}
          maxLength={7}
          spellCheck={false}
          aria-labelledby={`${name}-label`}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setText(v);
            if (HEX.test(v)) onChange(v);
          }}
        />
      </div>
      <small>{help}</small>
    </div>
  );
}

function Rating({ ratio, min }: { ratio: number; min: number }) {
  const okay = ratio >= min;
  return (
    <span className={`a-pill ${okay ? "a-pill--ok" : "a-pill--bad"}`}>
      {okay ? "Gut lesbar" : "Zu wenig Kontrast"}
    </span>
  );
}

/** Colour pickers with a live preview of the sidebar and a WCAG contrast check. */
export function BrandingFields({ primary, accent, siteName, logoDark }: { primary: string; accent: string; siteName: string; logoDark: string }) {
  const [p, setP] = useState(primary);
  const [a, setA] = useState(accent);
  const rp = contrast(p, "#ffffff");
  const ra = contrast(a, "#ffffff");
  return (
    <div className="s-brand">
      <div className="a-stack">
        <ColorField name="primaryColor" label="Hauptfarbe" value={p} onChange={setP} help="Seitenleiste, Hauptknöpfe und E-Mail-Kopf. Weisse Schrift muss gut lesbar sein." />
        <ColorField name="accentColor" label="Akzentfarbe" value={a} onChange={setA} help="Aktive Elemente, Markierungen und Fokusrahmen." />
        <ul className="s-contrast" aria-live="polite">
          <li>
            <span>
              Weiss auf Hauptfarbe <b>{formatRatio(rp)}</b>
            </span>
            <Rating ratio={rp} min={4.5} />
          </li>
          <li>
            <span>
              Akzent auf Weiss <b>{formatRatio(ra)}</b>
            </span>
            <Rating ratio={ra} min={3} />
          </li>
        </ul>
        <p className="a-footnote" style={{ margin: 0 }}>
          Mindestwerte nach WCAG: 4.5 : 1 für Text, 3 : 1 für Bedienelemente. Eine zu helle Hauptfarbe wird nicht gespeichert.
        </p>
      </div>
      <figure className="s-preview" aria-label="Vorschau der Navigation" style={{ margin: 0 }}>
        <div className="s-preview__side" style={{ background: p }}>
          <div className="s-preview__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoDark ? <img src={logoDark} alt="" /> : siteName}
          </div>
          <span className="s-preview__item is-active" style={{ color: p }}>
            <span style={{ color: a, display: "inline-flex" }}>
              <Icon name="home" size={16} />
            </span>
            Übersicht
          </span>
          <span className="s-preview__item">
            <Icon name="cart" size={16} />
            Bestellungen
          </span>
          <span className="s-preview__item">
            <Icon name="file" size={16} />
            Beiträge
          </span>
        </div>
        <div className="s-preview__body">
          <div className="s-preview__tabs">
            <span style={{ borderBottomColor: a, color: p }}>Aktiv</span>
            <span>Weitere</span>
          </div>
          <span className="s-preview__btn" style={{ background: p }}>
            Speichern
          </span>
        </div>
        <figcaption className="sr-only">Vorschau mit den gewählten Farben</figcaption>
      </figure>
    </div>
  );
}
