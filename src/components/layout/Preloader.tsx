"use client";

import { useEffect, useRef, useState } from "react";
import { MARK_SHAPES, MARK_SIZE, markPath } from "@/lib/mark";

const BRAND = "Madex IT Solutions";
const MIN_MS = 900;
const MAX_MS = 4000;

/**
 * Loading screen on a full page load. Progress follows real readiness
 * (fonts + window load) with a minimum duration so the sequence can play:
 * the mark is drawn as outline, filled, the brand types in, then three
 * panels open the page. Skipped entirely for reduced motion.
 */
export function Preloader() {
  const [phase, setPhase] = useState<"run" | "exit" | "done">("run");
  const [progress, setProgress] = useState(0);
  const target = useRef(0.12);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }
    document.documentElement.classList.add("is-loading");
    const start = performance.now();
    let ready = false;
    const markReady = () => (ready = true);
    const fonts = document.fonts?.ready ?? Promise.resolve();
    const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise<void>((r) => window.addEventListener("load", () => r(), { once: true }));
    fonts.then(() => (target.current = Math.max(target.current, 0.55)));
    Promise.all([fonts, loaded]).then(markReady);

    let raf = 0;
    let shown = 0;
    let last = start;
    let finished = false;
    const tick = (t: number) => {
      const elapsed = t - start;
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      // creep forward while waiting, jump to 100 once ready and min time passed
      if ((ready && elapsed > MIN_MS) || elapsed > MAX_MS) target.current = 1;
      else target.current = Math.min(0.92, Math.max(target.current, elapsed / MAX_MS));
      // frame-rate independent easing; the final stretch runs at a fixed speed
      shown += (target.current - shown) * Math.min(1, dt * 5);
      if (target.current === 1) shown = Math.min(1, shown + dt * 0.9);
      setProgress(shown);
      if (shown >= 1 && !finished) {
        finished = true;
        setTimeout(() => setPhase("exit"), 250);
        setTimeout(() => {
          setPhase("done");
          document.documentElement.classList.remove("is-loading");
        }, 1650);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("is-loading");
    };
  }, []);

  if (phase === "done") return null;
  const pct = Math.round(progress * 100);

  return (
    <div className={`ld ld--${phase}`} role="progressbar" aria-label="Seite wird geladen" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="ld__panels" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>


      <div className="ld__stage" aria-hidden="true">
        <svg className="ld__mark" viewBox={`-10 -10 ${MARK_SIZE.w + 20} ${MARK_SIZE.h + 20}`}>
          <defs>
            <linearGradient id="ldPetrol" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0b6c74" />
              <stop offset="1" stopColor="#025159" />
            </linearGradient>
            <linearGradient id="ldTeal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#19b3a9" />
              <stop offset="1" stopColor="#028D86" />
            </linearGradient>
          </defs>
          {MARK_SHAPES.map((s, i) => (
            <path
              key={i}
              d={markPath(s.points)}
              pathLength={1}
              className={`ld__piece ld__piece--${i}`}
              fill={s.color === "teal" ? "url(#ldTeal)" : "url(#ldPetrol)"}
              stroke={s.color === "teal" ? "#028D86" : "#025159"}
              strokeWidth={6}
              strokeLinejoin="round"
            />
          ))}
        </svg>
        <div className="ld__brand">
          {BRAND.split("").map((c, i) => (
            <span key={i} style={{ animationDelay: `${0.9 + i * 0.035}s` }}>
              {c === " " ? " " : c}
            </span>
          ))}
        </div>
        <div className="ld__tag">Ein Begleiter, kein Verkäufer</div>
      </div>


      <div className="ld__foot" aria-hidden="true">
        <div className="ld__bar">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>

      <style>{`
        html.is-loading{overflow:hidden}
        .ld{position:fixed;inset:0;z-index:9500;color:var(--deep);pointer-events:all}
        .ld--exit{pointer-events:none}
        .ld__panels{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr)}
        .ld__panels span{background:#fff;transition:transform 1.05s var(--ease-in-out)}
        .ld__panels span:nth-child(2){transition-delay:.08s}
        .ld__panels span:nth-child(3){transition-delay:.16s}
        .ld--exit .ld__panels span{transform:translateY(-101%)}
                .ld--exit .ld__foot{opacity:0}
        .ld__stage{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:30px;transition:transform 1s var(--ease-in-out),opacity .6s .15s}
        .ld--exit .ld__stage{transform:translateY(-60px) scale(.94);opacity:0}
        .ld__mark{width:min(150px,36vw);height:auto;overflow:visible}
                .ld__piece{stroke-dasharray:1;stroke-dashoffset:1;fill-opacity:0;animation:ldDraw .9s var(--ease-in-out) forwards,ldFill .6s var(--ease-out) forwards}
        .ld__piece--0{animation-delay:.05s,.75s}
        .ld__piece--1{animation-delay:.18s,.88s}
        .ld__piece--2{animation-delay:.31s,1.01s}
        @keyframes ldDraw{to{stroke-dashoffset:0}}
        @keyframes ldFill{to{fill-opacity:1;stroke-opacity:0}}
        .ld__brand{display:flex;font:600 clamp(15px,1.3vw,18px)/1 var(--font-body);letter-spacing:.01em}
        .ld__brand span{display:inline-block;opacity:0;transform:translateY(12px);animation:ldChar .7s var(--ease-out) forwards}
        @keyframes ldChar{to{opacity:1;transform:none}}
        .ld__tag{font:400 14px/1 var(--font-body);color:var(--ink-soft);opacity:0;animation:ldChar .8s 1.6s var(--ease-out) forwards;margin-top:-14px}
        .ld__foot{position:absolute;left:50%;bottom:calc(50% - 120px);width:160px;translate:-50% 0;transition:opacity .3s}
        .ld__bar{height:2px;border-radius:2px;background:var(--line-soft);overflow:hidden}
        .ld__bar span{display:block;height:100%;transform-origin:left;background:var(--teal)}
        
      `}</style>
    </div>
  );
}
