"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { homeFaq, packages, site } from "@/content/site";
import { services } from "@/content/services";
import { Icon } from "@/components/ui/Icon";
import { MarkSvg } from "@/components/ui/MarkSvg";
import { Link } from "./Transition";

type Msg = { from: "orion" | "user"; text: string; links?: { label: string; href: string }[] };

const START: Msg = {
  from: "orion",
  text: "Hallo, ich bin Orion 👋 Ich beantworte Ihre Fragen zu Website, Google und Social Media, helfe Ihnen das passende Paket zu finden und leite Ihre Terminanfrage weiter.",
};

const TOPICS: { label: string; reply: () => Msg }[] = [
  {
    label: "Frage stellen",
    reply: () => ({
      from: "orion",
      text: "Gerne! Hier sind die häufigsten Fragen. " + homeFaq[0].a,
      links: [
        { label: "Alle FAQ ansehen", href: "/#faq" },
        { label: "Persönlich fragen", href: "/kontakt" },
      ],
    }),
  },
  {
    label: "Termin anfragen",
    reply: () => ({
      from: "orion",
      text: `Am schnellsten über unser Formular – oder direkt telefonisch unter ${site.contact.phonePrimary.label}. Wir melden uns, um Ihren Wunschtermin zu bestätigen.`,
      links: [{ label: "Kostenloses Erstgespräch buchen", href: "/kostenlose-prufung" }],
    }),
  },
  {
    label: "Passendes Paket finden",
    reply: () => ({
      from: "orion",
      text: `Wir bieten drei Pakete: ${packages.map((p) => p.name).join(", ")}. Basic kombiniert Social Media & Website, Premium ergänzt Google Ads. Website-Wartung: 250 CHF/Monat inkl. Domain und Hosting.`,
      links: [
        { label: "Pakete vergleichen", href: "/#pakete" },
        { label: "Beratung anfragen", href: "/kostenlose-prufung" },
      ],
    }),
  },
  {
    label: "Unsere Leistungen",
    reply: () => ({
      from: "orion",
      text: "Wir unterstützen Sie in acht Bereichen:",
      links: services.map((s) => ({ label: s.name, href: `/marketing-solutions/${s.slug}` })),
    }),
  },
  {
    label: "Ich bin bereits Kunde",
    reply: () => ({
      from: "orion",
      text: `Schön, von Ihnen zu hören! Für Änderungen an Ihrer Website schreiben Sie uns an ${site.contact.email} oder rufen Sie an: ${site.contact.phonePrimary.label}.`,
      links: [{ label: "E-Mail schreiben", href: `mailto:${site.contact.email}` }],
    }),
  },
];

