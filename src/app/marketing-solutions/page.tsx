import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/sections/PageHero";
import { ServicesConstellation } from "@/components/sections/ServicesConstellation";
import { CtaBand } from "@/components/sections/CtaBand";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Reveal, ScrollZoom, SplitText, StaggerGroup, StaggerItem, Tilt } from "@/components/ui/motion";
import { Link } from "@/components/layout/Transition";
import { services } from "@/content/services";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Marketinglösungen in Schaffhausen",
  description: "Acht Marketinglösungen aus einer Hand: Webdesign, Digital Marketing, SEO, Photo & Werbevideos, Social Media, Google Marketing, Graphic Design sowie Analyse und Planung.",
  path: "/marketing-solutions",
});

export default function MarketingSolutionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Marketing Lösungen"
        title="Wir führen mit kundenorientierten Strategien."
        lead="Wachstum durch personalisierte Erlebnisse für eine echte End-to-End-Geschäftsentwicklung."
        crumbs={[{ name: "Marketing Lösungen", path: "/marketing-solutions" }]}
      >
        <Button href="/kostenlose-prufung">Kostenlose Beratung anfragen</Button>
      </PageHero>

      <section className="section light" aria-labelledby="ms-grid">
        <div className="container">
          <h2 id="ms-grid" className="sr-only">
            Alle Leistungen
          </h2>
          <StaggerGroup className="msg" gap={0.07}>
            {services.map((s, i) => (
              <StaggerItem key={s.slug} as="article">
                <Tilt max={7} className="msg__tilt">
                  <Link href={`/marketing-solutions/${s.slug}`} className="msg__card" data-cursor="Mehr">
                    <span className="msg__n">{String(i + 1).padStart(2, "0")}</span>
                    <span className="msg__img">
                      <Image src={s.image} alt="" width={300} height={300} />
                    </span>
                    <span className="msg__icon">
                      <Icon name={s.icon} size={24} />
                    </span>
                    <h3>{s.name}</h3>
                    <p>{s.short}</p>
                    <span className="link-arrow">
                      Mehr erfahren <Icon name="arrow" size={16} />
                    </span>
                  </Link>
                </Tilt>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
        <style>{`
          .msg{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
          .msg__tilt{height:100%}
          .msg__card{position:relative;display:flex;flex-direction:column;gap:10px;height:100%;padding:28px;border-radius:var(--radius-m);background:#fff;overflow:hidden;
            border:1px solid rgba(2,81,89,.08);transition:background .6s var(--ease-out),color .6s}
          .msg__card:hover{background:var(--petrol);color:#fff}
          .msg__n{font:700 13px/1 var(--font-body);color:var(--teal);letter-spacing:.12em}
          .msg__img{position:absolute;right:-30px;top:-30px;width:150px;height:150px;border-radius:50%;overflow:hidden;opacity:0;transform:scale(.6);transition:.7s var(--ease-out)}
          .msg__img img{width:100%;height:100%;object-fit:cover}
          .msg__card:hover .msg__img{opacity:.9;transform:scale(1)}
          .msg__icon{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--teal),var(--petrol));margin:26px 0 10px}
          .msg__card h3{font-size:21px;margin:0}
          .msg__card p{margin:0;font-size:15px;opacity:.75;flex:1}
          .msg__card:hover .link-arrow{color:var(--teal-glow)}
          @media(max-width:1100px){.msg{grid-template-columns:repeat(2,1fr)}}
          @media(max-width:600px){.msg{grid-template-columns:minmax(0,1fr)}}
        `}</style>
      </section>

      <ServicesConstellation title="Ein Netzwerk. Acht Disziplinen." eyebrow="Alles aus einer Hand" />

      <section className="section white" aria-labelledby="ms-strategy">
        <div className="container grid-2">
          <ScrollZoom className="ms__img">
            <Image src="/media/2024/07/2d.webp" alt="Team von Madex IT Solutions bei der Strategiearbeit" width={1400} height={968} sizes="(max-width: 900px) 100vw, 50vw" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </ScrollZoom>
          <div>
            <p className="eyebrow">Strategie</p>
            <SplitText as="h2" text="Wir engagieren uns für Ihre Strategie" className="h2" />
            <Reveal>
              <p className="lead muted">
                Wir engagieren uns für Ihre Strategie und verstehen intuitiv, wie man in der digitalen Wirtschaft Werte schafft. Mit den effektivsten digitalen Marketingoptionen sorgt Madex IT Solutions dafür, dass dies
                nahtlos gelingt.
              </p>
              <p className="muted">
                Jeden Tag helfen wir Marken, gross zu denken, intelligent zu handeln und Wachstum zu erzielen. Wir setzen eine intelligente digitale Marketingstrategie ein, um in einer sich rasant entwickelnden Welt
                konsequent Werte aus digitalen Investitionen zu schöpfen. Von einfach bis unendlich komplex.
              </p>
              <Button href="/uber-uns" variant="ghost">
                Mehr über unser Unternehmen
              </Button>
            </Reveal>
          </div>
        </div>
        <style>{`.ms__img{border-radius:var(--radius-l);aspect-ratio:4/3}`}</style>
      </section>

      <CtaBand />
    </>
  );
}
