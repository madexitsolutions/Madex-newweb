"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { site } from "@/content/site";
import { Icon } from "@/components/ui/Icon";
import { SplitText } from "@/components/ui/motion";

export type Review = { quote: string; name: string; company?: string; rating?: number; when?: string; url?: string };
export type ReviewSource = { rating: number; count: number; url?: string };

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="ts__stars" role="img" aria-label={`${value.toLocaleString("de-CH", { maximumFractionDigits: 1 })} von 5 Sternen`}>
      {[0, 1, 2, 3, 4].map((k) => {
        const fill = Math.max(0, Math.min(1, value - k));
        return (
          <svg key={k} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={`tsg${k}-${Math.round(fill * 100)}`}>
                <stop offset={fill} stopColor="#fbbc05" />
                <stop offset={fill} stopColor="rgba(255,255,255,.25)" />
              </linearGradient>
            </defs>
            <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill={`url(#tsg${k}-${Math.round(fill * 100)})`} />
          </svg>
        );
      })}
    </span>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function TestimonialsSlider({ items, source }: { items: Review[]; source?: ReviewSource }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 8000);
    return () => clearInterval(t);
  }, [paused, items.length]);
  const t = items[i] ?? items[0];
  if (!t) return null;
  return (
    <section className="ts dark section" aria-labelledby="ts-title" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="container ts__grid">
        <div>
          <SplitText as="h2" text="Was unsere zufriedenen Kunden sagen" className="h2" />
          <div className="ts__avatars" aria-hidden="true">
            {["happy-carefree-dark-skinned-rebellious-young-woman-enjoys-awesome-music-makes-rock-n-roll-gesture-has-fun-on-music-festival-or-cool-event-wears-casual-jumper-poses-against-pink-wall", "pexels-andrea-piacquadio-3799837", "pexels-mikhail-nilov-9301512"].map((a) => (
              <Image key={a} src={`/media/2023/05/${a}.webp`} alt="" width={64} height={64} />
            ))}
            <span>Über 100 Kunden in der Schweiz</span>
          </div>
          {source && source.rating > 0 && (
            <a className="ts__score" href={source.url ?? site.reviewUrl} target="_blank" rel="noopener noreferrer">
              <GoogleG />
              <strong>{source.rating.toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
              <Stars value={source.rating} size={18} />
              <span>{source.count} Bewertungen auf Google</span>
            </a>
          )}
          <a href={site.reviewUrl} target="_blank" rel="noopener noreferrer" className="link-arrow">
            Hinterlassen Sie eine Bewertung <Icon name="arrow-up-right" size={16} />
          </a>
        </div>
        <div className="ts__stage">
          <span className="ts__quote" aria-hidden="true">“</span>
          <AnimatePresence mode="wait">
            <motion.figure key={i} initial={{ opacity: 0, y: 30, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -20, filter: "blur(10px)" }} transition={{ duration: 0.6 }}>
              {t.rating ? <Stars value={t.rating} /> : null}
              <blockquote className={t.quote.length > 360 ? "is-long" : undefined}>{t.quote}</blockquote>
              <figcaption>
                {t.url ? (
                  <a href={t.url} target="_blank" rel="noopener noreferrer">
                    <strong>{t.name}</strong>
                  </a>
                ) : (
                  <strong>{t.name}</strong>
                )}
                <span>{t.rating ? ["Bewertung auf Google", t.when].filter(Boolean).join(", ") : t.company}</span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
          <div className="ts__nav">
            {items.map((x, k) => (
              <button key={x.name + k} onClick={() => setI(k)} aria-label={`Kundenstimme ${k + 1}: ${x.name}`} aria-current={k === i} className={k === i ? "is-on" : ""} />
            ))}
          </div>
        </div>
      </div>
      <style>{`
        .ts{background:radial-gradient(60% 80% at 100% 100%,rgba(2,141,134,.35),transparent 60%),var(--night);overflow:hidden;position:relative}
        .ts__grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:clamp(30px,6vw,100px);align-items:center}
        .ts__avatars{display:flex;align-items:center;margin:20px 0 26px}
        .ts__avatars img{width:52px;height:52px;border-radius:50%;object-fit:cover;border:3px solid var(--night);margin-right:-14px}
        .ts__avatars span{margin-left:28px;font-weight:500}
        .ts__stage{position:relative;min-height:340px;padding:clamp(28px,4vw,56px);border-radius:var(--radius-l);background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
        .ts__quote{position:absolute;right:30px;top:-30px;font:800 200px/1 var(--font-display);color:var(--teal);opacity:.5}
        .ts__score{display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:fit-content;min-height:44px;margin:0 0 18px;padding:8px 14px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;transition:background .3s}
        .ts__score:hover{background:rgba(255,255,255,.1)}
        .ts__score strong{font:700 18px/1 var(--font-display)}
        .ts__score span:last-child{font-size:14px;color:var(--on-dark-soft)}
        .ts__stars{display:inline-flex;gap:2px;vertical-align:middle}
        .ts__stage .ts__stars{margin-bottom:14px}
        .ts__stage figcaption a{color:inherit;text-decoration:underline;text-decoration-color:rgba(255,255,255,.3);text-underline-offset:4px}
        .ts__stage blockquote{margin:0 0 26px;max-width:62ch;font:400 clamp(18px,1.6vw,23px)/1.6 var(--font-body)}
        .ts__stage blockquote.is-long{font-size:clamp(16px,1.25vw,18.5px);line-height:1.65}
        .ts__stage figcaption{display:grid}
        .ts__stage figcaption strong{font:700 18px/1.2 var(--font-display)}
        .ts__stage figcaption span{color:var(--teal-glow)}
        .ts__nav{display:flex;gap:4px;margin:18px 0 -10px -6px}
        .ts__nav button{position:relative;width:46px;height:44px}
        .ts__nav button::before{content:"";position:absolute;left:6px;right:6px;top:50%;height:5px;margin-top:-2.5px;border-radius:5px;background:rgba(255,255,255,.28);transition:background .3s,right .3s}
        .ts__nav button.is-on{width:72px}
        .ts__nav button.is-on::before{background:var(--teal-glow)}
        .ts__nav button:focus-visible{outline-offset:-4px}
        @media(max-width:900px){.ts__grid{grid-template-columns:minmax(0,1fr)}.ts__stage{padding:28px 22px 22px}.ts__quote{font-size:130px;right:14px;top:-20px}}
      `}</style>
    </section>
  );
}
