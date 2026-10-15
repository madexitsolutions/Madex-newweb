"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { OrbitCanvas } from "@/components/three/Scenes";
import { services } from "@/content/services";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Reveal, SplitText } from "@/components/ui/motion";
import { Link, useTransition } from "@/components/layout/Transition";

/** "Was wir tun": 3D constellation of the eight services, mirrored by an accessible HTML list. */
export function ServicesConstellation({ title = "Was wir tun", eyebrow = "Marketing Lösungen", intro }: { title?: string; eyebrow?: string; intro?: string }) {
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const { navigate } = useTransition();
  const current = services[hover ?? active];

  return (
    <section className="sc dark-ink section" aria-labelledby="sc-title">
      <div className="container">
        <div className="sc__head">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <SplitText as="h2" text={title} className="h2" />
          </div>
          {intro && (
            <Reveal delay={0.1}>
              <p className="lead muted">{intro}</p>
            </Reveal>
          )}
        </div>

        <div className="sc__stage">
          <ul className="sc__list">
            {services.map((s, i) => (
              <li key={s.slug}>
                <Link
                  href={`/marketing-solutions/${s.slug}`}
                  className={`sc__item${i === (hover ?? active) ? " is-active" : ""}`}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                >
                  <span className="sc__name">{s.name}</span>
                  <Icon name="arrow-up-right" size={20} className="sc__arrow" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="sc__visual">
            <OrbitCanvas className="sc__canvas" count={services.length} focus={active} highlight={hover} onSelect={(i) => navigate(`/marketing-solutions/${services[i].slug}`)} onHover={setHover} />
            <AnimatePresence mode="wait">
              <motion.div
                key={current.slug}
                className="sc__card glass"
                initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
                transition={{ duration: 0.45 }}
                aria-live="polite"
              >
                <div className="sc__thumb">
                  <Image src={current.image} alt="" width={120} height={120} />
                </div>
                <div>
                  <h3>{current.name}</h3>
                  <p>{current.short}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <Reveal className="sc__more">
          <Button href="/marketing-solutions" variant="light">
            Entdecken Sie alle Lösungen
          </Button>
        </Reveal>
      </div>
      <style>{`
        .sc{overflow:hidden;background:radial-gradient(60% 50% at 80% 40%,rgba(2,141,134,.3),transparent 70%),var(--ink)}
        .sc__head{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:end;margin-bottom:clamp(40px,5vw,70px)}
        .sc__stage{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:40px;align-items:center}
        .sc__list{list-style:none;margin:0;padding:0;counter-reset:s}
        .sc__item{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;padding:17px 6px;border-bottom:1px solid rgba(255,255,255,.1);
          transition:padding .5s var(--ease-out),color .3s}
        .sc__name{font:600 clamp(17px,1.55vw,24px)/1.2 var(--font-display);letter-spacing:-.02em;opacity:.62;transition:opacity .25s}
        .sc__arrow{opacity:0;transform:translate(-10px,10px);transition:.45s var(--ease-out);color:var(--teal-glow)}
        .sc__item.is-active{padding-left:10px}
        .sc__item.is-active .sc__name{opacity:1}
        .sc__item.is-active .sc__arrow{opacity:1;transform:none}
        .sc__visual{position:relative;aspect-ratio:1/1;max-height:640px}
        .sc__canvas{position:absolute!important;inset:0}
        .orbit-fallback{position:absolute;inset:0;display:grid;place-items:center}
        .orbit-fallback svg{width:40%;height:auto}
        .sc__card{position:absolute;left:50%;bottom:0;translate:-50% 0;width:min(440px,92%);display:flex;gap:16px;align-items:center;padding:14px;border-radius:22px}
        .sc__thumb{flex:none;width:76px;height:76px;border-radius:16px;overflow:hidden}
        .sc__thumb img{width:100%;height:100%;object-fit:cover}
        .sc__card h3{font-size:19px;margin:0 0 4px}
        .sc__card p{margin:0;font-size:14px;color:var(--on-dark-soft);line-height:1.45}
        .sc__more{margin-top:50px}
        @media(max-width:1000px){.sc__head,.sc__stage{grid-template-columns:minmax(0,1fr)}.sc__visual{order:-1;max-height:none}}
      `}</style>
    </section>
  );
}
