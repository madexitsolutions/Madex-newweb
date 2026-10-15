import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/sections/PageHero";
import { CtaBand } from "@/components/sections/CtaBand";
import { FaqSection } from "@/components/sections/FaqSection";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Parallax, Reveal, ScrollZoom, SplitText, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { Link } from "@/components/layout/Transition";
import { AiDemo } from "@/components/home/Sections";
import "@/components/home/home.css";
import { getService, services } from "@/content/services";
import { withSeo } from "@/lib/seo";
import type { HeroSceneKey } from "@/components/three/heroes/registry";

export const dynamicParams = false;

const SCENES: Record<string, HeroSceneKey> = {
  "website-development": "web",
  "digital-marketing": "digital",
  "seo-optimierung": "seo",
  "photo-werbevideos": "video",
  "social-media-marketing": "social",
  "google-marketing": "google",
  "graphic-design": "design",
  "analyse-und-planung": "analysis",
  "ki-integration": "ai",
};

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) return {};
  return withSeo({ title: s.metaTitle, description: s.metaDescription, path: `/marketing-solutions/${s.slug}`, image: s.image });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) notFound();
  const idx = services.indexOf(s);
  const next = services[(idx + 1) % services.length];
  const prev = services[(idx - 1 + services.length) % services.length];

  return (
    <>
      <PageHero scene={SCENES[s.slug]}
        eyebrow={s.eyebrow}
        title={s.heroTitle}
        lead={s.short}
        crumbs={[
          { name: "Marketing Lösungen", path: "/marketing-solutions" },
          { name: s.name, path: `/marketing-solutions/${s.slug}` },
        ]}
      >
        <Button href="/kostenlose-prufung">Kostenlose Beratung anfragen</Button>
        <Button href="#leistungen" variant="ghost">
          Leistungen ansehen
        </Button>
      </PageHero>

      <section id="leistungen" className="section light" aria-labelledby="sv-intro">
        <div className="container sv__intro">
          <div className="sv__visual">
            {s.slug === "ki-integration" ? (
              <AiDemo />
            ) : (
              <div className="sv__cover">
                <Image src={s.image} alt={s.name} width={900} height={900} sizes="(max-width: 900px) 90vw, 40vw" priority />
              </div>
            )}
          </div>
          <div>
            <p className="eyebrow">{s.name}</p>
            <SplitText as="h2" text={s.introTitle} className="h2" />
            <Reveal>
              <p className="lead muted">{s.intro}</p>
            </Reveal>
            <StaggerGroup as="ul" className="sv__bullets">
              {s.bullets.map((b) => (
                <StaggerItem as="li" key={b}>
                  <Icon name="check" size={18} strokeWidth={2.4} /> {b}
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </div>
      </section>

      {s.featureTitle && (
        <section className="section--tight dark sv__feature" aria-labelledby="sv-feature">
          <div className="container sv__feature-grid">
            <SplitText as="h2" text={s.featureTitle} className="h2" />
            <Reveal delay={0.1}>
              <p className="lead">{s.featureText}</p>
              <Button href="/kontakt" variant="light">
                Projekt unverbindlich besprechen
              </Button>
            </Reveal>
          </div>
          {s.gallery && s.gallery.length > 1 && (
            <div className="container sv__gallery">
              {s.gallery.map((g, i) => (
                <Parallax key={g} speed={[0.05, -0.08, 0.1][i % 3]} className="sv__g">
                  <Image src={g} alt={`${s.name} – Beispiel ${i + 1}`} width={768} height={1050} sizes="(max-width: 900px) 33vw, 25vw" />
                </Parallax>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="section white" aria-label={`${s.name} im Detail`}>
        <div className={`container sv__sections${s.sections.some((x) => x.image) ? "" : " sv__sections--grid"}`}>
          {s.sections.map((sec, i) => (
            <article key={sec.title} className={`sv__sec${sec.image ? "" : " sv__sec--text"}${i % 2 ? " is-flip" : ""}`}>
              {sec.image && (
                <ScrollZoom className="sv__sec-img">
                  <Image src={sec.image} alt={sec.title} width={1200} height={800} sizes="(max-width: 900px) 100vw, 50vw" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </ScrollZoom>
              )}
              <Reveal className="sv__sec-copy">
                <h3 className="h3">{sec.title}</h3>
                <p className="muted">{sec.text}</p>
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {s.why && (
        <section className="section--tight light" aria-labelledby="sv-why">
          <div className="container">
            <div className="sv__why">
              <SplitText as="h2" text={s.whyTitle ?? "Warum uns wählen?"} className="h2" />
              <StaggerGroup className="sv__why-grid">
                {s.why.map((w) => (
                  <StaggerItem key={w} className="sv__why-item">
                    <Icon name="spark" size={22} />
                    <p>{w}</p>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>
          </div>
        </section>
      )}

      <FaqSection items={s.faq} intro={`Möchten Sie mehr über ${s.name} für Ihr Unternehmen erfahren? Stöbern Sie in unseren FAQs.`} id="service-faq" />

      <nav className="sv__pager container" aria-label="Weitere Leistungen">
        <Link href={`/marketing-solutions/${prev.slug}`} className="sv__pg">
          <small>← Vorherige Leistung</small>
          <strong>{prev.name}</strong>
        </Link>
        <Link href={`/marketing-solutions/${next.slug}`} className="sv__pg sv__pg--next">
          <small>Nächste Leistung →</small>
          <strong>{next.name}</strong>
        </Link>
      </nav>

      <CtaBand />

      <style>{`
        .sv__intro{display:grid;grid-template-columns:.85fr 1.15fr;gap:clamp(30px,6vw,100px);align-items:center}
        .sv__visual{position:relative}
        .sv__visual .ai__note{color:var(--ink-soft)}
        .sv__cover{border-radius:20px;overflow:hidden;box-shadow:0 40px 80px -50px rgba(1,41,45,.6)}
        .sv__cover img{width:100%;height:auto}
        .sv__bullets{list-style:none;margin:30px 0 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .sv__bullets li{display:flex;gap:10px;align-items:flex-start;padding:4px 0;font-weight:500;color:var(--deep)}
        .sv__bullets li svg{margin-top:3px}
        .sv__bullets svg{flex:none;color:var(--teal-ink)}
        .sv__feature{background:var(--deep);overflow:hidden;position:relative}
        .sv__feature-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(30px,5vw,80px);align-items:start}
        .sv__feature .lead{color:var(--on-dark-soft);margin-bottom:28px}
        .sv__gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:60px}
        .sv__g{border-radius:22px;overflow:hidden;box-shadow:0 40px 80px -30px rgba(0,0,0,.7)}
        .sv__g img{width:100%;height:auto}
        .sv__sections{display:grid;gap:clamp(60px,8vw,130px)}
        .sv__sec{display:grid;grid-template-columns:1fr 1fr;gap:clamp(30px,6vw,100px);align-items:center}
        .sv__sec.is-flip .sv__sec-img{order:2}
        .sv__sec--text{grid-template-columns:minmax(0,1fr);max-width:860px}
        .sv__sec-img{border-radius:var(--radius-l);aspect-ratio:3/2}
        .sv__sections--grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:48px 64px}
        .sv__sections--grid .sv__sec{display:block;max-width:none;padding-top:22px;border-top:2px solid var(--teal)}
        .sv__sec-copy .h3{color:var(--deep)}
        @media(max-width:800px){.sv__sections--grid{grid-template-columns:minmax(0,1fr)}}
        .sv__why{padding:clamp(30px,5vw,64px);border-radius:20px;background:#fff;border:1px solid var(--line-soft)}
        .sv__why-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:20px}
        .sv__why-item{display:flex;gap:14px;padding:20px;border-radius:12px;background:var(--paper)}
        .sv__why-item svg{flex:none;color:var(--teal-ink);margin-top:3px}
        .sv__why-item p{margin:0}
        .sv__pager{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding-bottom:40px;background:var(--mist)}
        .sv__pg{display:grid;gap:6px;padding:24px 28px;border-radius:14px;background:#fff;border:1px solid var(--line-soft);transition:border-color .2s}
        .sv__pg:hover{border-color:var(--teal)}
        .sv__pg small{opacity:.6}
        .sv__pg strong{font:700 clamp(18px,1.8vw,26px)/1.2 var(--font-display)}
        .sv__pg--next{text-align:right}
        @media(max-width:900px){.sv__intro,.sv__feature-grid,.sv__sec{grid-template-columns:minmax(0,1fr)}.sv__sec.is-flip .sv__sec-img{order:0}.sv__bullets{grid-template-columns:minmax(0,1fr)}}
      `}</style>
    </>
  );
}
