"use client";

import { useEffect, useRef, useState } from "react";
import { MARK_PETROL, MARK_TEAL, TAG, WORD } from "@/components/ui/Logo";

// measured from navigation start: the CSS sequence starts at first paint
const MIN_MS = 2000;
const MAX_MS = 3800;

// decided once per document so a remounted effect (Strict Mode) does not
// mistake its own session flag for a returning visit
let firstVisit: boolean | null = null;

/**
 * Logo intro on the first full page load of a visit. The three parts of the
 * mark slide together, the wordmark wipes out from behind it, then the white
 * sheet lifts off the page. It waits for fonts + window load (capped), and is
 * skipped for returning visits and reduced motion.
 */
export function Preloader() {
  const [phase, setPhase] = useState<"run" | "exit" | "done">("run");
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (firstVisit === null) {
      firstVisit = true;
      try {
        firstVisit = sessionStorage.getItem("madex-intro") !== "1";
        sessionStorage.setItem("madex-intro", "1");
      } catch {}
    }
    if (!firstVisit || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }
    const root = document.documentElement;
    root.classList.add("is-loading");
    let ready = false;
    const fonts = document.fonts?.ready ?? Promise.resolve();
    const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise<void>((r) => window.addEventListener("load", () => r(), { once: true }));
    Promise.all([fonts, loaded]).then(() => (ready = true));

    let raf = 0;
    let shown = 0;
    let last = performance.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const done = (ready && t > MIN_MS) || t > MAX_MS;
      const target = done ? 1 : Math.min(0.9, t / MAX_MS + (ready ? 0.35 : 0));
      shown += (target - shown) * Math.min(1, dt * 4);
      if (done) shown = Math.min(1, shown + dt * 2.2);
      if (bar.current) bar.current.style.transform = `scaleX(${shown.toFixed(4)})`;
      if (done && shown >= 1) {
        timers.push(setTimeout(() => setPhase("exit"), 120));
        timers.push(
          setTimeout(() => {
            setPhase("done");
            root.classList.remove("is-loading");
          }, 1250),
        );
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      root.classList.remove("is-loading");
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div className={`ld ld--${phase}`} role="status" aria-label="Seite wird geladen">
      <div className="ld__sheet" aria-hidden="true" />
      <div className="ld__stage" aria-hidden="true">
        <svg className="ld__logo" viewBox="0 0 1643.31 350.73">
          <g className="ld__word">
            {WORD.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <g className="ld__tag">
            {TAG.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <path className="ld__p ld__p--0" d={MARK_PETROL[0]} />
          <path className="ld__p ld__p--1" d={MARK_PETROL[1]} />
          <path className="ld__p ld__p--2" d={MARK_TEAL} />
        </svg>
        <div className="ld__bar">
          <span ref={bar} />
        </div>
      </div>

      <style>{`
        html.is-loading{overflow:hidden}
        html.is-loading madex-chatbot{visibility:hidden !important}
        html.intro-seen .ld{display:none}
        .ld{position:fixed;inset:0;z-index:9500;pointer-events:all}
        .ld--exit{pointer-events:none}
        .ld__sheet{position:absolute;inset:0;background:#fff;transition:clip-path 1s cubic-bezier(.76,0,.24,1);clip-path:inset(0 0 0 0 round 0)}
        .ld--exit .ld__sheet{clip-path:inset(0 0 100% 0 round 0 0 48px 48px)}
        .ld__stage{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:34px;transition:transform .8s cubic-bezier(.76,0,.24,1),opacity .45s}
        .ld--exit .ld__stage{transform:translateY(-14vh);opacity:0}
        .ld__logo{width:min(380px,74vw);height:auto;overflow:visible}
        .ld__word,.ld__tag,.ld__p--0,.ld__p--1{fill:#025159}
        .ld__p--2{fill:#028D86}
        .ld__p{transform-box:fill-box;transform-origin:50% 50%;opacity:0;animation:ldPiece .9s cubic-bezier(.16,1,.3,1) forwards}
        .ld__p--0{--from:translate(0,55%);animation-delay:.1s}
        .ld__p--1{--from:translate(0,-45%);animation-delay:.22s}
        .ld__p--2{--from:translate(38%,-38%) rotate(8deg);animation-delay:.36s}
        @keyframes ldPiece{from{opacity:0;transform:var(--from)}35%{opacity:1}to{opacity:1;transform:none}}
        .ld__word{clip-path:inset(0 100% 0 0);transform:translateX(-90px);animation:ldWipe 1s .78s cubic-bezier(.16,1,.3,1) forwards}
        @keyframes ldWipe{to{clip-path:inset(0 0 0 0);transform:none}}
        .ld__tag{opacity:0;animation:ldTag .7s 1.2s cubic-bezier(.16,1,.3,1) forwards}
        @keyframes ldTag{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .ld__bar{width:120px;height:2px;border-radius:2px;background:#e6ebeb;overflow:hidden;opacity:0;animation:ldTag .5s .5s forwards}
        .ld__bar span{display:block;height:100%;transform:scaleX(0);transform-origin:left;background:#028D86}
      `}</style>
    </div>
  );
}
