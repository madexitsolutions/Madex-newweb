"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useState } from "react";
import { Icon } from "./Icon";

export function Accordion({ items, dark = false }: { items: { q: string; a: string }[]; dark?: boolean }) {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();
  return (
    <div className={`acc${dark ? " acc--dark" : ""}`}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={`acc__item${isOpen ? " is-open" : ""}`}>
            <h3 className="acc__h">
              <button
                id={`${id}-b${i}`}
                aria-expanded={isOpen}
                aria-controls={`${id}-p${i}`}
                className="acc__btn"
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="acc__q">{it.q}</span>
                <span className="acc__icon">
                  <Icon name="plus" size={20} />
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`${id}-p${i}`}
                  role="region"
                  aria-labelledby={`${id}-b${i}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <p className="acc__a">{it.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      <style>{`
        .acc{border-top:1px solid rgba(2,81,89,.15)}
        .acc--dark{border-color:rgba(255,255,255,.12)}
        .acc__item{border-bottom:1px solid rgba(2,81,89,.15);transition:background .4s}
        .acc--dark .acc__item{border-color:rgba(255,255,255,.12)}
        .acc__h{margin:0;font:inherit}
        .acc__btn{width:100%;display:grid;grid-template-columns:auto 1fr auto;gap:22px;align-items:center;text-align:left;padding:28px 6px}
        .acc__num{font:600 13px/1 var(--font-body);color:var(--teal);letter-spacing:.1em}
        .acc--dark .acc__num{color:var(--teal-glow)}
        .acc__q{font:600 clamp(18px,1.6vw,23px)/1.3 var(--font-display);letter-spacing:-.01em}
        .acc__icon{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:1px solid currentColor;opacity:.6;transition:transform .5s var(--ease-out),background .4s,opacity .4s}
        .acc__item.is-open .acc__icon{transform:rotate(135deg);background:var(--teal);border-color:var(--teal);color:#fff;opacity:1}
        .acc__btn:hover .acc__icon{opacity:1}
        .acc__a{margin:0;padding:0 70px 30px 52px;max-width:80ch;opacity:.8}
        @media(max-width:640px){.acc__a{padding:0 6px 26px}.acc__btn{gap:14px}}
      `}</style>
    </div>
  );
}
