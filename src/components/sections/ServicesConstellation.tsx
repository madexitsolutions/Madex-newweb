"use client";

import { motion, useReducedMotion } from "framer-motion";
import { services, type Service } from "@/content/services";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/layout/Transition";

const STAGES: { title: string; text: string; slugs: string[] }[] = [
  {
    title: "Sichtbar werden",
    text: "Damit Kundinnen und Kunden Sie finden, wenn sie suchen.",
    slugs: ["seo-optimierung", "google-marketing", "social-media-marketing"],
  },
  {
    title: "Überzeugen",
    text: "Ein Auftritt, der Vertrauen schafft und zum Anfragen einlädt.",
    slugs: ["website-development", "graphic-design", "photo-werbevideos"],
  },
  {
    title: "Kunden gewinnen und wachsen",
    text: "Planen, messen, verbessern – und Arbeit mit KI abgeben.",
    slugs: ["digital-marketing", "analyse-und-planung", "ki-integration"],
  },
];

const bySlug = (slug: string) => services.find((s) => s.slug === slug);

/**
 * "Was wir tun": the nine services arranged along the path a customer takes,
 * from being found to being won. One drawn line connects the three stages.
 */
export function ServicesConstellation({ title = "Was wir tun", intro }: { title?: string; eyebrow?: string; intro?: string }) {
  const reduce = useReducedMotion();
  return (
    <section className="sj" aria-labelledby="sj-title">
      <div className="container">
        <div className="sj__head">
          <h2 id="sj-title" className="sec-title">
            {title}
          </h2>
          <p className="sj__intro">{intro ?? "Ein Ansprechpartner für alles: Wir verbinden Website, Marketing, Design und KI zu einem Auftritt, der Ihr Unternehmen sichtbar macht und Anfragen bringt."}</p>
        </div>

        <div className="sj__track">
          <svg className="sj__line" viewBox="0 0 1000 8" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="4" x2="1000" y2="4" className="sj__line-bg" />
            <motion.line
              x1="0"
              y1="4"
              x2="1000"
              y2="4"
              className="sj__line-fg"
              initial={reduce ? false : { pathLength: 0.04 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1] }}
            />
          </svg>
          <ol className="sj__stages">
            {STAGES.map((st, i) => (
              <li key={st.title} className="sj__stage">
                <div className="sj__stage-head">
                  <span className="sj__dot" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3>{st.title}</h3>
                  <p>{st.text}</p>
                </div>
                <ul className="sj__services">
                  {st.slugs.map(bySlug).filter((s): s is Service => !!s).map((s) => (
                    <li key={s.slug}>
                      <Link href={`/marketing-solutions/${s.slug}`} className="sj__svc">
                        <span className="sj__ic" aria-hidden="true">
                          <Icon name={s.icon} size={22} />
                        </span>
                        <span className="sj__txt">
                          <strong>{s.name}</strong>
                          <span>{s.short}</span>
                        </span>
                        <Icon name="arrow-up-right" size={18} className="sj__go" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>

        <div className="sj__more">
          <Button href="/marketing-solutions" variant="primary">
            Alle Leistungen im Überblick
          </Button>
        </div>
      </div>
      <style>{`
        .sj{background:var(--paper);color:var(--ink);padding:clamp(80px,9vw,140px) 0;overflow:hidden}
        .sj .sec-title{color:var(--deep);margin:0}
        .sj__head{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px 60px;align-items:end;margin-bottom:clamp(48px,6vw,80px)}
        .sj__intro{margin:0;max-width:52ch;font-size:clamp(16px,1.25vw,18px);line-height:1.65;color:var(--ink-soft)}
        .sj__track{position:relative}
        .sj__line{position:absolute;left:0;right:0;top:19px;width:100%;height:8px;overflow:visible}
        .sj__line line{stroke-width:2;vector-effect:non-scaling-stroke;fill:none}
        .sj__line-bg{stroke:var(--line)}
        .sj__line-fg{stroke:var(--teal);stroke-linecap:round}
        .sj__stages{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(20px,3vw,44px);position:relative}
        .sj__stage-head{margin-bottom:22px}
        .sj__dot{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:var(--paper);border:2px solid var(--teal);color:var(--teal-ink);font:600 15px/1 var(--font-body);margin-bottom:22px;font-variant-numeric:tabular-nums}
        .sj__stage-head h3{margin:0 0 6px;font:600 clamp(20px,1.7vw,25px)/1.2 var(--font-display);color:var(--deep);letter-spacing:-.015em}
        .sj__stage-head p{margin:0;font-size:15px;line-height:1.55;color:var(--ink-soft);max-width:34ch}
        .sj__services{list-style:none;margin:0;padding:0;display:grid;gap:10px}
        .sj__svc{display:grid;grid-template-columns:44px minmax(0,1fr) 18px;gap:14px;align-items:start;padding:16px 16px 16px 14px;border-radius:16px;background:#fff;border:1px solid var(--line-soft);box-shadow:0 1px 2px rgba(1,54,59,.04);transition:background .3s,border-color .3s,transform .4s var(--ease-out)}
        .sj__svc:hover{border-color:rgba(2,141,134,.45);box-shadow:0 14px 30px -18px rgba(1,54,59,.35);transform:translateY(-2px)}
        .sj__svc:focus-visible{outline:2px solid var(--teal);outline-offset:3px}
        .sj__ic{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--mint);color:var(--teal-ink)}
        .sj__txt{display:grid;gap:4px;min-width:0}
        .sj__txt strong{font:600 16.5px/1.3 var(--font-display);color:var(--deep);letter-spacing:-.005em}
        .sj__txt span{font-size:14px;line-height:1.5;color:var(--ink-soft)}
        .sj__go{margin-top:3px;color:var(--teal-ink);opacity:.55;transition:opacity .3s,transform .4s var(--ease-out)}
        .sj__svc:hover .sj__go{opacity:1;transform:translate(2px,-2px)}
        .sj__more{margin-top:clamp(40px,5vw,64px)}
        @media (max-width:960px){
          .sj__head{grid-template-columns:minmax(0,1fr)}
          .sj__line{display:none}
          .sj__stages{grid-template-columns:minmax(0,1fr);gap:40px}
          .sj__stage{position:relative;padding-left:60px}
          .sj__stage::before{content:"";position:absolute;left:20px;top:44px;bottom:-40px;width:2px;background:rgba(2,141,134,.3)}
          .sj__stage:last-child::before{display:none}
          .sj__dot{position:absolute;left:0;top:0;margin:0}
          .sj__stage-head{min-height:42px;padding-top:8px}
        }
      `}</style>
    </section>
  );
}
