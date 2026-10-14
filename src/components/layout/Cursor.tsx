"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Teal cursor ring with trailing dot. Grows over interactive elements and shows
 * a label for elements with data-cursor="Text". Disabled on touch / reduced motion.
 */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState("");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    setEnabled(true);
    document.documentElement.classList.add("has-cursor");

    const pos = { x: innerWidth / 2, y: innerHeight / 2 };
    const ringPos = { ...pos };
    let raf = 0;
    let hover = false;
    let down = false;

    const move = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      const target = e.target as HTMLElement | null;
      const interactive = target?.closest<HTMLElement>("a, button, [data-cursor], input, textarea, select, label");
      hover = !!interactive;
      const l = interactive?.closest<HTMLElement>("[data-cursor]")?.dataset.cursor ?? "";
      setLabel((prev) => (prev === l ? prev : l));
    };
    const tick = () => {
      ringPos.x += (pos.x - ringPos.x) * 0.18;
      ringPos.y += (pos.y - ringPos.y) * 0.18;
      const scale = (hover ? 1.9 : 1) * (down ? 0.8 : 1);
      if (ring.current) ring.current.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) translate(-50%, -50%) scale(${scale})`;
      if (dot.current) dot.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };
    const onDown = () => (down = true);
    const onUp = () => (down = false);
    const onLeave = () => ring.current && (ring.current.style.opacity = "0");
    const onEnter = () => ring.current && (ring.current.style.opacity = "1");
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      document.documentElement.classList.remove("has-cursor");
    };
  }, []);

  if (!enabled) return null;
  return (
    <>
      <div ref={ring} className={`cursor-ring${label ? " cursor-ring--label" : ""}`} aria-hidden="true">
        {label && <span>{label}</span>}
      </div>
      <div ref={dot} className="cursor-dot" aria-hidden="true" />
      <style>{`
        .cursor-ring{position:fixed;left:0;top:0;z-index:9998;width:38px;height:38px;border-radius:50%;
          border:1.5px solid rgba(79,224,210,.85);pointer-events:none;mix-blend-mode:difference;
          transition:width .35s var(--ease-out),height .35s var(--ease-out),background .35s,border-color .35s,opacity .3s;
          display:grid;place-items:center}
        .cursor-ring--label{width:92px;height:92px;background:var(--teal);border-color:var(--teal);mix-blend-mode:normal}
        .cursor-ring span{font:500 11px/1 var(--font-body);letter-spacing:.14em;text-transform:uppercase;color:#fff;transform:scale(.55)}
        .cursor-dot{position:fixed;left:0;top:0;z-index:9999;width:6px;height:6px;border-radius:50%;background:var(--teal-glow);pointer-events:none}
      `}</style>
    </>
  );
}
