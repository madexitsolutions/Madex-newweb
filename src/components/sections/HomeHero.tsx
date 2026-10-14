"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { HeroCanvas } from "@/components/three/Scenes";
import { Button } from "@/components/ui/Button";
import { SplitText } from "@/components/ui/motion";
import { Link } from "@/components/layout/Transition";
import { site } from "@/content/site";

const ease = [0.16, 1, 0.3, 1] as const;

export function HomeHero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "35%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section ref={ref} className="hh dark" aria-labelledby="hero-title">
      <HeroCanvas className="hh__canvas" />
      <div className="hh__glow" aria-hidden="true" />

      <Link href="/marketing-solutions/website-development" className="hh__ticker" aria-label="Angebot: Website-Wartung für 250 CHF pro Monat inklusive Domain und Hosting">
        <span className="hh__ticker-track" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i}>
              Website-Wartung für <strong>250 CHF/Monat</strong> – inkl. Domain und Hosting <i>✦</i>
            </span>
          ))}
        </span>
      </Link>

      <motion.div className="container hh__inner" style={{ y, opacity }}>
        <motion.p className="eyebrow" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.9, ease }}>
          Schweizer Digitalagentur · Neuhausen am Rheinfall
        </motion.p>
        <SplitText as="h1" text={"Webdesign, Google Ads,\nSEO & Social Media\nfür Schweizer KMU."} className="hh__title" immediate delay={0.3} stagger={0.06} />
        <motion.p className="lead hh__lead" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 1, ease }}>
          <strong className="text-gradient">Website im Wert von CHF 8’000.– inklusive*</strong>
          <br />
          bei Abschluss unseres Online-Marketing-Pakets.
        </motion.p>
        <motion.div className="hh__ctas" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15, duration: 1, ease }}>
          <Button href="/kostenlose-prufung">Kostenloses Erstgespräch buchen</Button>
          <Button href="/website-portfolio" variant="ghost">
            Projekte ansehen
          </Button>
        </motion.div>
      </motion.div>

      <motion.div className="hh__foot container" style={{ opacity }}>
        <span className="hh__tag">{site.tagline}</span>
        <span className="hh__scroll" aria-hidden="true">
          Scrollen
          <span className="hh__line" />
        </span>
        <span className="hh__regions">{site.regions.join(" · ")}</span>
      </motion.div>

      <style>{`
        .hh{position:relative;min-height:100svh;display:flex;flex-direction:column;justify-content:center;overflow:hidden;isolation:isolate;
          background:radial-gradient(70% 60% at 70% 40%,rgba(2,81,89,.75),transparent 70%),radial-gradient(50% 50% at 10% 100%,rgba(2,141,134,.25),transparent 70%),var(--night)}
        .hh__canvas{position:absolute!important;inset:0;z-index:-1}
        .hero-fallback{position:absolute;inset:0;display:grid;place-items:center}
        .hero-fallback__mark{position:relative;width:min(46vw,560px);height:auto;margin-left:30vw;filter:drop-shadow(0 30px 60px rgba(0,0,0,.5))}
        .hh__glow{position:absolute;z-index:-1;inset:auto -10% -30% auto;width:70vw;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(79,224,210,.18),transparent 60%);pointer-events:none}
        .hh__ticker{position:absolute;top:96px;left:0;right:0;overflow:hidden;white-space:nowrap;font-size:14px;color:var(--on-dark);
          border-block:1px solid rgba(255,255,255,.08);background:rgba(2,141,134,.12);backdrop-filter:blur(6px);padding:9px 0}
        .hh__ticker-track{display:inline-flex;gap:40px;animation:marquee 38s linear infinite;padding-left:40px}
        .hh__ticker strong{color:var(--sun);font-weight:500}
        .hh__ticker i{font-style:normal;color:var(--teal-glow);margin-left:40px}
        .hh__ticker:hover .hh__ticker-track{animation-play-state:paused}
        @keyframes marquee{to{transform:translateX(-50%)}}
        .hh__inner{position:relative;padding-top:170px;padding-bottom:120px;pointer-events:none}
        .hh__inner a,.hh__inner button{pointer-events:auto}
        .hh__title{font-size:clamp(34px,4.2vw,72px);line-height:1.02;letter-spacing:-.035em;font-weight:700;max-width:none;margin-bottom:26px;text-shadow:0 10px 50px rgba(1,27,30,.5)}
        .hh__lead{color:var(--on-dark-soft);margin-bottom:38px}
        .hh__lead strong{font-weight:500;font-size:1.1em}
        .hh__ctas{display:flex;flex-wrap:wrap;gap:14px}
        .hh__foot{position:absolute;left:0;right:0;bottom:28px;display:flex;justify-content:space-between;align-items:center;gap:20px;font-size:13px;color:var(--on-dark-soft);letter-spacing:.06em}
        .hh__scroll{display:flex;flex-direction:column;align-items:center;gap:10px;text-transform:uppercase;letter-spacing:.3em;font-size:11px}
        .hh__line{width:1px;height:46px;background:linear-gradient(var(--teal-glow),transparent);animation:lineDrop 2s var(--ease-in-out) infinite;transform-origin:top}
        @keyframes lineDrop{0%{transform:scaleY(0)}50%{transform:scaleY(1);transform-origin:top}51%{transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}
        @media(max-width:900px){.hh{justify-content:flex-start}.hh__inner{padding-top:170px;padding-bottom:min(62vh,500px)}.hh__regions,.hh__tag{display:none}.hh__foot{justify-content:center}
          .hero-fallback__mark{margin:50vh 0 0;width:70vw}}
      `}</style>
    </section>
  );
}
