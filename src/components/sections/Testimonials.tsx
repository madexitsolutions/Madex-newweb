"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { site, testimonials } from "@/content/site";
import { Icon } from "@/components/ui/Icon";
import { SplitText } from "@/components/ui/motion";

export function Testimonials() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((v) => (v + 1) % testimonials.length), 7000);
    return () => clearInterval(t);
  }, [paused]);
  const t = testimonials[i];
  return (
    <section className="ts dark section" aria-labelledby="ts-title" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="container ts__grid">
        <div>
          <p className="eyebrow">Kundenstimmen</p>
          <SplitText as="h2" text="Was unsere zufriedenen Kunden sagen" className="h2" />
          <div className="ts__avatars" aria-hidden="true">
            {["happy-carefree-dark-skinned-rebellious-young-woman-enjoys-awesome-music-makes-rock-n-roll-gesture-has-fun-on-music-festival-or-cool-event-wears-casual-jumper-poses-against-pink-wall", "pexels-andrea-piacquadio-3799837", "pexels-mikhail-nilov-9301512"].map((a) => (
              <Image key={a} src={`/media/2023/05/${a}.webp`} alt="" width={64} height={64} />
            ))}
            <span>Über 100 Kunden in der Schweiz</span>
          </div>
          <a href={site.reviewUrl} target="_blank" rel="noopener noreferrer" className="link-arrow">
            Hinterlassen Sie eine Bewertung <Icon name="arrow-up-right" size={16} />
          </a>
        </div>
        <div className="ts__stage">
          <span className="ts__quote" aria-hidden="true">“</span>
          <AnimatePresence mode="wait">
            <motion.figure key={i} initial={{ opacity: 0, y: 30, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -20, filter: "blur(10px)" }} transition={{ duration: 0.6 }}>
              <blockquote>{t.quote}</blockquote>
              <figcaption>
                <strong>{t.name}</strong>
                <span>{t.company}</span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
          <div className="ts__nav">
            {testimonials.map((x, k) => (
              <button key={x.name} onClick={() => setI(k)} aria-label={`Kundenstimme ${k + 1}: ${x.name}`} aria-current={k === i} className={k === i ? "is-on" : ""} />
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
        .ts__stage blockquote{margin:0 0 26px;font:400 clamp(18px,1.6vw,23px)/1.6 var(--font-body)}
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
