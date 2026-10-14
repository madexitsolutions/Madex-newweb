"use client";

import { useEffect, useRef, useState } from "react";
import { MARK_SHAPES, MARK_SIZE, markPath } from "@/lib/mark";

const BRAND = "MADEX IT SOLUTIONS";
const MIN_MS = 1500;
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

      <div className="ld__bg" aria-hidden="true">
        <span className="ld__grid" />
        <span className="ld__glow" />
      </div>

      <div className="ld__stage" aria-hidden="true">
        <svg className="ld__mark" viewBox={`-10 -10 ${MARK_SIZE.w + 20} ${MARK_SIZE.h + 20}`}>
          <defs>
            <linearGradient id="ldPetrol" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0b6c74" />
              <stop offset="1" stopColor="#025159" />
            </linearGradient>
            <linearGradient id="ldTeal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4fe0d2" />
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
              stroke={s.color === "teal" ? "#4fe0d2" : "#19b3a9"}
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

      <div className="ld__meta ld__meta--tl" aria-hidden="true">
        Neuhausen am Rheinfall
        <br />
        47.69° N · 8.61° E
      </div>
      <div className="ld__meta ld__meta--tr" aria-hidden="true">
        Webdesign · Marketing
        <br />
        SEO · Content
      </div>

      <div className="ld__foot" aria-hidden="true">
        <div className="ld__bar">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
        <div className="ld__pct">
          <span>{String(pct).padStart(3, "0")}</span>
          <small>%</small>
        </div>
      </div>

      <style>{`
        html.is-loading{overflow:hidden}
        .ld{position:fixed;inset:0;z-index:9500;color:#e9f4f3;pointer-events:all}
        .ld--exit{pointer-events:none}
        .ld__panels{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr)}
        .ld__panels span{background:var(--night);transition:transform 1.05s var(--ease-in-out)}
        .ld__panels span:nth-child(2){transition-delay:.08s}
        .ld__panels span:nth-child(3){transition-delay:.16s}
        .ld--exit .ld__panels span{transform:translateY(-101%)}
        .ld__bg{position:absolute;inset:0;overflow:hidden;transition:opacity .5s}
        .ld--exit .ld__bg,.ld--exit .ld__meta,.ld--exit .ld__foot{opacity:0}
        .ld__grid{position:absolute;inset:-20%;background-image:linear-gradient(rgba(79,224,210,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(79,224,210,.07) 1px,transparent 1px);
          background-size:64px 64px;mask-image:radial-gradient(circle at 50% 50%,#000 0,transparent 60%);-webkit-mask-image:radial-gradient(circle at 50% 50%,#000 0,transparent 60%);
          animation:ldGrid 6s linear infinite}
        @keyframes ldGrid{to{transform:translate(64px,64px)}}
        .ld__glow{position:absolute;left:50%;top:50%;width:min(90vw,900px);aspect-ratio:1;translate:-50% -50%;border-radius:50%;
          background:radial-gradient(circle,rgba(2,141,134,.32),rgba(2,81,89,.12) 40%,transparent 68%);animation:ldBreath 3s ease-in-out infinite alternate}
        @keyframes ldBreath{from{transform:scale(.9);opacity:.7}to{transform:scale(1.05);opacity:1}}
        .ld__stage{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:30px;transition:transform 1s var(--ease-in-out),opacity .6s .15s}
        .ld--exit .ld__stage{transform:translateY(-60px) scale(.94);opacity:0}
        .ld__mark{width:min(230px,46vw);height:auto;overflow:visible;filter:drop-shadow(0 30px 50px rgba(2,141,134,.35));animation:ldTilt 2.4s var(--ease-out) both}
        @keyframes ldTilt{from{transform:perspective(600px) rotateX(35deg) translateY(20px)}to{transform:none}}
        .ld__piece{stroke-dasharray:1;stroke-dashoffset:1;fill-opacity:0;animation:ldDraw .9s var(--ease-in-out) forwards,ldFill .6s var(--ease-out) forwards}
        .ld__piece--0{animation-delay:.05s,.75s}
        .ld__piece--1{animation-delay:.18s,.88s}
        .ld__piece--2{animation-delay:.31s,1.01s}
        @keyframes ldDraw{to{stroke-dashoffset:0}}
        @keyframes ldFill{to{fill-opacity:1;stroke-opacity:0}}
        .ld__brand{display:flex;font:600 clamp(13px,1.2vw,16px)/1 var(--font-body);letter-spacing:.42em;padding-left:.42em}
        .ld__brand span{display:inline-block;opacity:0;transform:translateY(12px);animation:ldChar .7s var(--ease-out) forwards}
        @keyframes ldChar{to{opacity:1;transform:none}}
        .ld__tag{font:400 13px/1 var(--font-body);color:var(--teal-glow);letter-spacing:.08em;opacity:0;animation:ldChar .8s 1.6s var(--ease-out) forwards;margin-top:-14px}
        .ld__meta{position:absolute;top:28px;font-size:11.5px;line-height:1.6;letter-spacing:.16em;text-transform:uppercase;color:rgba(233,244,243,.45);transition:opacity .4s}
        .ld__meta--tl{left:var(--gutter)}
        .ld__meta--tr{right:var(--gutter);text-align:right}
        .ld__foot{position:absolute;left:var(--gutter);right:var(--gutter);bottom:30px;display:flex;align-items:flex-end;gap:28px;transition:opacity .4s}
        .ld__bar{flex:1;height:1px;background:rgba(233,244,243,.14);margin-bottom:10px;overflow:hidden}
        .ld__bar span{display:block;height:100%;transform-origin:left;background:linear-gradient(90deg,var(--teal),var(--teal-glow))}
        .ld__pct{display:flex;align-items:flex-start;font:600 clamp(34px,4vw,56px)/1 var(--font-display);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
        .ld__pct small{font-size:.36em;margin:.2em 0 0 .2em;color:var(--teal-glow)}
        @media(max-width:600px){.ld__meta--tr{display:none}.ld__brand{letter-spacing:.3em}}
      `}</style>
    </div>
  );
}
