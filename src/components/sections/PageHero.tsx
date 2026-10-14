import type { ReactNode } from "react";
import { BackdropCanvas } from "@/components/three/Scenes";
import type { HeroSceneKey } from "@/components/three/heroes/registry";
import { SplitText, Reveal } from "@/components/ui/motion";
import { Link } from "@/components/layout/Transition";
import { breadcrumbJsonLd } from "@/lib/seo";

type Crumb = { name: string; path: string };

export function PageHero({
  eyebrow,
  title,
  lead,
  crumbs,
  children,
  mark = true,
  compact = false,
  scene,
  sceneProps,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  crumbs?: Crumb[];
  children?: ReactNode;
  mark?: boolean;
  compact?: boolean;
  /** themed 3D scene for this page (falls back to the floating mark) */
  scene?: HeroSceneKey;
  sceneProps?: { image?: string };
}) {
  const trail = crumbs ? [{ name: "Home", path: "/" }, ...crumbs] : null;
  return (
    <section className={`ph dark${compact ? " ph--compact" : ""}`}>
      <BackdropCanvas className="ph__canvas" withMark={mark} scene={scene} sceneProps={sceneProps} />
      <div className="ph__shade" />
      <div className="container ph__inner">
        <div className="ph__copy">
        {trail && (
          <nav aria-label="Breadcrumb" className="ph__crumbs">
            <ol>
              {trail.map((c, i) => (
                <li key={c.path}>
                  {i < trail.length - 1 ? <Link href={c.path}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {eyebrow && (
          <Reveal y={20}>
            <p className="eyebrow">{eyebrow}</p>
          </Reveal>
        )}
        <SplitText as="h1" text={title} className="h1 ph__title" immediate delay={0.15} />
        {lead && (
          <Reveal delay={0.45} y={24}>
            <p className="lead ph__lead">{lead}</p>
          </Reveal>
        )}
        {children && (
          <Reveal delay={0.6} y={24} className="ph__extra">
            {children}
          </Reveal>
        )}
        </div>
      </div>
      <div className="ph__scroll" aria-hidden="true">
        <span />
      </div>
      {trail && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(trail)) }} />}
      <style>{`
        .ph{position:relative;min-height:min(100svh,940px);display:flex;align-items:center;overflow:hidden;padding:140px 0 100px;isolation:isolate}
        .ph--compact{min-height:min(82svh,780px)}
        .ph__canvas{position:absolute!important;inset:0;z-index:-2}
        .backdrop-fallback{position:absolute;inset:0;background:radial-gradient(80% 70% at 75% 30%,rgba(2,141,134,.45),transparent 60%),radial-gradient(60% 60% at 10% 90%,rgba(2,81,89,.6),transparent 60%),var(--night)}
        .ph__shade{position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(1,27,30,.82) 0%,rgba(1,27,30,.35) 45%,transparent 70%);pointer-events:none}
        .ph__inner{position:relative}
        .ph__copy{max-width:min(620px,52%)}
        .ph__title{margin-bottom:22px;text-wrap:balance}
        .ph__lead{color:var(--on-dark-soft);max-width:48ch;margin:0}
        .ph__extra{margin-top:32px;display:flex;flex-wrap:wrap;gap:12px}
        .ph__crumbs ol{display:flex;flex-wrap:wrap;align-items:center;gap:8px;list-style:none;margin:0 0 26px;padding:0;font-size:13px;letter-spacing:.02em;color:var(--on-dark-soft)}
        .ph__crumbs li+li::before{content:"/";margin-right:8px;opacity:.45}
        .ph__crumbs a{transition:color .3s}
        .ph__crumbs a:hover{color:var(--teal-glow)}
        .ph__crumbs [aria-current]{color:var(--on-dark);max-width:32ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:bottom}
        .ph__scroll{position:absolute;left:50%;bottom:26px;width:24px;height:40px;border:1.5px solid rgba(255,255,255,.35);border-radius:14px;translate:-50% 0}
        .ph__scroll span{position:absolute;left:50%;top:8px;width:3px;height:8px;border-radius:3px;background:var(--teal-glow);translate:-50% 0;animation:scrollDot 1.8s var(--ease-in-out) infinite}
        @keyframes scrollDot{0%{opacity:0;transform:translateY(0)}30%{opacity:1}100%{opacity:0;transform:translateY(14px)}}
        @media(max-width:900px){.ph__copy{max-width:none}.ph{align-items:flex-start;padding-top:124px;min-height:auto;padding-bottom:min(118vw,480px)}.ph__shade{background:linear-gradient(180deg,rgba(1,27,30,.7),rgba(1,27,30,.1))}.ph__scroll{display:none}}
      `}</style>
    </section>
  );
}
