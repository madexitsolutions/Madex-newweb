"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useTransition } from "@/components/layout/Transition";

const WORDS = ["Design", "Websites", "Marketing", "KI"];

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------ icons */
const I = {
  globe: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm18 3-10 6L2 7",
  arrow: "M5 12h14M13 5l7 7-7 7",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm13 18v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4v6l4 2",
  lock: "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm2 0V7a5 5 0 0 1 10 0v4",
  spark: "M12 3l1.9 5.8L20 10.7l-6.1 1.9L12 18.5l-1.9-5.9L4 10.7l6.1-1.9zM19 3v4M17 5h4M5 17v4M3 19h4",
  trend: "m22 7-8.5 8.5-5-5L2 17M16 7h6v6",
  pen: "m12 19 7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.6 7.6M11 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
};
function Svg({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/* ------------------------------------------------- particle network */
function Network() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const colors = ["79,224,210", "25,179,169", "159,243,234"];
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    const mouse = { x: -9999, y: -9999 };
    let pts: { x: number; y: number; vx: number; vy: number; r: number; c: string; p: number }[] = [];
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(100, Math.floor((w * h) / 15000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: Math.random() * 1.5 + 0.6,
        c: colors[(Math.random() * 3) | 0],
        p: Math.random() * Math.PI * 2,
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const max = 130;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx;
        p.y += p.vy;
        p.p += 0.03;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dm = Math.hypot(dx, dy);
        if (dm < 150 && dm > 0) {
          p.x += (dx / dm) * 0.7;
          p.y += (dy / dm) * 0.7;
        }
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < max) {
            ctx.strokeStyle = `rgba(${p.c},${(1 - d / max) * 0.24})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
        if (dm < 190) {
          ctx.strokeStyle = `rgba(79,224,210,${(1 - dm / 190) * 0.45})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(${p.c},${0.55 + Math.sin(p.p) * 0.35})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    resize();
    const host = canvas.parentElement!;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -9999;
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", resize);
    if (reduced()) {
      draw();
      cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(([e]) => {
      if (reduced()) return;
      if (e.isIntersecting && !running) {
        running = true;
        draw();
      } else if (!e.isIntersecting && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="hx__canvas" aria-hidden="true" />;
}

/* --------------------------------------------------- rotating word */
function Rotator() {
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  useEffect(() => {
    if (reduced()) return;
    const t = setInterval(() => {
      setI((cur) => {
        setPrev(cur);
        return (cur + 1) % WORDS.length;
      });
    }, 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="hx__rot" aria-hidden="true">
      {/* words drawn via CSS content so they stay out of the heading's text */}
      {WORDS.map((w, k) => (
        <span key={w} data-word={w} className={k === i ? "on" : k === prev ? "off" : ""} />
      ))}
    </span>
  );
}

/* -------------------------------------------------------- AI card */
const AI_STEPS: [string, string, number][] = [
  ["Analysiere Ihre Website", "…", 35],
  ["SEO-Score geprüft:", " +38 Punkte möglich", 65],
  ["Konkurrenz-Check:", " 3 Chancen gefunden", 85],
  ["Fertig!", " 12 neue Leads/Monat Potenzial", 100],
];
function AiCard() {
  const [k, setK] = useState(0);
  const [width, setWidth] = useState(0);
  const [instant, setInstant] = useState(false);
  useEffect(() => {
    setWidth(AI_STEPS[0][2]);
    if (reduced()) return;
    let step = 0;
    const t = setInterval(() => {
      step = (step + 1) % AI_STEPS.length;
      if (step === 0) {
        setInstant(true);
        setWidth(0);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setInstant(false);
            setK(0);
            setWidth(AI_STEPS[0][2]);
          }),
        );
        return;
      }
      setK(step);
      setWidth(AI_STEPS[step][2]);
    }, 2600);
    return () => clearInterval(t);
  }, []);
  const [a, b] = AI_STEPS[k];
  return (
    <div className="hx__layer hx__card hx__ai hx-float-a" data-depth="28">
      <div className="hx__head">
        <span className="hx__ico">
          <Svg d={I.spark} />
        </span>
        <div>
          Madex KI-Analyse<small>läuft in Echtzeit</small>
        </div>
      </div>
      <p className="hx__ai-text">
        {a}
        <b>{b}</b>
        <span className="hx__caret" />
      </p>
      <div className="hx__progress">
        <i style={{ width: `${width}%`, transition: instant ? "none" : undefined }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------ code card */
const SNIPPETS: { tab: string; html: string }[] = [
  { tab: "website.js", html: `<span class="tk">const</span> site = <span class="tf">build</span>({\n  design: <span class="ts">"individuell"</span>,\n  seo: <span class="tk">true</span>,\n  mobile: <span class="ts">"100/100"</span>\n});` },
  { tab: "ads.js", html: `<span class="tc">// Google Ads Kampagne</span>\ncampaign.<span class="tf">target</span>(<span class="ts">"Schaffhausen"</span>);\ncampaign.<span class="tf">budget</span>(<span class="ts">"smart"</span>);\n<span class="tk">await</span> leads.<span class="tf">grow</span>();` },
  { tab: "ki.js", html: `<span class="tk">const</span> orion = <span class="tk">new</span> <span class="tf">Assistent</span>({\n  sprachen: [<span class="ts">"de"</span>, <span class="ts">"fr"</span>, <span class="ts">"it"</span>],\n  antwort: <span class="ts">"24/7"</span>\n});` },
];
function CodeCard() {
  const out = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(0);
  useEffect(() => {
    const el = out.current;
    if (!el) return;
    if (reduced()) {
      el.innerHTML = SNIPPETS[0].html;
      return;
    }
    let s = 0;
    let timer: ReturnType<typeof setTimeout>;
    const type = () => {
      setTab(s);
      const tokens = SNIPPETS[s].html.match(/<[^>]+>|&[^;]+;|[\s\S]/g) ?? [];
      let i = 0;
      let acc = "";
      const step = () => {
        if (i < tokens.length) {
          acc += tokens[i++];
          while (i < tokens.length && tokens[i - 1].startsWith("<") && !tokens[i - 1].startsWith("</")) acc += tokens[i++];
          el.innerHTML = acc + '<span class="hx__caret"></span>';
          timer = setTimeout(step, 30);
        } else {
          timer = setTimeout(() => {
            s = (s + 1) % SNIPPETS.length;
            type();
          }, 2200);
        }
      };
      step();
    };
    type();
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="hx__layer hx__card hx__code hx-float-c" data-depth="22">
      <div className="hx__tabs">
        {SNIPPETS.map((s, i) => (
          <span key={s.tab} className={i === tab ? "on" : ""}>
            {s.tab}
          </span>
        ))}
      </div>
      <div className="hx__code-out" ref={out} />
    </div>
  );
}

/* ---------------------------------------------------- collage */
function Visual() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current?.closest(".hx");
    if (!host || reduced() || !window.matchMedia("(pointer:fine)").matches) return;
    const layers = Array.from(ref.current!.querySelectorAll<HTMLElement>(".hx__layer"));
    const onMove = (e: Event) => {
      const ev = e as PointerEvent;
      const cx = ev.clientX / window.innerWidth - 0.5;
      const cy = ev.clientY / window.innerHeight - 0.5;
      for (const l of layers) {
        const d = parseFloat(l.dataset.depth || "10");
        l.style.transform = `translate3d(${cx * d}px, ${cy * d}px, 0) rotateX(${-cy * d * 0.15}deg) rotateY(${cx * d * 0.15}deg)`;
      }
    };
    host.addEventListener("pointermove", onMove);
    return () => host.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="hx__visual" ref={ref} aria-hidden="true">
      <div className="hx__layer hx__card hx__browser" data-depth="12">
        <div className="hx__bar">
          <i />
          <i />
          <i />
          <div className="hx__url">
            <Svg d={I.lock} />
            ihre-firma.ch
          </div>
        </div>
        <div className="hx__site">
          <div className="s-nav">
            <div className="s-logo" />
            <div className="s-links">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="s-hero">
            <div>
              <div className="s-h" />
              <div className="s-h w2" />
              <div className="s-p" />
              <div className="s-p w3" />
              <div className="s-btn" />
            </div>
            <div className="s-img" />
          </div>
          <div className="s-cards">
            <div className="s-card">
              <i />
              <b />
            </div>
            <div className="s-card">
              <i />
              <b />
            </div>
            <div className="s-card">
              <i />
              <b />
            </div>
          </div>
        </div>
        <svg className="hx__cursor" viewBox="0 0 24 24">
          <path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#03262a" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>

      <AiCard />

      <div className="hx__layer hx__card hx__chart hx-float-b" data-depth="34">
        <div className="hx__head">
          <span className="hx__ico">
            <Svg d={I.trend} />
          </span>
          <div>
            Neue Leads<small>letzte 90 Tage</small>
          </div>
        </div>
        <div className="hx__kpi">
          <b>+184%</b>
          <span>▲ 2.8×</span>
        </div>
        <svg className="hx__spark" viewBox="0 0 200 60" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hxArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#4fe0d2" stopOpacity=".45" />
              <stop offset="1" stopColor="#4fe0d2" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="hxLine" x1="0" x2="1">
              <stop offset="0" stopColor="#19b3a9" />
              <stop offset="1" stopColor="#9ff3ea" />
            </linearGradient>
          </defs>
          <path className="area" d="M0 52 L20 48 L40 50 L60 40 L80 42 L100 30 L120 33 L140 20 L160 22 L180 10 L200 4 L200 60 L0 60Z" fill="url(#hxArea)" />
          <path className="line" d="M0 52 L20 48 L40 50 L60 40 L80 42 L100 30 L120 33 L140 20 L160 22 L180 10 L200 4" fill="none" stroke="url(#hxLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <CodeCard />

      <div className="hx__layer hx__card hx__design hx-float-a" data-depth="40">
        <div className="hx__head">
          <span className="hx__ico">
            <Svg d={I.pen} />
          </span>
          <div>
            Brand Design<small>Farben &amp; Typo</small>
          </div>
        </div>
        <div className="hx__swatches">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="hx__type">
          <b>Aa</b>
          <span>Schibsted Grotesk</span>
        </div>
      </div>

      <div className="hx__layer hx__card hx__rank hx-float-b" data-depth="18">
        <span className="hx__g" />
        Google Ranking <em>#1</em>
      </div>
    </div>
  );
}

/* --------------------------------------------- rating stars */
function Stars({ value }: { value: number }) {
  return (
    <span className="hx__stars" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} viewBox="0 0 24 24" width="15" height="15">
            <defs>
              <linearGradient id={`hxStar${i}`}>
                <stop offset={fill} stopColor="#ffbe11" />
                <stop offset={fill} stopColor="rgba(255,255,255,.22)" />
              </linearGradient>
            </defs>
            <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill={`url(#hxStar${i})`} />
          </svg>
        );
      })}
    </span>
  );
}

/* ---------------------------------------------------- quick form */
function QuickAnalysis() {
  const { navigate } = useTransition();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: f.get("website"), email: f.get("email"), fax: f.get("fax") }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; reference?: string; url?: string };
      if (json.ok && json.url) {
        setMsg("Die Analyse startet …");
        navigate(json.url);
        return;
      }
      if (!json.ok) {
        setState("error");
        setMsg(json.error || "Die Anfrage konnte nicht gesendet werden. Rufen Sie uns an: 052 589 67 59");
        return;
      }
      setState("done");
      setMsg(`Danke! Wir melden uns innerhalb von 24 Stunden. Ihre Referenz: ${json.reference}`);
      e.currentTarget?.reset();
    } catch {
      setState("error");
      setMsg("Senden fehlgeschlagen. Rufen Sie uns an: 052 589 67 59");
    }
  };
  return (
    <>
      <form className="hx__form" onSubmit={submit}>
        <label className="hx__field">
          <Svg d={I.globe} />
          <span className="sr-only">Ihre Website, z. B. firma.ch</span>
          <input name="website" type="text" inputMode="url" autoComplete="url" placeholder="Ihre Website, z. B. firma.ch" maxLength={200} />
        </label>
        <span className="hx__sep" aria-hidden="true" />
        <label className="hx__field">
          <Svg d={I.mail} />
          <span className="sr-only">Ihre E-Mail</span>
          <input name="email" type="email" autoComplete="email" required placeholder="Ihre E-Mail" maxLength={200} />
        </label>
        <input name="fax" tabIndex={-1} autoComplete="off" className="hx__hp" aria-hidden="true" />
        <button type="submit" className="hx__submit" disabled={state === "sending"}>
          {state === "sending" ? "Analyse startet …" : "Gratis-Analyse"}
          <Svg d={I.arrow} />
        </button>
      </form>
      <p className={`hx__msg${state === "error" ? " is-err" : state === "done" ? " is-ok" : ""}`} role="status">
        {msg || "Kostenlos und sofort: SEO-, Mobile- und Google-Check Ihrer Website mit drei konkreten Verbesserungsvorschlägen."}
      </p>
    </>
  );
}

