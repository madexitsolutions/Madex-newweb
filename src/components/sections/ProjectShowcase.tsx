"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Link } from "@/components/layout/Transition";
import { Icon } from "@/components/ui/Icon";
import { formatDate, type Post } from "@/content/posts";
import { media } from "@/lib/media";

/**
 * Lightweight perspective strip of real project screenshots.
 * Native horizontal scrolling (touch, trackpad, wheel+shift) with snap,
 * mouse drag with inertia, arrow keys and prev/next buttons. Each card is
 * tilted by its distance to the centre – computed in one rAF, no re-renders.
 */
export function ProjectShowcase({ posts, screens = {} }: { posts: Post[]; screens?: Record<string, string> }) {
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef<HTMLAnchorElement[]>([]);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const lock = useRef(0); // while a programmatic scroll runs, the target stays the active card
  const drag = useRef({ on: false, moved: 0, x: 0, left: 0, v: 0, t: 0, raf: 0 });

  // perspective update – runs on scroll/resize, writes a CSS variable per card
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    cards.current = Array.from(el.querySelectorAll<HTMLAnchorElement>(".ps__card"));
    let raf = 0;
    const update = () => {
      raf = 0;
      const box = el.getBoundingClientRect();
      const mid = box.left + box.width / 2;
      let best = 0;
      let bestD = Infinity;
      cards.current.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const d = (r.left + r.width / 2 - mid) / r.width;
        c.style.setProperty("--d", Math.max(-2.2, Math.min(2.2, d)).toFixed(3));
        if (Math.abs(d) < bestD) {
          bestD = Math.abs(d);
          best = i;
        }
      });
      if (!lock.current && best !== activeRef.current) {
        activeRef.current = best;
        setActive(best);
      }
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    // open on the second project so the strip has a neighbour on both sides
    const start = cards.current[Math.min(1, cards.current.length - 1)];
    if (start && el.scrollLeft === 0) el.scrollLeft = start.offsetLeft + start.offsetWidth / 2 - el.clientWidth / 2;
    update();
    el.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [posts.length]);

  const go = useCallback((i: number, focus = false) => {
    const el = track.current;
    const c = cards.current[Math.max(0, Math.min(posts.length - 1, i))];
    if (!el || !c) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const idx = Math.max(0, Math.min(posts.length - 1, i));
    activeRef.current = idx;
    setActive(idx);
    window.clearTimeout(lock.current);
    lock.current = window.setTimeout(() => (lock.current = 0), reduce ? 50 : 700);
    el.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - el.clientWidth / 2, behavior: reduce ? "auto" : "smooth" });
    if (focus) c.focus({ preventScroll: true });
  }, [posts.length]);

  // mouse drag with a little inertia (touch uses native scrolling)
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !track.current) return;
    cancelAnimationFrame(drag.current.raf);
    drag.current = { on: true, moved: 0, x: e.clientX, left: track.current.scrollLeft, v: 0, t: performance.now(), raf: 0 };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = track.current;
    if (!d.on || !el) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4 && d.moved <= 4) {
      el.setPointerCapture(e.pointerId);
      el.classList.add("is-dragging");
    }
    const now = performance.now();
    const prev = el.scrollLeft;
    el.scrollLeft = d.left - dx;
    d.v = (el.scrollLeft - prev) / Math.max(1, now - d.t);
    d.t = now;
    d.moved = Math.max(d.moved, Math.abs(dx));
  };
  const onUp = () => {
    const d = drag.current;
    const el = track.current;
    if (!d.on || !el) return;
    d.on = false;
    if (d.moved <= 4) return;
    // glide, then settle on the nearest card
    let v = d.v * 16;
    const glide = () => {
      v *= 0.92;
      el.scrollLeft += v;
      if (Math.abs(v) > 0.6) d.raf = requestAnimationFrame(glide);
      else {
        el.classList.remove("is-dragging");
        go(activeRef.current);
      }
    };
    d.raf = requestAnimationFrame(glide);
  };
  // a drag must not count as a click
  const onClickCapture = (e: MouseEvent) => {
    if (drag.current.moved > 4) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = 0;
    }
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const map: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    if (e.key in map) {
      e.preventDefault();
      go(activeRef.current + map[e.key], true);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      go(e.key === "Home" ? 0 : posts.length - 1, true);
    }
  };

  const current = posts[active];

  return (
    <section className="ps dark" aria-labelledby="ps-title" aria-roledescription="Karussell">
      <div className="container ps__head">
        <h2 id="ps-title" className="h2">
          Ausgewählte Projekte
        </h2>
        <div className="ps__nav">
          <span className="ps__count" aria-hidden="true">
            {String(active + 1).padStart(2, "0")} <i>/</i> {String(posts.length).padStart(2, "0")}
          </span>
          <button type="button" className="ps__btn" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Vorheriges Projekt">
            <Icon name="arrow" size={20} className="ps__flip" />
          </button>
          <button type="button" className="ps__btn" onClick={() => go(active + 1)} disabled={active === posts.length - 1} aria-label="Nächstes Projekt">
            <Icon name="arrow" size={20} />
          </button>
        </div>
      </div>

      <div
        ref={track}
        className="ps__track"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClickCapture={onClickCapture}
        onKeyDown={onKey}
        onDragStart={(e) => e.preventDefault()}
      >
        {posts.map((p, i) => (
          <Link
            key={p.slug}
            href={`/${p.slug}`}
            className={`ps__card${i === active ? " is-active" : ""}`}
            aria-label={`${p.client} – Projekt ansehen (${i + 1} von ${posts.length})`}
            data-cursor="Ansehen"
            onFocus={() => go(i)}
          >
            <span className="ps__frame">
              <span className="ps__bar" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="ps__shot">
                <Image src={screens[p.slug] ?? media(p.cover)} alt="" fill sizes="(max-width: 700px) 80vw, 560px" loading={i < 3 ? "eager" : "lazy"} className="ps__img" draggable={false} />
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="container ps__foot">
        <div className="ps__caption" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={current.slug} initial={{ opacity: 0, y: 12, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(4px)" }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
              <p className="ps__client">{current.client}</p>
              <p className="ps__meta">
                {formatDate(current.date)} · {current.title}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="ps__hint">Ziehen, wischen oder Pfeiltasten · Klicken zum Öffnen</p>
      </div>

      <style>{`
        .ps{position:relative;padding:clamp(70px,9vw,130px) 0 clamp(60px,7vw,100px);overflow:hidden;
          background:radial-gradient(60% 55% at 50% 58%,rgba(2,141,134,.32),transparent 70%),var(--night)}
        .ps__head{display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap;margin-bottom:clamp(28px,4vw,48px)}
        .ps__head .h2{margin:0;color:#fff}
        .ps__nav{display:flex;align-items:center;gap:10px}
        .ps__count{font:600 15px/1 var(--font-display);font-variant-numeric:tabular-nums;color:var(--on-dark);margin-right:8px;letter-spacing:.04em}
        .ps__count i{font-style:normal;opacity:.45;margin:0 2px}
        .ps__btn{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;color:#fff;border:1.5px solid rgba(233,244,243,.28);transition:background .3s,border-color .3s,color .3s,opacity .3s}
        .ps__btn:hover:not(:disabled){background:var(--teal-glow);border-color:var(--teal-glow);color:var(--ink)}
        .ps__btn:disabled{opacity:.3;cursor:default}
        .ps__track{--cw:clamp(260px,40vw,560px);position:relative;display:flex;gap:clamp(14px,2.2vw,34px);overflow-x:auto;overscroll-behavior-x:contain;
          scroll-snap-type:x mandatory;scrollbar-width:none;padding:30px calc(50% - var(--cw)/2) 46px;perspective:1600px;cursor:grab;
          -webkit-mask:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent);mask:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent)}
        .ps__track::-webkit-scrollbar{display:none}
        .ps__track.is-dragging{scroll-snap-type:none;cursor:grabbing}
        .ps__track.is-dragging .ps__card{pointer-events:none}
        .ps__card{--d:0;flex:none;width:var(--cw);scroll-snap-align:center;outline:none;border-radius:16px;
          transform:rotateY(calc(var(--d) * -16deg)) translateZ(calc(min(var(--d), 0 - var(--d)) * 90px)) scale(calc(1 - min(.14, max(var(--d), 0 - var(--d)) * .07)));
          transform-origin:50% 50%;transition:transform .12s linear;will-change:transform}
        .ps__flip{transform:rotate(180deg)}
        .ps__frame{display:block;border-radius:16px;overflow:hidden;background:#0c3c41;border:1px solid rgba(233,244,243,.12);
          box-shadow:0 40px 70px -40px rgba(0,0,0,.75),0 12px 24px -12px rgba(0,15,17,.6);
          filter:brightness(calc(1 - min(.45, max(var(--d), 0 - var(--d)) * .28)));transition:box-shadow .4s,border-color .4s}
        .ps__bar{display:flex;gap:6px;align-items:center;height:26px;padding:0 12px;background:#0f474d}
        .ps__bar i{width:8px;height:8px;border-radius:50%;background:rgba(233,244,243,.28)}
        .ps__bar i:first-child{background:var(--teal-glow)}
        .ps__shot{position:relative;display:block;aspect-ratio:16/9;background:linear-gradient(135deg,var(--petrol),var(--night))}
        .ps__img{object-fit:cover;object-position:top center;transition:transform .9s var(--ease-out)}
        .ps__card.is-active:hover .ps__img{transform:scale(1.035)}
        .ps__card:focus-visible .ps__frame{border-color:var(--teal-glow);box-shadow:0 0 0 3px var(--teal-glow),0 40px 70px -40px rgba(0,0,0,.75)}
        .ps__card.is-active .ps__frame{border-color:rgba(79,224,210,.45)}
        .ps__foot{display:flex;justify-content:space-between;align-items:start;gap:16px 40px;flex-wrap:wrap}
        .ps__caption{min-height:72px;max-width:62ch}
        .ps__client{margin:0;font:700 clamp(22px,2.2vw,32px)/1.1 var(--font-display);color:#fff;letter-spacing:-.01em}
        .ps__meta{margin:8px 0 0;color:var(--on-dark-soft);font-size:15px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .ps__hint{margin:6px 0 0;font-size:13px;color:var(--on-dark-soft)}
        @media(max-width:700px){
          .ps__track{--cw:72vw;gap:10px;-webkit-mask:none;mask:none}
          .ps__btn{width:46px;height:46px}
          .ps__hint{display:none}
        }
        @media(prefers-reduced-motion:reduce){.ps__card{transform:none!important}.ps__img{transition:none}}
      `}</style>
    </section>
  );
}
