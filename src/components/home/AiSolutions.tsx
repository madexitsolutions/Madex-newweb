"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type Case = {
  key: string;
  tab: string;
  example: string;
  input: { title: string; text: string };
  ai: { title: string; text: string };
  output: { title: string; text: string };
  icon: ReactNode;
};

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const CASES: Case[] = [
  {
    key: "auto",
    tab: "Abläufe automatisieren",
    example: "Beispiel: Schreinerei mit vielen Offertanfragen",
    input: { title: "Anfrage per E-Mail oder Formular", text: "«Wir bräuchten einen Einbauschrank, ca. 2.4 m breit, Montage im März.»" },
    ai: { title: "KI liest und ordnet ein", text: "Erkennt Leistung, Masse, Wunschtermin und Kontaktdaten und ergänzt Standardpositionen." },
    output: { title: "Offertentwurf in Ihrer Software", text: "Ihr Team prüft, passt an und sendet – statt alles abzutippen." },
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <circle cx="12" cy="12" r="3.2" {...S} />
        <path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5" {...S} />
      </svg>
    ),
  },
  {
    key: "docs",
    tab: "Dokumente auswerten",
    example: "Beispiel: Treuhandbüro mit Belegen und Verträgen",
    input: { title: "PDFs, Belege, Verträge", text: "Rechnungen, Lieferscheine und Verträge in unterschiedlichen Formaten." },
    ai: { title: "KI liest die relevanten Angaben", text: "Beträge, Fristen, Vertragsparteien und Positionen – zusammengefasst und geprüft." },
    output: { title: "Strukturierte Daten", text: "Direkt in Buchhaltung, Fristenliste oder Tabelle übertragen." },
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...S} />
        <path d="M14 3v5h5M9 13h6M9 17h4" {...S} />
      </svg>
    ),
  },
  {
    key: "assist",
    tab: "Assistenten",
    example: "Beispiel: Garage mit vielen Kundenfragen",
    input: { title: "Kundenfrage auf der Website", text: "«Haben Sie am Samstag offen? Ich brauche neue Winterreifen.»" },
    ai: { title: "Antwortet mit Ihrem Wissen", text: "Kennt Öffnungszeiten, Preise und Abläufe und erfindet nichts dazu." },
    output: { title: "Terminanfrage im Postfach", text: "Mit allen Angaben und Referenznummer – Ihr Team bestätigt." },
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M20 12.5a7.5 7.5 0 0 1-10.9 6.7L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5z" {...S} />
        <path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01" {...S} strokeWidth={2.6} />
      </svg>
    ),
  },
  {
    key: "content",
    tab: "Inhalte",
    example: "Beispiel: Online-Shop mit neuen Produkten",
    input: { title: "Produktdaten und Notizen", text: "Technische Angaben, Stichworte und Fotos zu einem neuen Artikel." },
    ai: { title: "Texte im Ton Ihrer Marke", text: "Produktbeschreibung, Social-Media-Beitrag und Übersetzung in FR, IT und EN." },
    output: { title: "Entwürfe zur Freigabe", text: "Sie lesen gegen, passen an und veröffentlichen." },
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" {...S} />
        <path d="M13.5 6.5l4 4" {...S} />
      </svg>
    ),
  },
  {
    key: "integrate",
    tab: "Integration",
    example: "Beispiel: Dienstleister mit CRM, Kalender und Buchhaltung",
    input: { title: "Ihre bestehenden Programme", text: "CRM, ERP, Online-Shop, Kalender, E-Mail – oft ohne Verbindung." },
    ai: { title: "KI über Schnittstellen verbunden", text: "Daten fliessen automatisch dorthin, wo sie gebraucht werden." },
    output: { title: "Kein zusätzliches Tool", text: "Ihr Team arbeitet wie gewohnt, nur mit weniger Handarbeit." },
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0z" {...S} />
        <path d="M12 16v5" {...S} />
      </svg>
    ),
  },
];

