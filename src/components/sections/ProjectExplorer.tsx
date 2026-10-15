"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { RingCanvas } from "@/components/three/Scenes";
import { useTransition } from "@/components/layout/Transition";
import { media } from "@/lib/media";
import type { Post } from "@/content/posts";
import { ProjectCard } from "./ProjectCard";

const PAGE = 12;

/** 3D project ring + searchable, paginated HTML grid of all website projects. */
export function ProjectExplorer({ posts }: { posts: Post[] }) {
  const { navigate } = useTransition();
  const [hover, setHover] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [year, setYear] = useState("Alle");
  const [shown, setShown] = useState(PAGE);
  const years = useMemo(() => ["Alle", ...Array.from(new Set(posts.map((p) => p.date.slice(0, 4)))).sort().reverse()], [posts]);
  const ring = useMemo(() => posts.slice(0, 12).map((p) => ({ image: media(p.cover), title: p.client, href: `/${p.slug}` })), [posts]);

  const filtered = posts.filter((p) => {
    const okYear = year === "Alle" || p.date.startsWith(year);
    const needle = q.trim().toLowerCase();
    const okQ = !needle || p.title.toLowerCase().includes(needle) || p.client.toLowerCase().includes(needle);
    return okYear && okQ;
  });

  return (
    <>
      <section className="pe-ring dark" aria-label="Ausgewählte Projekte in 3D">
        <RingCanvas className="pe-ring__canvas" items={ring} onOpen={navigate} onHover={setHover} />
        <div className="pe-ring__label" aria-hidden="true">
          <AnimatePresence mode="wait">
            <motion.span key={hover ?? "drag"} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {hover ?? "Ziehen zum Drehen · Klicken zum Öffnen"}
            </motion.span>
          </AnimatePresence>
        </div>
      </section>

      <section className="section light" aria-labelledby="pe-title">
        <div className="container">
          <div className="pe__bar">
            <h2 id="pe-title" className="h2">
              Alle Projekte <sup>{filtered.length}</sup>
            </h2>
            <div className="pe__filters">
              <label className="pe__search">
                <span className="sr-only">Projekte durchsuchen</span>
                <input type="search" placeholder="Kunde oder Branche suchen …" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} />
              </label>
              <div className="pe__years" role="group" aria-label="Nach Jahr filtern">
                {years.map((y) => (
                  <button key={y} aria-pressed={year === y} className={year === y ? "is-on" : ""} onClick={() => { setYear(y); setShown(PAGE); }}>
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <motion.div layout className="pe__grid">
            <AnimatePresence>
              {filtered.slice(0, shown).map((p, i) => (
                <motion.div key={p.slug} layout initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0, transition: { delay: (i % PAGE) * 0.04 } }} exit={{ opacity: 0, scale: 0.95 }}>
                  <ProjectCard post={p} priority={i < 3} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          {filtered.length === 0 && <p className="muted">Keine Projekte gefunden.</p>}
          {shown < filtered.length && (
            <div className="pe__more">
              <button className="btn" onClick={() => setShown((s) => s + PAGE)}>
                <span>Mehr laden</span>
                <span className="btn__icon">+</span>
              </button>
            </div>
          )}
        </div>
      </section>
      <style>{`
        .pe-ring{position:relative;height:min(78vh,760px);background:radial-gradient(70% 60% at 50% 60%,rgba(2,141,134,.3),transparent 70%),var(--night)}
        .pe-ring__canvas{position:absolute!important;inset:0;cursor:grab}
        .pe-ring__canvas:active{cursor:grabbing}
        .pe-ring__label{position:absolute;left:0;right:0;bottom:36px;text-align:center;font:600 clamp(18px,2vw,28px)/1 var(--font-display);color:#fff;pointer-events:none}
        .pe__bar{display:flex;justify-content:space-between;align-items:end;gap:24px;flex-wrap:wrap;margin-bottom:40px}
        .pe__bar .h2{margin:0}
        .pe__bar sup{font-size:.4em;color:var(--teal-ink);vertical-align:super}
        .pe__filters{display:grid;gap:12px;justify-items:end}
        .pe__search input{width:min(360px,80vw);font:inherit;padding:14px 20px;border-radius:999px;border:1.5px solid rgba(2,81,89,.18);background:#fff}
        .pe__search input:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 4px rgba(2,141,134,.15)}
        .pe__years{display:flex;flex-wrap:wrap;gap:6px}
        .pe__years button{min-height:44px;padding:8px 18px;border-radius:999px;border:1.5px solid rgba(2,81,89,.18);font-size:14px;transition:.3s}
        .pe__years button.is-on{background:var(--petrol);color:#fff;border-color:var(--petrol)}
        .pe__grid{display:grid;grid-template-columns:repeat(3,1fr);gap:40px 24px}
        .pe__more{display:flex;justify-content:center;margin-top:50px}
        @media(max-width:1000px){.pe__grid{grid-template-columns:1fr 1fr}.pe__filters{justify-items:start}}
        @media(max-width:600px){.pe__grid{grid-template-columns:minmax(0,1fr)}}
      `}</style>
    </>
  );
}
