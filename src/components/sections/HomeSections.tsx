"use client";

import Image from "next/image";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { freeAnalysis, growth, offerSteps, packages, photoShoots, site, whyMadex } from "@/content/site";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { CountUp, Marquee, Parallax, Reveal, ScrollZoom, SplitText, StaggerGroup, StaggerItem, Tilt } from "@/components/ui/motion";
import { Link } from "@/components/layout/Transition";
import { media } from "@/lib/media";
import type { Post } from "@/content/posts";
import { ProjectCard } from "./ProjectCard";

const ease = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------------ USPs */
export function UspStrip() {
  const items = [
    { big: <CountUp to={100} suffix="+" />, label: "Kunden" },
    { big: <span className="usp__flag" aria-hidden="true">+</span>, label: "Schweizer Agentur" },
    { big: <Icon name="spark" size={44} />, label: "Persönliche Betreuung" },
    { big: <CountUp to={24} suffix="h" />, label: "Antwort innerhalb 24h" },
  ];
  return (
    <section className="usp white" aria-label={site.tagline}>
      <div className="container">
        <Reveal>
          <p className="usp__tag">
            <span className="text-gradient">{site.tagline}</span>
          </p>
        </Reveal>
        <StaggerGroup className="usp__grid">
          {items.map((it) => (
            <StaggerItem key={it.label} className="usp__item">
              <div className="usp__big">{it.big}</div>
              <div className="usp__label">{it.label}</div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
      <style>{`
        .usp{padding:clamp(60px,7vw,100px) 0;position:relative;z-index:2}
        .usp__tag{font:700 clamp(28px,3.6vw,52px)/1.05 var(--font-display);letter-spacing:-.03em;text-align:center;margin:0 0 50px}
        .usp__tag .text-gradient{background:linear-gradient(100deg,var(--petrol),var(--teal) 60%,var(--teal-bright));-webkit-background-clip:text;background-clip:text}
        .usp__grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
        .usp__item{padding:30px 26px;border-radius:var(--radius-m);background:var(--mist);border:1px solid rgba(2,81,89,.07);text-align:center;transition:transform .6s var(--ease-out),background .5s,color .5s}
        .usp__item:hover{transform:translateY(-8px);background:var(--petrol);color:#fff}
        .usp__big{font:800 clamp(40px,4vw,62px)/1 var(--font-display);color:var(--teal);height:64px;display:grid;place-items:center;transition:color .5s}
        .usp__item:hover .usp__big{color:var(--teal-glow)}
        .usp__flag{display:grid;place-items:center;width:52px;height:52px;border-radius:12px;background:#d52b1e;color:#fff;font:800 40px/1 var(--font-body)}
        .usp__label{margin-top:12px;font-weight:500}
        @media(max-width:900px){.usp__grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </section>
  );
}

/* ------------------------------------------------------- Offer / Analysis */
export function OfferHow() {
  return (
    <section className="oh light section" aria-labelledby="oh-title">
      <div className="container grid-2">
        <Reveal>
          <Tilt max={6}>
            <div className="oh__card dark grain">
              <p className="eyebrow">Gratis</p>
              <h2 id="oh-title" className="h3">Website inklusive & Marketing-Analyse</h2>
              <ul className="check-list oh__list">
                {freeAnalysis.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Button href="/kostenlose-prufung" variant="light">
                Kostenloses Erstgespräch buchen
              </Button>
              <div className="oh__orb" aria-hidden="true" />
            </div>
          </Tilt>
        </Reveal>
        <div>
          <p className="eyebrow">So funktioniert unser Angebot</p>
          <SplitText as="h2" text="In vier Schritten zur neuen Website." className="h2" />
          <ol className="oh__steps">
            {offerSteps.map((s, i) => (
              <Reveal as="li" key={s} delay={i * 0.1} className="oh__step">
                <span className="oh__n">{i + 1}</span>
                <span>{s}</span>
              </Reveal>
            ))}
          </ol>
          <Reveal delay={0.3}>
            <p className="oh__note">
              <strong>Keine versteckten Kosten.</strong> Mindestlaufzeit: 12 Monate.
            </p>
            <Button href="/kontakt">Kostenloses Erstgespräch buchen</Button>
          </Reveal>
        </div>
      </div>
      <style>{`
        .oh__card{position:relative;overflow:hidden;border-radius:var(--radius-l);padding:clamp(32px,4vw,56px);background:linear-gradient(150deg,var(--petrol),var(--night))}
        .oh__list{margin:28px 0 36px}
        .oh__orb{position:absolute;right:-90px;top:-90px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--teal-glow),var(--teal) 40%,transparent 70%);opacity:.45;filter:blur(4px);animation:orb 8s ease-in-out infinite alternate}
        @keyframes orb{to{transform:translate(-40px,60px) scale(1.2)}}
        .oh__steps{list-style:none;margin:30px 0;padding:0;display:grid;gap:12px;position:relative}
        .oh__step{min-width:0;display:flex;gap:18px;align-items:center;padding:18px 20px;background:#fff;border-radius:18px;box-shadow:0 20px 40px -32px rgba(1,41,45,.4);font-weight:400;font-size:17px}
        .oh__n{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font:700 18px/1 var(--font-display);color:#fff;background:linear-gradient(135deg,var(--teal),var(--petrol))}
        .oh__note{margin:0 0 26px}
      `}</style>
    </section>
  );
}

/* ------------------------------------------------------------- Partners */
export function PartnerMarquee({ logos }: { logos: string[] }) {
  const half = Math.ceil(logos.length / 2);
  const row = (list: string[]) =>
    list.map((l, i) => (
      <span className="pm__logo" key={l + i}>
        <Image src={media(l)} alt="Kundenlogo" width={150} height={150} loading="lazy" />
      </span>
    ));
  return (
    <section className="pm white section--tight" aria-labelledby="pm-title">
      <div className="container pm__head">
        <div>
          <p className="eyebrow">Vertrauen</p>
          <SplitText as="h2" text="Unsere geschätzten Partner" className="h2" />
        </div>
        <Link href="/partners" className="link-arrow">
          Alle sehen <Icon name="arrow" size={18} />
        </Link>
      </div>
      <Marquee speed={70}>{row(logos.slice(0, half))}</Marquee>
      <Marquee speed={80} reverse className="pm__second">
        {row(logos.slice(half))}
      </Marquee>
      <style>{`
        .pm{overflow:hidden}
        .pm__head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:40px;flex-wrap:wrap}
        .pm__logo{display:grid;place-items:center;width:150px;height:110px;margin:0 12px;border-radius:20px;background:var(--mist);filter:grayscale(1);opacity:.75;transition:filter .4s,opacity .4s,transform .4s var(--ease-out)}
        .pm__logo:hover{filter:none;opacity:1;transform:scale(1.08)}
        .pm__logo img{width:116px;height:64px;object-fit:contain}
        .pm__second{margin-top:16px}
      `}</style>
    </section>
  );
}

/* ------------------------------------------------------ Content / Shoots */
export function ContentShowcase() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const r1 = useTransform(scrollYProgress, [0, 1], [-8, 8]);
  const r2 = useTransform(scrollYProgress, [0, 1], [10, -6]);
  const y1 = useTransform(scrollYProgress, [0, 1], [120, -120]);
  const y2 = useTransform(scrollYProgress, [0, 1], [40, -200]);
  return (
    <section ref={ref} className="cs dark section" aria-labelledby="cs-title">
      <div className="container cs__grid">
        <div className="cs__copy">
          <p className="eyebrow">Foto & Video</p>
          <SplitText as="h2" text={"Starke Inhalte.\nStarke Partner.\nStarker Auftritt."} className="h2" />
          <Reveal delay={0.1}>
            <p className="lead">Professionelle Video-Shootings und Foto-Shootings machen Ihre Marke sichtbar und sorgen für Inhalte, die im Gedächtnis bleiben.</p>
            <p className="muted">
              Dank unseres starken Partnernetzwerks können wir Unternehmen auch in den Bereichen Foto, Video und Content-Produktion professionell unterstützen – passend zu Ihrem Auftritt und Ihrer Marke.
            </p>
            <p className="cs__claim">Von der Idee bis zum fertigen Content – alles aus einer Hand.</p>
            <Button href="/marketing-solutions/photo-werbevideos" variant="light">
              Photo & Werbevideos
            </Button>
          </Reveal>
        </div>
        <div className="cs__stack">
          <motion.div className="cs__phone" style={{ y: y2 }}>
            <video src="/media/2026/10/Madex-It-Solutions-011026.mp4" poster="/media/2026/10/Madex-It-Solutions-011026.webp" autoPlay muted loop playsInline preload="none" aria-label="Showreel Madex IT Solutions" />
          </motion.div>
          {photoShoots.map((src, i) => (
            <motion.div key={src} className={`cs__shot cs__shot--${i}`} style={{ y: i % 2 ? y1 : y2, rotate: i % 2 ? r1 : r2 }}>
              <Image src={src} alt="Foto-Shooting von Madex IT Solutions" fill sizes="(max-width: 900px) 45vw, 22vw" />
            </motion.div>
          ))}
        </div>
      </div>
      <style>{`
        .cs{overflow:hidden;background:radial-gradient(70% 60% at 85% 50%,rgba(2,141,134,.35),transparent 65%),var(--night)}
        .cs__grid{display:grid;grid-template-columns:1fr 1.1fr;gap:60px;align-items:center}
        .cs__claim{font:600 20px/1.3 var(--font-display);color:var(--teal-glow);margin:24px 0 32px}
        .cs__stack{position:relative;height:min(760px,90vw)}
        .cs__phone{position:absolute;left:50%;top:6%;width:min(250px,34%);translate:-50% 0;aspect-ratio:9/16;border-radius:32px;overflow:hidden;z-index:3;
          border:6px solid #0a2b2f;box-shadow:0 40px 80px -20px rgba(0,0,0,.7),0 0 0 1px rgba(79,224,210,.3)}
        .cs__phone video{width:100%;height:100%;object-fit:cover}
        .cs__shot{position:absolute;width:38%;aspect-ratio:1/0.9;border-radius:22px;overflow:hidden;box-shadow:0 30px 60px -20px rgba(0,0,0,.6)}
        .cs__shot img{object-fit:cover}
        .cs__shot--0{left:0;top:2%}
        .cs__shot--1{right:0;top:14%}
        .cs__shot--2{left:4%;bottom:4%}
        .cs__shot--3{right:6%;bottom:-2%}
        @media(max-width:900px){.cs__grid{grid-template-columns:minmax(0,1fr)}.cs__stack{height:120vw}}
      `}</style>
    </section>
  );
}

/* ------------------------------------------------------------- Packages */
export function Packages() {
  const [tab, setTab] = useState(1);
  const p = packages[tab];
  return (
    <section id="pakete" className="pk light section" aria-labelledby="pk-title">
      <div className="container">
        <div className="pk__head">
          <p className="eyebrow">Was wir tun</p>
          <SplitText as="h2" text="Unsere meistgebuchten Marketing-Pakete" className="h2" />
          <Reveal>
            <p className="lead muted">Starke Leistungen. Faire Preise. Alles aus einer Hand.</p>
          </Reveal>
        </div>
        <div className="pk__tabs" role="tablist" aria-label="Pakete">
          {packages.map((pk, i) => (
            <button key={pk.id} role="tab" id={`pk-tab-${pk.id}`} aria-selected={tab === i} aria-controls={`pk-panel-${pk.id}`} className={`pk__tab${tab === i ? " is-on" : ""}`} onClick={() => setTab(i)}>
                            <span>{pk.name}</span>
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={p.id}
            id={`pk-panel-${p.id}`}
            role="tabpanel"
            aria-labelledby={`pk-tab-${p.id}`}
            className="pk__panel"
            initial={{ opacity: 0, y: 30, rotateX: -8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease }}
          >
            <div className="pk__intro dark grain">
              <span className="chip">{p.name}</span>
              <h3 className="h3">{p.title}</h3>
              <p className="muted">{p.intro}</p>
              {p.id === "wartung" && (
                <p className="pk__price">
                  <span>250</span> CHF / Monat
                  <small>inkl. Domain und Hosting</small>
                </p>
              )}
              <Button href={p.href} variant="light">
                Kostenloses Erstgespräch buchen
              </Button>
            </div>
            <ul className="pk__features">
              {p.features.map((f, i) => (
                <motion.li key={f} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.03, duration: 0.5, ease }}>
                  <Icon name="check" size={18} strokeWidth={2.4} />
                  {f}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
      <style>{`
        .pk__head{text-align:center;display:grid;justify-items:center;margin-bottom:40px}
        .pk__head .lead{margin-inline:auto}
        .pk__tabs{display:flex;justify-content:center;gap:6px;margin:0 auto 40px;padding:6px;border-radius:999px;background:#fff;width:max-content;max-width:100%;box-shadow:0 20px 40px -30px rgba(1,41,45,.5);flex-wrap:wrap}
        .pk__tab{position:relative;padding:14px 26px;border-radius:999px;font-weight:500;transition:color .4s,background .4s}
        @media(max-width:600px){.pk__tabs{display:grid;grid-template-columns:repeat(3,1fr);width:100%;border-radius:22px}.pk__tab{padding:12px 8px;font-size:14px;border-radius:16px}}
        .pk__tab.is-on{color:#fff;background:linear-gradient(135deg,var(--teal),var(--petrol))}
        .pk__tab span{position:relative}
        .pk__pill{position:absolute;inset:0;border-radius:999px;background:linear-gradient(135deg,var(--teal),var(--petrol))}
        .pk__panel{display:grid;grid-template-columns:.9fr 1.1fr;gap:20px;perspective:1200px}
        .pk__intro{position:relative;overflow:hidden;border-radius:var(--radius-l);padding:clamp(30px,4vw,54px);background:linear-gradient(160deg,var(--petrol),var(--night));display:flex;flex-direction:column;gap:16px;align-items:flex-start}
        .pk__price{font-size:18px;margin:0}
        .pk__price span{font:800 64px/1 var(--font-display);color:var(--teal-glow);margin-right:6px}
        .pk__price small{display:block;color:var(--on-dark-soft);font-size:14px}
        .pk__features{list-style:none;margin:0;padding:clamp(24px,3vw,44px);border-radius:var(--radius-l);background:#fff;display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;align-content:start}
        .pk__features li{display:flex;gap:10px;align-items:flex-start}
        .pk__features svg{flex:none;color:var(--teal);margin-top:4px}
        @media(max-width:900px){.pk__panel{grid-template-columns:minmax(0,1fr)}.pk__features{grid-template-columns:minmax(0,1fr)}}
      `}</style>
    </section>
  );
}

/* --------------------------------------------------------- Why Madex */
export function WhyOnline() {
  return (
    <section className="wo white section" aria-labelledby="wo-title">
      <div className="container grid-2">
        <div>
          <p className="eyebrow">Madex IT Solutions</p>
          <SplitText as="h2" text={"Warum Online Marketing?\nWarum Madex als Partner?"} className="h2" />
          <Reveal>
            <p className="lead muted">
              Mit Madex IT Solutions steigern Sie Ihren Online-Erfolg durch professionelle, kreative und moderne digitale Marketingstrategien – für mehr Sichtbarkeit und eine effiziente Kundenansprache. Zusammenarbeit mit uns
              bedeutet Zugang zu einem engagierten Team, das Ihre Marke auf das nächste Level hebt.
            </p>
            <Link href="/website-portfolio" className="link-arrow">
              Mehr über unseren einzigartigen Ansatz <Icon name="arrow" size={18} />
            </Link>
          </Reveal>
        </div>
        <StaggerGroup className="wo__grid">
          {whyMadex.map((w, i) => (
            <StaggerItem key={w.title} className="wo__item">
              <span className="wo__icon">
                <Icon name={(["star", "spark", "web", "video"] as const)[i]} size={26} />
              </span>
              <h3>{w.title}</h3>
              <p>{w.text}</p>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
      <style>{`
        .wo__grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .wo__item{padding:28px;border-radius:var(--radius-m);background:var(--mist);transition:transform .6s var(--ease-out),box-shadow .6s}
        .wo__item:nth-child(even){transform:translateY(40px)}
        .wo__item:hover{box-shadow:0 30px 60px -30px rgba(2,81,89,.45)}
        .wo__icon{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--teal),var(--petrol));margin-bottom:18px}
        .wo__item h3{font-size:20px;margin-bottom:8px}
        .wo__item p{margin:0;color:var(--text-soft);font-size:15.5px}
        @media(max-width:600px){.wo__grid{grid-template-columns:minmax(0,1fr)}.wo__item:nth-child(even){transform:none}}
      `}</style>
    </section>
  );
}

/* --------------------------------------------- Horizontal latest projects */
export function LatestProjects({ posts }: { posts: Post[] }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["0%", `-${Math.max(0, (posts.length - 1.6) * 100) / posts.length}%`]);
  return (
    <section ref={ref} className="lp dark" style={{ height: `${posts.length * 55 + 60}vh` }} aria-labelledby="lp-title">
      <div className="lp__sticky">
        <div className="container lp__head">
          <div>
            <p className="eyebrow">Website Portfolio</p>
            <h2 id="lp-title" className="h2">
              Zuletzt abgeschlossene <span className="text-gradient">Website-Projekte</span>
            </h2>
          </div>
          <div className="lp__head-r">
            <p className="muted">Hier finden Sie einige unserer neuesten Website-Projekte, die wir erstellt haben.</p>
            <Button href="/website-portfolio" variant="ghost">
              Unser Portfolio
            </Button>
          </div>
        </div>
        <motion.div className="lp__track" style={{ x }}>
          {posts.map((p, i) => (
            <div key={p.slug} className="lp__card">
              <span className="lp__idx">{String(i + 1).padStart(2, "0")}</span>
              <ProjectCard post={p} />
            </div>
          ))}
        </motion.div>
        <div className="container">
          <div className="lp__progress">
            <motion.span style={{ scaleX: scrollYProgress }} />
          </div>
        </div>
      </div>
      <style>{`
        .lp{position:relative;background:var(--night)}
        .lp__sticky{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;justify-content:center;gap:40px;overflow:hidden}
        .lp__head{display:flex;justify-content:space-between;align-items:end;gap:30px;flex-wrap:wrap}
        .lp__head .h2{max-width:14ch;margin:0}
        .lp__head-r{max-width:360px;display:grid;gap:14px;justify-items:start}
        .lp__head-r p{margin:0}
        .lp__track{display:flex;gap:28px;padding-left:var(--gutter);width:max-content}
        .lp__card{position:relative;width:clamp(280px,32vw,460px)}
        .lp__idx{position:absolute;top:-34px;left:0;font:800 16px/1 var(--font-display);color:var(--teal-glow)}
        .lp__progress{height:2px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden}
        .lp__progress span{display:block;height:100%;background:linear-gradient(90deg,var(--teal),var(--teal-glow));transform-origin:left}
        @media(max-height:760px){.lp__sticky{gap:24px}.lp__card{width:clamp(260px,26vw,380px)}}
      `}</style>
    </section>
  );
}

/* --------------------------------------------- Videos + graphic teaser */
export function CreativeTeasers({ designs }: { designs: string[] }) {
  return (
    <section className="ct light section" aria-label="Werbevideos und Grafikdesign">
      <div className="container ct__grid">
        <Reveal className="ct__video">
          <Link href="/werbevideos-portfolio" className="ct__vlink" data-cursor="Play">
            <ScrollZoom className="ct__zoom">
              <video src="/media/2026/10/Madex-VIDEO-1.mp4" poster="/media/2026/10/Madex-VIDEO-1.webp" muted loop autoPlay playsInline preload="none" aria-hidden="true" />
            </ScrollZoom>
            <span className="ct__play">
              <Icon name="play" size={30} />
            </span>
          </Link>
          <div className="ct__copy">
            <p className="eyebrow">Werbevideos</p>
            <h2 className="h3">Die letzten Werbevideos</h2>
            <p className="muted">Wir erstellen professionelle Werbevideos, die Aufmerksamkeit erregen und Ihre Botschaft klar und kraftvoll vermitteln.</p>
            <Link href="/werbevideos-portfolio" className="link-arrow">
              Alle Videoanzeigen ansehen <Icon name="arrow" size={18} />
            </Link>
          </div>
        </Reveal>
        <div className="ct__design">
          <div className="ct__copy">
            <p className="eyebrow">Graphic Design</p>
            <h2 className="h3">Einige der grafischen Entwürfe</h2>
            <p className="muted">
              Grafikdesign in sozialen Medien hilft Ihnen, eine einzigartige Identität zu schaffen, die Aufmerksamkeit Ihrer Zielgruppe zu gewinnen und Botschaften effektiv zu vermitteln. Ein durchdachtes Design steigert
              das Engagement, fördert Interaktionen und stärkt die Bindung zu Ihren Followern.
            </p>
            <Link href="/graphic-design-portfolio" className="link-arrow">
              Alle grafischen Entwürfe ansehen <Icon name="arrow" size={18} />
            </Link>
          </div>
          <div className="ct__mosaic">
            {designs.slice(0, 6).map((d, i) => (
              <Parallax key={d} speed={i % 2 ? 0.12 : -0.06} className="ct__tile">
                <Image src={media(d)} alt="Social-Media-Design von Madex IT Solutions" width={400} height={400} sizes="(max-width: 900px) 33vw, 15vw" />
              </Parallax>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        .ct__grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(30px,5vw,80px)}
        .ct__vlink{position:relative;display:block;border-radius:var(--radius-l);overflow:hidden;aspect-ratio:16/10}
        .ct__zoom{height:100%}
        .ct__zoom video{width:100%;height:100%;object-fit:cover}
        .ct__play{position:absolute;left:50%;top:50%;translate:-50% -50%;width:88px;height:88px;border-radius:50%;background:rgba(255,255,255,.9);color:var(--petrol);display:grid;place-items:center;
          box-shadow:0 0 0 0 rgba(255,255,255,.5);animation:pulse 2.2s infinite;transition:transform .5s var(--ease-out)}
        .ct__vlink:hover .ct__play{transform:scale(1.15)}
        @keyframes pulse{70%{box-shadow:0 0 0 28px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
        .ct__copy{margin-top:30px}
        .ct__design{display:flex;flex-direction:column}
        .ct__design .ct__copy{margin:0 0 30px}
        .ct__mosaic{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        .ct__tile{border-radius:18px;overflow:hidden;aspect-ratio:1;box-shadow:0 20px 40px -30px rgba(0,0,0,.5)}
        .ct__tile img{width:100%;height:100%;object-fit:cover}
        @media(max-width:900px){.ct__grid{grid-template-columns:minmax(0,1fr)}}
      `}</style>
    </section>
  );
}

/* ------------------------------------------------------ Big offer CHF 8000 */
export function BigOffer() {
  return (
    <section className="bo section dark" aria-labelledby="bo-title">
      <div className="container bo__grid">
        <div>
          <p className="eyebrow">Neukunden-Aktion</p>
          <h2 id="bo-title" className="h1 bo__title">
            Neue Website im Wert von <span className="text-gradient">CHF 8’000.–</span> inklusive
          </h2>
          <Reveal>
            <p className="lead muted">
              Sie möchten Ihre Website modernisieren und gleichzeitig mehr Kunden über Google, Social Media und Online-Marketing gewinnen? Im Rahmen unserer Neukunden-Aktion erstellen wir Ihre neue professionelle Website
              ohne zusätzliche Entwicklungskosten*.
            </p>
          </Reveal>
          <ul className="check-list bo__list">
            {["Individuelles Webdesign", "Optimiert für Smartphone & Google", "Persönliche Betreuung aus der Schweiz", "Auf Wunsch mit SEO & Online-Marketing"].map((t, i) => (
              <Reveal as="li" key={t} delay={i * 0.08}>
                {t}
              </Reveal>
            ))}
          </ul>
          <Button href="/kostenlose-prufung" variant="light">
            Kostenloses Erstgespräch anfragen
          </Button>
          <p className="bo__fine">* Bei Abschluss eines Online-Marketing-Pakets mit 12 Monaten Laufzeit.</p>
        </div>
        <div className="bo__visual">
          <Tilt max={12}>
            <div className="bo__img">
              <Image src="/media/2024/08/3.webp" alt="Website-Mockup von Madex IT Solutions" width={1024} height={1024} sizes="(max-width: 900px) 90vw, 40vw" />
            </div>
          </Tilt>
          <div className="bo__badge">
            <strong>8’000</strong>
            <span>CHF Wert</span>
          </div>
        </div>
      </div>
      <style>{`
        .bo{overflow:hidden;background:linear-gradient(160deg,var(--ink),var(--night))}
        .bo__grid{display:grid;grid-template-columns:1.1fr .9fr;gap:60px;align-items:center}
        .bo__title{max-width:14ch}
        .bo__list{margin:28px 0 36px}
        .bo__fine{margin-top:18px;font-size:13px;color:var(--on-dark-soft)}
        .bo__visual{position:relative}
        .bo__img{border-radius:var(--radius-l);overflow:hidden;box-shadow:0 60px 120px -40px rgba(0,0,0,.8)}
        .bo__img img{width:100%;height:auto}
        .bo__badge{position:absolute;left:-30px;bottom:40px;width:150px;height:150px;border-radius:50%;display:grid;place-content:center;text-align:center;
          background:var(--sun);color:var(--night);transform:rotate(-12deg);animation:spinBadge 14s linear infinite;box-shadow:0 30px 60px -20px rgba(255,190,17,.6)}
        .bo__badge strong{font:800 36px/1 var(--font-display)}
        .bo__badge span{font-size:13px;font-weight:500}
        @keyframes spinBadge{50%{transform:rotate(8deg) scale(1.05)}}
        @media(max-width:900px){.bo__grid{grid-template-columns:minmax(0,1fr)}.bo__badge{left:auto;right:10px;width:120px;height:120px}}
      `}</style>
    </section>
  );
}

/* --------------------------------------------------------------- Growth */
export function Growth() {
  return (
    <section className="gr white section" aria-labelledby="gr-title">
      <div className="container gr__grid">
        <div className="gr__visual">
          <Parallax speed={0.08}>
            <Image src="/media/brand/brand-mascot.webp" alt="" width={900} height={945} className="gr__mascot" />
          </Parallax>
        </div>
        <div>
          <p className="eyebrow">Warum Madex</p>
          <SplitText as="h2" text="Wie wir den Umsatz steigern" className="h2" />
          <ol className="gr__list">
            {growth.map((g, i) => (
              <Reveal as="li" key={g.title} delay={i * 0.08} className="gr__item">
                <span className="gr__n">0{i + 1}</span>
                <div>
                  <h3>{g.title}</h3>
                  <p>{g.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
      <style>{`
        .gr__grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:60px;align-items:center}
        .gr__visual{position:relative}
        .gr__visual::before{content:"";position:absolute;inset:10% 5%;border-radius:50%;background:radial-gradient(circle,rgba(2,141,134,.25),transparent 65%)}
        .gr__mascot{position:relative;width:100%;height:auto;animation:mascot 7s ease-in-out infinite alternate}
        @keyframes mascot{to{transform:translateY(-24px) rotate(-3deg)}}
        .gr__list{list-style:none;margin:30px 0 0;padding:0;display:grid;gap:4px}
        .gr__item{display:grid;grid-template-columns:60px 1fr;gap:16px;padding:22px 0;border-bottom:1px solid var(--line)}
        .gr__n{font:800 22px/1 var(--font-display);color:var(--teal)}
        .gr__item h3{font-size:21px;margin-bottom:6px}
        .gr__item p{margin:0;color:var(--text-soft)}
        @media(max-width:900px){.gr__grid{grid-template-columns:minmax(0,1fr)}.gr__visual{max-width:360px;margin:0 auto}}
      `}</style>
    </section>
  );
}
