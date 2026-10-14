"use client";

import { useEffect, useState } from "react";
import { MarkSvg } from "@/components/ui/MarkSvg";

/** First-visit intro: mark assembles, counter runs, curtain lifts. Max ~1.6s, skipped on repeat visits. */
export function Preloader() {
  const [state, setState] = useState<"show" | "leave" | "done">("show");
  const [count, setCount] = useState(0);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("madex-intro") === "1";
      sessionStorage.setItem("madex-intro", "1");
    } catch {
      /* storage blocked – show intro */
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduced) {
      setState("done");
      return;
    }
    const start = performance.now();
    const DURATION = 1300;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION);
      setCount(Math.round((1 - Math.pow(1 - p, 3)) * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setState("leave");
        setTimeout(() => setState("done"), 950);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (state === "done") return null;
  return (
    <div className={`pl pl--${state}`} aria-hidden="true">
      <div className="pl__inner">
        <MarkSvg className="pl__mark" animated />
        <div className="pl__brand">Madex IT Solutions</div>
      </div>
      <div className="pl__count">{String(count).padStart(3, "0")}</div>
      <div className="pl__bar" style={{ transform: `scaleX(${count / 100})` }} />
      <style>{`
        .pl{position:fixed;inset:0;z-index:9500;background:var(--night);display:grid;place-items:center;color:#e9f4f3;
          transition:clip-path 1s var(--ease-in-out);clip-path:inset(0 0 0 0)}
        .pl--leave{clip-path:inset(0 0 100% 0)}
        .pl__inner{display:grid;justify-items:center;gap:26px;transition:transform 1s var(--ease-in-out),opacity .6s}
        .pl--leave .pl__inner{transform:translateY(-80px);opacity:0}
        .pl__mark{width:min(200px,42vw);height:auto;overflow:visible}
        .mark-piece{transform-box:fill-box;transform-origin:50% 100%;animation:plRise .9s var(--ease-out) both}
        .mark-piece--0{animation-delay:.05s}.mark-piece--1{animation-delay:.2s}.mark-piece--2{animation-delay:.35s}
        @keyframes plRise{from{transform:translateY(60%) scaleY(.2);opacity:0}to{transform:none;opacity:1}}
        .pl__brand{font:600 13px/1 var(--font-body);letter-spacing:.42em;text-transform:uppercase;opacity:.7;animation:plFade .8s .5s both}
        @keyframes plFade{from{opacity:0;letter-spacing:.8em}to{opacity:.7}}
        .pl__count{position:absolute;right:var(--gutter);bottom:28px;font:800 clamp(48px,9vw,130px)/1 var(--font-display);
          color:transparent;-webkit-text-stroke:1px rgba(79,224,210,.5)}
        .pl__bar{position:absolute;left:0;bottom:0;height:3px;width:100%;transform-origin:left;background:linear-gradient(90deg,var(--petrol),var(--teal-glow))}
      `}</style>
    </div>
  );
}