function Node({ kind, title, text, delay }: { kind: "in" | "ai" | "out"; title: string; text: string; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      className={`aiu__node aiu__node--${kind}`}
      initial={reduce ? false : { opacity: 0.2, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: reduce ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="aiu__badge" aria-hidden="true">
        {kind === "in" && (
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M4 7l8 6 8-6M4 6h16v12H4z" {...S} />
          </svg>
        )}
        {kind === "ai" && (
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M12 3.5l1.9 5.2 5.2 1.9-5.2 1.9-1.9 5.2-1.9-5.2-5.2-1.9 5.2-1.9z" {...S} />
            <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" {...S} strokeWidth={1.4} />
          </svg>
        )}
        {kind === "out" && (
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M5 12.5l4.5 4.5L19 7" {...S} strokeWidth={2.2} />
          </svg>
        )}
      </span>
      <div>
        <span className="aiu__step">{kind === "in" ? "Eingang" : kind === "ai" ? "KI-Schritt" : "Ergebnis"}</span>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </motion.li>
  );
}

/** Interactive overview of the AI solutions Madex builds, each as input → AI step → result. */
export function AiUseCases() {
  const [active, setActive] = useState(0);
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const c = CASES[active];

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = CASES.length - 1;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = active === last ? 0 : active + 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = active === 0 ? last : active - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = last;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="aiu">
      <div className="aiu__grid">
        <div className="aiu__tabs" role="tablist" aria-label="Einsatzbereiche" aria-orientation="vertical">
          {CASES.map((cs, i) => (
            <button
              key={cs.key}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-t${i}`}
              aria-selected={i === active}
              aria-controls={`${id}-p`}
              tabIndex={i === active ? 0 : -1}
              className="aiu__tab"
              onClick={() => setActive(i)}
              onKeyDown={onKey}
            >
              <span className="aiu__tab-ic">{cs.icon}</span>
              <span className="aiu__tab-txt">
                <span className="aiu__tab-label">{cs.tab}</span>
                <span className="aiu__tab-sub">{cs.example.replace(/^Beispiel:\s*/, "")}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="aiu__panel" role="tabpanel" id={`${id}-p`} aria-labelledby={`${id}-t${active}`}>
          <div className="aiu__head">
            <p className="aiu__title">{c.tab}</p>
            <p className="aiu__example">{c.example}</p>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.ol key={c.key} className="aiu__flow" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
              <Node kind="in" {...c.input} delay={0} />
              <Node kind="ai" {...c.ai} delay={0.08} />
              <Node kind="out" {...c.output} delay={0.16} />
            </motion.ol>
          </AnimatePresence>
        </div>
      </div>
      <style>{`
        .aiu{container:aiu/inline-size;position:relative;color:#e4f1f0;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02)) ,#022b2f;border:1px solid rgba(255,255,255,.1);border-radius:24px;overflow:hidden;box-shadow:0 50px 100px -60px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.08)}
        .aiu__grid{display:grid;grid-template-columns:minmax(220px,300px) minmax(0,1fr)}
        .aiu::before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,rgba(127,227,217,.55),transparent);pointer-events:none}
        .aiu__tabs{display:grid;align-content:start;gap:4px;padding:14px;border-right:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.14)}
        .aiu__tab{display:flex;align-items:flex-start;gap:12px;width:100%;min-height:56px;padding:12px 14px;border-radius:14px;text-align:left;color:rgba(228,241,240,.72);transition:background .25s,color .25s}
        .aiu__tab:hover{background:rgba(255,255,255,.05);color:#fff}
        .aiu__tab[aria-selected="true"]{background:rgba(255,255,255,.09);color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
        .aiu__tab:focus-visible{outline:2px solid #7fe3d9;outline-offset:2px}
        .aiu__tab-ic{flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:rgba(127,227,217,.1);color:#7fe3d9;transition:background .25s,color .25s}
        .aiu__tab[aria-selected="true"] .aiu__tab-ic{background:#7fe3d9;color:var(--deep)}
        .aiu__tab-ic svg{width:18px;height:18px}
        .aiu__tab-txt{display:grid;gap:2px;min-width:0}
        .aiu__tab-label{font:600 14.5px/1.3 var(--font-body)}
        .aiu__tab-sub{font-size:12.5px;line-height:1.4;color:rgba(228,241,240,.55)}
        .aiu__panel{padding:clamp(22px,3vw,36px);display:grid;align-content:start;gap:24px;min-width:0}
        .aiu__head{display:grid;gap:4px}
        .aiu__title{margin:0;font:600 clamp(19px,1.6vw,22px)/1.25 var(--font-display);color:#fff;letter-spacing:-.01em}
        .aiu__example{margin:0;font-size:14px;color:rgba(228,241,240,.62)}
        .aiu__flow{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;position:relative}
        .aiu__node{position:relative;display:grid;align-content:start;gap:14px;padding:18px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09)}
        .aiu__node + .aiu__node::before{content:"";position:absolute;left:-28px;top:38px;width:28px;height:1px;background:linear-gradient(90deg,rgba(127,227,217,.15),rgba(127,227,217,.7))}
        .aiu__node + .aiu__node::after{content:"";position:absolute;left:-7px;top:35px;border:3.5px solid transparent;border-left:5px solid rgba(127,227,217,.8)}
        .aiu__badge{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.07);color:#7fe3d9;border:1px solid rgba(255,255,255,.1)}
        .aiu__step{display:block;font-size:12px;font-weight:600;letter-spacing:.02em;color:#7fe3d9;margin-bottom:4px}
        .aiu__node strong{display:block;font:600 16px/1.3 var(--font-display);color:#fff;letter-spacing:-.005em}
        .aiu__node p{margin:6px 0 0;font-size:14px;line-height:1.55;color:rgba(228,241,240,.72)}
        .aiu__node--ai{background:radial-gradient(120% 90% at 50% 0%,rgba(255,190,17,.16),rgba(255,190,17,0) 60%),rgba(255,255,255,.06);border-color:rgba(255,190,17,.38);box-shadow:0 24px 50px -30px rgba(255,190,17,.45)}
        .aiu__node--ai .aiu__badge{background:var(--sun);border-color:var(--sun);color:var(--deep)}
        .aiu__node--ai .aiu__step{color:#ffd76a}
        .aiu__node--out .aiu__badge{background:#7fe3d9;border-color:#7fe3d9;color:var(--deep)}
        @container aiu (max-width:760px){.aiu__grid{grid-template-columns:minmax(0,1fr)}.aiu__tabs{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;padding:12px;border-right:0;border-bottom:1px solid rgba(255,255,255,.08)}.aiu__tab{min-height:48px;padding:9px 10px;align-items:center;gap:9px;border-radius:12px}.aiu__tab-sub{display:none}.aiu__tab-ic{width:28px;height:28px;border-radius:8px}.aiu__tab-label{font-size:13.5px;line-height:1.25}}
        @container aiu (max-width:640px){.aiu__flow{grid-template-columns:minmax(0,1fr);gap:22px}.aiu__node{grid-template-columns:40px minmax(0,1fr);gap:14px}.aiu__node + .aiu__node::before{left:38px;top:-22px;width:1px;height:22px;background:linear-gradient(rgba(127,227,217,.15),rgba(127,227,217,.7))}.aiu__node + .aiu__node::after{display:none}.aiu__panel{padding:20px 16px}}
      `}</style>
    </div>
  );
}