export function Hero({ rating = 4.4 }: { rating?: number }) {
  return (
    <section className="hx" aria-labelledby="hero-title">
      <Network />
      <div className="hx__blob b1" aria-hidden="true" />
      <div className="hx__blob b2" aria-hidden="true" />
      <div className="hx__blob b3" aria-hidden="true" />
      <div className="container hx__grid">
        <div className="hx__copy">
          <Link href="/#angebot" className="hx__badge hx-in" style={{ ["--d" as string]: "0s" }}>
            <span>NEU</span> Website im Wert von CHF 8&apos;000 – inklusive
          </Link>
          <h1 id="hero-title" className="hx__title">
            <span className="hx-word" style={{ ["--d" as string]: ".08s" }}>
              Wir verwandeln
            </span>{" "}
            <br />
            <span className="sr-only">{WORDS[0]}</span>
            <Rotator />{" "}
            <br />
            <span className="hx-word" style={{ ["--d" as string]: ".2s" }}>
              in neue Kunden.
            </span>
          </h1>
          <p className="hx__lead hx-in" style={{ ["--d" as string]: ".3s" }}>
            Webdesign, Google Ads, SEO, Social Media und KI – <strong>alles aus einer Hand</strong> für Schweizer KMU. Persönlich betreut, messbar erfolgreich.
          </p>
          <div className="hx-in" style={{ ["--d" as string]: ".45s" }}>
            <QuickAnalysis />
          </div>
          <div className="hx__trust hx-in" style={{ ["--d" as string]: ".6s" }}>
            <span>
              <Stars value={rating} />
              {rating.toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} auf Google
            </span>
            <span>
              <Svg d={I.users} />
              100+ Kunden
            </span>
            <span>
              <Svg d={I.clock} />
              Antwort in 24h
            </span>
          </div>
        </div>
        <div className="hx-in hx__visual-wrap" style={{ ["--d" as string]: ".2s" }}>
          <Visual />
        </div>
      </div>
    </section>
  );
}
