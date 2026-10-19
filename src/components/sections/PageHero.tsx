import type { ReactNode } from "react";
import { BackdropCanvas } from "@/components/three/Scenes";
import type { HeroSceneKey } from "@/components/three/heroes/registry";
import { SplitText } from "@/components/ui/motion";
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
    <section className={`ph dark${compact ? " ph--compact" : ""}${title.length > 40 ? " ph--long" : ""}`}>
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
          <p className="eyebrow ph-in">{eyebrow}</p>
        )}
        <SplitText as="h1" text={title} className="h1 ph__title" immediate delay={0.15} />
        {lead && (
          <p className="lead ph__lead ph-in" style={{ animationDelay: ".25s" }}>
            {lead}
          </p>
        )}
        {children && (
          <div className="ph__extra ph-in" style={{ animationDelay: ".4s" }}>
            {children}
          </div>
        )}
        </div>
      </div>
      {trail && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(trail)) }} />}
      <style>{`
        .ph{position:relative;min-height:min(86svh,820px);display:flex;align-items:center;overflow:hidden;padding:calc(var(--header-h) + 60px) 0 90px;isolation:isolate}
        .ph--compact{min-height:min(70svh,660px)}
        .ph__canvas{position:absolute!important;inset:0;z-index:-2}
        .backdrop-fallback{position:absolute;inset:0;background:radial-gradient(80% 70% at 75% 30%,rgba(2,141,134,.45),transparent 60%),radial-gradient(60% 60% at 10% 90%,rgba(2,81,89,.6),transparent 60%),var(--night)}
        .ph__shade{position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(1,46,50,.85) 0%,rgba(1,46,50,.4) 45%,transparent 70%);pointer-events:none}
        .ph__inner{position:relative}
        .ph__copy{max-width:min(620px,52%)}
        .ph__title{margin-bottom:22px;text-wrap:balance}
        /* long headlines: a calmer size and a wider column so they settle into 2–3 balanced lines */
        .ph--long .ph__copy{max-width:min(760px,60%)}
        .ph--long .ph__title{font-size:clamp(30px,3.1vw,48px);line-height:1.08;letter-spacing:-.025em}
        .ph__lead{color:var(--on-dark-soft);max-width:48ch;margin:0}
        .ph__extra{margin-top:32px;display:flex;flex-wrap:wrap;gap:12px}
        .ph-in{animation:phIn .8s cubic-bezier(.16,1,.3,1) both}
        @keyframes phIn{from{opacity:.35;transform:translateY(14px)}to{opacity:1;transform:none}}
        .ph__crumbs ol{display:flex;flex-wrap:wrap;align-items:center;gap:8px;list-style:none;margin:-12px 0 14px;padding:0;font-size:13px;letter-spacing:.02em;color:var(--on-dark-soft)}
        .ph__crumbs li+li::before{content:"/";margin-right:8px;opacity:.45}
        .ph__crumbs a{transition:color .3s;display:inline-flex;align-items:center;min-height:44px}
        .ph__crumbs a:hover{color:#fff}
        .ph__crumbs [aria-current]{color:var(--on-dark);max-width:32ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:bottom}
        @media(max-width:900px){.ph__copy,.ph--long .ph__copy{max-width:none}.ph{align-items:flex-start;padding-top:calc(var(--header-h) + 40px);min-height:auto;padding-bottom:min(118vw,480px)}.ph__shade{background:linear-gradient(180deg,rgba(1,46,50,.75),rgba(1,46,50,.1))}}
      `}</style>
    </section>
  );
}
