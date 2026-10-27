"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { media } from "@/lib/media";
import { Icon } from "@/components/ui/Icon";
import { useLenis } from "@/components/layout/SmoothScroll";

type Tab = { id: string; label: string; items: string[] };

/** Tabbed masonry gallery with keyboard-accessible lightbox. */
export function Gallery({ tabs }: { tabs: Tab[] }) {
  const [tab, setTab] = useState(tabs[0].id);
  const [shown, setShown] = useState(36);
  const [open, setOpen] = useState<number | null>(null);
  const lenis = useLenis();
  const current = tabs.find((t) => t.id === tab)!;
  const items = current.items;

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((o) => (o === null ? o : (o + d + items.length) % items.length)), [items.length]);

  useEffect(() => {
    if (open === null) {
      lenis?.start();
      return;
    }
    lenis?.stop();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, step, lenis]);

  return (
    <div className="gal">
      <div className="gal__tabs" role="tablist" aria-label="Kategorien" style={{ ["--n" as string]: tabs.length }}>
        {tabs.map((t) => (
          <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} className={tab === t.id ? "is-on" : ""} onClick={() => { setTab(t.id); setShown(36); }}>
                        <span>
              {t.label} <small>{t.items.length}</small>
            </span>
          </button>
        ))}
      </div>
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="gal__grid">
        {items.slice(0, shown).map((src, i) => (
          <motion.button
            key={tab + src}
            className="gal__item"
            onClick={() => setOpen(i)}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -5% 0px" }}
            transition={{ duration: 0.7, delay: (i % 6) * 0.05 }}
            data-cursor="Zoom"
            aria-label={`${current.label} – Arbeit ${i + 1} vergrössern`}
          >
            <Image src={media(src)} alt={`${current.label} – Arbeit ${i + 1} von Madex IT Solutions`} width={600} height={600} sizes="(max-width: 600px) 50vw, (max-width: 1100px) 33vw, 25vw" style={{ width: "100%", height: "auto" }} />
          </motion.button>
        ))}
      </div>
      {shown < items.length && (
        <div className="gal__more">
          <button className="btn" onClick={() => setShown((s) => s + 36)}>
            <span>Mehr laden ({items.length - shown})</span>
            <span className="btn__icon">+</span>
          </button>
        </div>
      )}

      <AnimatePresence>
        {open !== null && (
          <motion.div className="lb" role="dialog" aria-modal="true" aria-label="Bildansicht" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
            <motion.div key={open} className="lb__img" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} onClick={(e) => e.stopPropagation()}>
              <Image src={media(items[open])} alt={`${current.label} – Arbeit ${open + 1}`} width={1600} height={1600} sizes="90vw" style={{ width: "auto", height: "auto", maxWidth: "88vw", maxHeight: "84vh" }} />
            </motion.div>
            <button className="lb__btn lb__close" onClick={close} aria-label="Schliessen" autoFocus>
              <Icon name="close" />
            </button>
            <button className="lb__btn lb__prev" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Vorheriges Bild">
              <Icon name="arrow" className="flip" />
            </button>
            <button className="lb__btn lb__next" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Nächstes Bild">
              <Icon name="arrow" />
            </button>
            <span className="lb__count">
              {open + 1} / {items.length}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        .gal__tabs{display:flex;gap:6px;padding:6px;border-radius:999px;background:#fff;width:max-content;max-width:100%;margin:0 auto 40px;box-shadow:0 20px 40px -30px rgba(1,41,45,.5);flex-wrap:wrap}
        .gal__tabs button{position:relative;padding:14px 24px;border-radius:999px;font-weight:500;transition:color .4s}
        .gal__tabs button.is-on{color:#fff;background:linear-gradient(135deg,var(--teal),var(--petrol))}
        .gal__tabs button span{position:relative}
        .gal__tabs small{opacity:.6;margin-left:4px}
        @media(max-width:600px){
          .gal__tabs{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));width:100%;border-radius:20px;margin-bottom:28px}
          .gal__tabs button{min-height:56px;padding:8px 6px;border-radius:15px;font-size:14.5px;line-height:1.2}
          .gal__tabs button span{display:flex;flex-direction:column;align-items:center;gap:2px}
          .gal__tabs small{margin:0;font-size:12.5px}
        }
        .gal__pill{position:absolute;inset:0;border-radius:999px;background:linear-gradient(135deg,var(--teal),var(--petrol))}
        .gal__grid{columns:4 240px;column-gap:16px}
        .gal__item{display:block;width:100%;margin:0 0 16px;break-inside:avoid;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 20px 40px -32px rgba(1,41,45,.6)}
        .gal__item img{transition:transform .9s var(--ease-out)}
        .gal__item:hover img{transform:scale(1.05)}
        .gal__more{display:flex;justify-content:center;margin-top:40px}
        .lb{position:fixed;inset:0;z-index:950;background:rgba(1,20,22,.92);backdrop-filter:blur(10px);display:grid;place-items:center}
        .lb__img img{border-radius:14px;box-shadow:0 40px 100px rgba(0,0,0,.6)}
        .lb__btn{position:absolute;width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;display:grid;place-items:center;transition:background .3s}
        .lb__btn:hover{background:var(--teal)}
        .lb__close{top:20px;right:20px}
        .lb__prev{left:20px;top:50%;translate:0 -50%}
        .lb__next{right:20px;top:50%;translate:0 -50%}
        .flip{transform:scaleX(-1)}
        .lb__count{position:absolute;bottom:24px;left:50%;translate:-50% 0;color:#fff;opacity:.7;font-size:14px}
      `}</style>
    </div>
  );
}
