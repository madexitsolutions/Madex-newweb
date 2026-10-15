"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { Link } from "@/components/layout/Transition";

const ease = [0.16, 1, 0.3, 1] as const;

function QuickAnalysis() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    setMsg("");
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: f.get("website"), email: f.get("email"), fax: f.get("fax") }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; reference?: string };
      if (!json.ok) {
        setState("error");
        setMsg(json.error || "Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.");
        return;
      }
      setState("done");
      setMsg(json.reference ?? "");
    } catch {
      setState("error");
      setMsg("Keine Verbindung. Bitte prüfen Sie Ihr Internet und versuchen Sie es erneut.");
    }
  };

  if (state === "done") {
    return (
      <div className="hq hq--done" role="status">
        <span className="hq__tick" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p>
          <strong>Danke, Ihre Analyse ist angefragt.</strong> Wir melden uns innerhalb von 24 Stunden. {msg && <span className="hq__ref">Referenz {msg}</span>}
        </p>
      </div>
    );
  }

  return (
    <form className="hq" onSubmit={submit} noValidate={false}>
      <label className="hq__field">
        <span className="sr-only">Ihre Website (optional)</span>
        <input name="website" type="text" inputMode="url" autoComplete="url" placeholder="Ihre Website (optional)" maxLength={200} />
      </label>
      <label className="hq__field">
        <span className="sr-only">Ihre E-Mail</span>
        <input name="email" type="email" autoComplete="email" required placeholder="Ihre E-Mail" maxLength={200} />
      </label>
      <input name="fax" tabIndex={-1} autoComplete="off" className="hq__hp" aria-hidden="true" />
      <button type="submit" className="hq__btn" disabled={state === "sending"}>
        {state === "sending" ? "Wird gesendet …" : "Gratis-Analyse"}
      </button>
      {state === "error" && (
        <p className="hq__error" role="alert">
          {msg}
        </p>
      )}
    </form>
  );
}

/** Five real things Madex delivers, laid out like a desk of work in progress. */
function Collage() {
  const reduce = useReducedMotion();
  const card = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 24, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { delay: 0.35 + i * 0.12, duration: 0.8, ease },
  });
  return (
    <div className="hc" aria-hidden="true">
      <motion.div className="hc__card hc__ai" {...card(0)}>
        <div className="hc__ai-head">
          <span className="hc__spark">
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" />
            </svg>
          </span>
          <strong>KI-Analyse</strong>
          <small>ihre-firma.ch</small>
        </div>
        {[
          ["Ladezeit", 92],
          ["Google-Sichtbarkeit", 64],
          ["Smartphone", 88],
          ["Kontaktanfragen", 41],
        ].map(([k, v]) => (
          <div key={k} className="hc__metric">
            <span>{k}</span>
            <b>{v}</b>
            <i>
              <em style={{ width: `${v}%` }} className={Number(v) < 50 ? "is-low" : undefined} />
            </i>
          </div>
        ))}
        <p className="hc__tip">3 Verbesserungen gefunden</p>
      </motion.div>

      <motion.div className="hc__card hc__leads" {...card(1)}>
        <small>Neue Leads</small>
        <strong>
          +38 <span>%</span>
        </strong>
        <svg viewBox="0 0 200 70" className="hc__spark-line">
          <defs>
            <linearGradient id="hcg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#028d86" stopOpacity=".28" />
              <stop offset="1" stopColor="#028d86" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 58 L33 52 L66 55 L100 40 L133 34 L166 20 L200 8 L200 70 L0 70Z" fill="url(#hcg)" />
          <path d="M0 58 L33 52 L66 55 L100 40 L133 34 L166 20 L200 8" fill="none" stroke="#028d86" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="200" cy="8" r="4" fill="#028d86" />
        </svg>
        <div className="hc__months">
          <span>Mai</span>
          <span>Okt</span>
        </div>
      </motion.div>

      <motion.div className="hc__card hc__code" {...card(2)}>
        <div className="hc__dots">
          <i />
          <i />
          <i />
        </div>
        <pre>
          <span className="t-k">export default</span> <span className="t-f">function</span> Startseite() {"{"}
          {"\n  "}
          <span className="t-k">return</span> {"<"}
          <span className="t-t">Hero</span> <span className="t-a">ziel</span>=<span className="t-s">&quot;neue Kunden&quot;</span> {"/>"}
          {"\n}"}
        </pre>
      </motion.div>

      <motion.div className="hc__card hc__brand" {...card(3)}>
        <small>Brand Design</small>
        <div className="hc__swatches">
          <i style={{ background: "#01363b" }} />
          <i style={{ background: "#028d86" }} />
          <i style={{ background: "#9fd8d2" }} />
          <i style={{ background: "#ffbe11" }} />
        </div>
        <div className="hc__type">
          <b>Aa</b>
          <span>
            Schibsted Grotesk
            <br />
            Regular, Bold
          </span>
        </div>
      </motion.div>

      <motion.div className="hc__card hc__rank" {...card(4)}>
        <div className="hc__g">
          <span className="hc__glogo">G</span>
          <span className="hc__query">webdesign schaffhausen</span>
        </div>
        <div className="hc__result">
          <span className="hc__pos">#1</span>
          <div>
            <small>ihre-firma.ch</small>
            <strong>Ihre Firma – Ihr Partner in Schaffhausen</strong>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const fade = (d: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: d, duration: 0.7, ease },
  });
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero__grid">
        <div className="hero__copy">
          <motion.div {...fade(0.05)}>
            <Link href="/#angebot" className="hero__badge">
              <span>Neu</span>
              Website im Wert von CHF 8’000 – inklusive
            </Link>
          </motion.div>
          <motion.h1 id="hero-title" className="hero__title" {...fade(0.12)}>
            Wir verwandeln Design in neue Kunden.
          </motion.h1>
          <motion.p className="hero__lead" {...fade(0.2)}>
            Webdesign, Google Ads, SEO, Social Media und KI – alles aus einer Hand für Schweizer KMU. Persönlich betreut, messbar erfolgreich.
          </motion.p>
          <motion.div {...fade(0.28)}>
            <QuickAnalysis />
          </motion.div>
          <motion.ul className="hero__trust" {...fade(0.36)}>
            <li>
              <span className="hero__stars" aria-hidden="true">
                ★★★★<span>★</span>
              </span>
              <strong>4.4</strong> auf Google
            </li>
            <li>
              <strong>100+</strong> Kunden
            </li>
            <li>
              Antwort in <strong>24h</strong>
            </li>
          </motion.ul>
        </div>
        <Collage />
      </div>
    </section>
  );
}