export function Orion() {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([START]);
  const [typing, setTyping] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTeaser(true), 6000);
    const t2 = setTimeout(() => setTeaser(false), 16000);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  const ask = (i: number) => {
    const topic = TOPICS[i];
    setMsgs((m) => [...m, { from: "user", text: topic.label }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, topic.reply()]);
    }, 750);
  };

  return (
    <div className="orion">
      <AnimatePresence>
        {open && (
          <motion.div
            className="orion__panel"
            role="dialog"
            aria-label="Orion – Assistent von Madex IT Solutions"
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="orion__head">
              <span className="orion__avatar">
                <MarkSvg />
              </span>
              <div>
                <strong>Orion</strong>
                <small>Assistent von Madex IT Solutions</small>
              </div>
              <button className="orion__x" onClick={() => setOpen(false)} aria-label="Assistent schliessen">
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="orion__body" ref={body} data-lenis-prevent aria-live="polite">
              {msgs.map((m, i) => (
                <motion.div key={i} className={`orion__msg orion__msg--${m.from}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <p>{m.text}</p>
                  {m.links && (
                    <div className="orion__links">
                      {m.links.map((l) => (
                        <Link key={l.href + l.label} href={l.href} onClick={() => setOpen(false)}>
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
              {typing && (
                <div className="orion__msg orion__msg--orion orion__typing" aria-label="Orion schreibt">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>
            <div className="orion__chips">
              {TOPICS.map((t, i) => (
                <button key={t.label} onClick={() => ask(i)}>
                  {t.label}
                </button>
              ))}
            </div>
            <p className="orion__note">
              Orion beantwortet häufige Fragen. Persönliche Anfragen bearbeitet unser Team. <Link href="/datenschutz">Datenschutz</Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {teaser && !open && (
          <motion.button
            className="orion__teaser"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            Hallo 👋 Können wir Ihnen helfen?
          </motion.button>
        )}
      </AnimatePresence>

      <button className={`orion__fab${open ? " is-open" : ""}`} onClick={() => setOpen(!open)} aria-label={open ? "Assistent schliessen" : "Mit Orion chatten"} aria-expanded={open}>
        <span className="orion__ping" />
        <Icon name={open ? "close" : "chat"} size={24} />
      </button>

      <style>{`
        .orion{position:fixed;right:20px;bottom:20px;z-index:700;display:flex;flex-direction:column;align-items:flex-end;gap:12px}
        .orion__fab{position:relative;width:62px;height:62px;border-radius:50%;background:linear-gradient(135deg,var(--teal),var(--petrol));color:#fff;display:grid;place-items:center;
          box-shadow:0 18px 40px -12px rgba(2,141,134,.8);transition:transform .4s var(--ease-out)}
        .orion__fab:hover{transform:scale(1.08) rotate(-6deg)}
        .orion__ping{position:absolute;inset:0;border-radius:50%;border:2px solid var(--teal-glow);animation:ping 2.4s ease-out infinite}
        .orion__fab.is-open .orion__ping{display:none}
        @keyframes ping{from{transform:scale(1);opacity:.8}to{transform:scale(1.7);opacity:0}}
        @media(max-width:600px){.orion__teaser{display:none}}
        .orion__teaser{background:#fff;color:var(--text);padding:12px 18px;border-radius:18px 18px 4px 18px;font-size:14px;box-shadow:0 20px 40px -20px rgba(0,0,0,.4)}
        .orion__panel{width:min(380px,calc(100vw - 40px));max-height:min(620px,calc(100vh - 120px));display:flex;flex-direction:column;border-radius:26px;overflow:hidden;
          background:#fff;color:var(--text);box-shadow:0 40px 100px -30px rgba(1,27,30,.6);transform-origin:bottom right}
        .orion__head{display:flex;align-items:center;gap:12px;padding:16px 18px;background:linear-gradient(135deg,var(--petrol),var(--night));color:#fff}
        .orion__head strong{display:block;font:700 17px/1.1 var(--font-display)}
        .orion__head small{opacity:.7;font-size:12.5px}
        .orion__avatar{width:42px;height:42px;border-radius:12px;background:#fff;display:grid;place-items:center;padding:7px}
        .orion__avatar svg{width:100%;height:auto}
        .orion__x{margin-left:auto;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.12)}
        .orion__body{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:10px;background:var(--mist)}
        .orion__msg{max-width:88%;padding:12px 15px;border-radius:18px;font-size:14.5px;line-height:1.5}
        .orion__msg p{margin:0}
        .orion__msg--orion{background:#fff;border-bottom-left-radius:4px;box-shadow:0 6px 20px -14px rgba(0,0,0,.3)}
        .orion__msg--user{align-self:flex-end;background:var(--teal);color:#fff;border-bottom-right-radius:4px}
        .orion__links{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
        .orion__links a{font-size:13px;padding:6px 11px;border-radius:999px;background:rgba(2,141,134,.1);color:var(--petrol);font-weight:500}
        .orion__links a:hover{background:var(--teal);color:#fff}
        .orion__typing{display:flex;gap:5px}
        .orion__typing span{width:7px;height:7px;border-radius:50%;background:var(--teal);animation:dot 1s infinite alternate}
        .orion__typing span:nth-child(2){animation-delay:.2s}.orion__typing span:nth-child(3){animation-delay:.4s}
        @keyframes dot{to{opacity:.2;transform:translateY(-4px)}}
        .orion__chips{display:flex;flex-wrap:wrap;gap:6px;padding:12px 14px;border-top:1px solid var(--line)}
        .orion__chips button{font-size:13px;padding:7px 12px;border-radius:999px;border:1px solid rgba(2,81,89,.25);color:var(--petrol);transition:.3s}
        .orion__chips button:hover{background:var(--petrol);color:#fff;border-color:var(--petrol)}
        .orion__note{margin:0;padding:0 14px 12px;font-size:11.5px;color:var(--text-soft)}
        .orion__note a{text-decoration:underline}
      `}</style>
    </div>
  );
}
