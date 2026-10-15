"use client";

import Image from "next/image";
import { Marquee } from "@/components/ui/motion";
import { Link } from "@/components/layout/Transition";
import { media } from "@/lib/media";
import type { Post } from "@/content/posts";
import { ProjectCard } from "./ProjectCard";

/* ------------------------------------------------------------- Clients */
export function PartnerMarquee({ logos }: { logos: string[] }) {
  return (
    <section className="pm" aria-labelledby="pm-title">
      <div className="container pm__head">
        <h2 id="pm-title">Über 100 Schweizer Unternehmen arbeiten mit Madex</h2>
        <Link href="/partners">Partner und Kunden ansehen</Link>
      </div>
      <div aria-hidden="true">
        <Marquee speed={60}>
          {logos.map((l, i) => (
            <span className="pm__logo" key={l + i}>
              <Image src={media(l)} alt="" width={150} height={150} loading="lazy" />
            </span>
          ))}
        </Marquee>
      </div>
      <style>{`
        .pm{overflow:hidden;background:#fff;border-top:1px solid var(--line-soft);padding:34px 0 30px}
        .pm__head{display:flex;justify-content:space-between;align-items:baseline;gap:8px 20px;margin-bottom:18px;flex-wrap:wrap}
        .pm__head h2{font-size:15px;font-weight:600;color:var(--ink-soft);margin:0;letter-spacing:0}
        .pm__head a{display:inline-flex;align-items:center;min-height:44px;font-size:14.5px;font-weight:600;color:var(--petrol);text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(2,81,89,.3)}
        .pm__logo{display:grid;place-items:center;width:130px;height:72px;margin:0 18px;filter:grayscale(1);opacity:.6;transition:filter .3s,opacity .3s}
        .pm__logo:hover{filter:none;opacity:1}
        .pm__logo img{width:110px;height:56px;object-fit:contain}
      `}</style>
    </section>
  );
}

/* ------------------------------------------------------------- Projects */
export function LatestProjects({ posts }: { posts: Post[] }) {
  return (
    <section className="lp" aria-labelledby="lp-title">
      <div className="container">
        <div className="lp__head">
          <div>
            <h2 id="lp-title" className="sec-title">
              Zuletzt realisierte Websites
            </h2>
            <p className="sec-lead">Eine Auswahl der Websites, die wir in den letzten Monaten für Schweizer Unternehmen umgesetzt haben.</p>
          </div>
          <Link href="/website-portfolio" className="b b--outline">
            Alle Projekte ansehen
          </Link>
        </div>
        <div className="lp__grid">
          {posts.slice(0, 6).map((p) => (
            <ProjectCard key={p.slug} post={p} />
          ))}
        </div>
      </div>
      <style>{`
        .lp{background:#fff;padding:clamp(72px,8vw,128px) 0;border-top:1px solid var(--line-soft)}
        .lp__head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap;margin-bottom:40px}
        .lp__head .sec-lead{margin-bottom:0}
        .lp__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:40px 28px}
        @media(max-width:1000px){.lp__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:600px){.lp__grid{grid-template-columns:minmax(0,1fr)}}
      `}</style>
    </section>
  );
}

