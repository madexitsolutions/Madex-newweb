import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/sections/PageHero";
import { Testimonials } from "@/components/sections/Testimonials";
import { TeamCard } from "@/components/sections/TeamCard";
import { CtaBand } from "@/components/sections/CtaBand";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Marquee, Parallax, Reveal, ScrollZoom, SplitText, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { leadership, site } from "@/content/site";
import { staticSeo, withSeo } from "@/lib/seo";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/uber-uns", ...staticSeo["/uber-uns"] });

const ethos = [
  { title: "Innovativ", text: "Durch den Einsatz quantifizierbarer Analysen zur Unterstützung von Ideen und die ständige Weiterentwicklung und Anpassung an die sich verändernde digitale Umgebung sind wir bestrebt, dem Spiel immer einen Schritt voraus zu sein.", icon: "spark" as const },
  { title: "Hör mal zu!", text: "Wir spielen gerne Tischtennis, aber keine Ratespiele. Um sicherzustellen, dass alle an einem Strang ziehen, hören wir zu und richten uns mit transparenter Kommunikation auf Ihre Ziele aus.", icon: "chat" as const },
  { title: "Streben", text: "Ohne Denken kann es keine Veränderung geben. Indem wir dies auf unsere Ideen, Konzepte und Strategien anwenden, streben wir nach dem Besten, hinterfragen bestehende Ideologien und ermöglichen Veränderungen.", icon: "digital" as const },
  { title: "Zusammenarbeit", text: "Uns geht es darum, etwas zu bewirken, und das erreichen wir nur gemeinsam. Unsere Prinzipien sind das Aufbrechen von Silos, das Teilen von Wissen und die Förderung von fachübergreifender Arbeit.", icon: "social" as const },
];

const platforms = [
  { src: "/media/2023/05/google-partner.svg", alt: "Google Partner" },
  { src: "/media/2023/05/google-cloud.svg", alt: "Google Cloud" },
  { src: "/media/2023/05/meta-partner.svg", alt: "Meta Business Partner" },
  { src: "/media/2024/04/wordpress.webp", alt: "WordPress" },
  { src: "/media/2024/04/elementor.webp", alt: "Elementor" },
];

export default function AboutPage() {
  return (
    <>
      <PageHero scene="about" eyebrow="Über uns" title="Erfahrung ist wichtig. In jedem Aspekt des Lebens." lead="Gemeinsam entwickeln wir Ideen und lassen Dinge geschehen." crumbs={[{ name: "Über uns", path: "/uber-uns" }]}>
        <Button href="/das-team">Das Team kennenlernen</Button>
      </PageHero>

      <section className="section light" aria-labelledby="ab-mission">
        <div className="container grid-2">
          <div>
            <p className="eyebrow">Unsere Mission</p>
            <SplitText as="h2" text="Eine bessere digitale Welt – und glückliche Kunden." className="h2" />
            <Reveal>
              <p className="lead muted">
                Unsere Mission ist es, eine bessere digitale Welt zu schaffen und unsere Kunden glücklich zu machen. Wir verfügen über eine gewinnbringende Kombination aus kreativen, technischen und menschlichen
                Fähigkeiten, mit denen es nicht nur Spass macht, mit uns zu arbeiten, sondern die auch sicherstellen, dass wir unsere Arbeit gut erledigen.
              </p>
              <p className="ab__tag">
                <span className="text-gradient">„{site.tagline}“</span>
              </p>
            </Reveal>
          </div>
          <div className="ab__photos">
            <Parallax speed={0.1} className="ab__p1">
              <Image src="/media/2024/07/Bram-Marco-0458-1024x683-1.webp" alt="Marco Bräm, CEO von Madex IT Solutions" width={1024} height={683} sizes="(max-width: 900px) 90vw, 40vw" />
            </Parallax>
            <Parallax speed={-0.12} className="ab__p2">
              <Image src="/media/brand/business-cover.webp" alt="Das Team von Madex IT Solutions im Studio" width={2000} height={834} sizes="(max-width: 900px) 70vw, 30vw" />
            </Parallax>
          </div>
        </div>
        <style>{`
          .ab__tag{font:700 clamp(22px,2.2vw,32px)/1.2 var(--font-display);margin-top:24px}
          .ab__tag .text-gradient{background:linear-gradient(100deg,var(--petrol),var(--teal));-webkit-background-clip:text;background-clip:text}
          .ab__photos{position:relative;min-height:520px}
          .ab__p1{position:absolute;left:0;top:0;width:78%;border-radius:var(--radius-l);overflow:hidden;box-shadow:0 40px 80px -40px rgba(1,41,45,.6)}
          .ab__p2{position:absolute;right:0;bottom:0;width:62%;border-radius:var(--radius-m);overflow:hidden;border:8px solid var(--mist);box-shadow:0 40px 80px -40px rgba(1,41,45,.6)}
          .ab__photos img{width:100%;height:auto;display:block}
        `}</style>
      </section>

      <section className="section dark-ink" aria-labelledby="ab-ethos">
        <div className="container">
          <p className="eyebrow">Werte</p>
          <SplitText as="h2" text="Unser Ethos" className="h2" />
          <StaggerGroup className="ab__ethos">
            {ethos.map((e, i) => (
              <StaggerItem key={e.title} as="article" className="ab__e glass">
                <span className="ab__e-n">0{i + 1}</span>
                <span className="ab__e-icon">
                  <Icon name={e.icon} size={26} />
                </span>
                <h3>{e.title}</h3>
                <p>{e.text}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
        <style>{`
          .ab__ethos{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:40px}
          .ab__e{padding:30px 26px;transition:transform .6s var(--ease-out),background .5s}
          .ab__e:hover{transform:translateY(-10px);background:rgba(2,141,134,.18)}
          .ab__e-n{position:absolute;right:22px;top:20px;font:800 40px/1 var(--font-display);color:transparent;-webkit-text-stroke:1px rgba(79,224,210,.4)}
          .ab__e-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:18px;background:var(--teal);margin-bottom:22px}
          .ab__e h3{font-size:22px}
          .ab__e p{margin:0;color:var(--on-dark-soft);font-size:15.5px}
          @media(max-width:1000px){.ab__ethos{grid-template-columns:1fr 1fr}}
          @media(max-width:600px){.ab__ethos{grid-template-columns:minmax(0,1fr)}}
        `}</style>
      </section>

      <section className="section white" aria-labelledby="ab-smile">
        <div className="container grid-2">
          <ScrollZoom className="ab__wide">
            <Image src="/media/brand/brand-team-banner.webp" alt="Studio von Madex IT Solutions" width={2000} height={631} sizes="(max-width: 900px) 100vw, 50vw" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </ScrollZoom>
          <div>
            <p className="eyebrow">Anbieter von Marketinglösungen</p>
            <SplitText as="h2" text="Lächeln." className="display" />
            <Reveal>
              <p className="lead muted">Wir glauben fest daran, das zu tun, was wir lieben, und dabei Spass zu haben. Unser Erfolg hängt von der Zufriedenheit unserer Kunden ab.</p>
              <Button href="/marketing-solutions">Marketing Solutions</Button>
            </Reveal>
          </div>
        </div>
        <style>{`.ab__wide{aspect-ratio:4/3;border-radius:var(--radius-l)}`}</style>
      </section>

      <section className="section light" aria-labelledby="ab-team">
        <div className="container">
          <div className="ab__team-head">
            <div>
              <p className="eyebrow">Team</p>
              <SplitText as="h2" text="Treffen Sie das Team von Madex IT Solutions" className="h2" />
            </div>
            <Button href="/das-team" variant="ghost">
              Alle ansehen
            </Button>
          </div>
          <StaggerGroup className="ab__team">
            {leadership.map((m) => (
              <StaggerItem key={m.name}>
                <TeamCard {...m} />
              </StaggerItem>
            ))}
          </StaggerGroup>
          <div className="ab__claims">
            <Reveal className="ab__claim">
              <h3 className="h3">Wir treiben positive Veränderungen voran</h3>
              <p className="muted">
                Mit mehr als 3 Jahren Erfahrung bieten wir Weblösungen, die unseren Kunden ein erstklassiges Erlebnis ermöglichen. Wir lassen uns von der Idee leiten, dass die beste Arbeit aus Fleiss, Hingabe und Spass
                entsteht.
              </p>
            </Reveal>
            <Reveal className="ab__claim" delay={0.1}>
              <h3 className="h3">Wir sind gemeinsam rational</h3>
              <p className="muted">
                Es gibt kein Madex ohne das Team. Unser Team besteht aus leidenschaftlichen digitalen Profis, die mit Freude erstklassige Arbeit produzieren – und darauf sind wir stolz.
              </p>
            </Reveal>
          </div>
        </div>
        <style>{`
          .ab__team-head{display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap;margin-bottom:40px}
          .ab__team{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
          .ab__claims{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:60px}
          .ab__claim{padding:36px;border-radius:var(--radius-m);background:#fff}
          @media(max-width:900px){.ab__team{grid-template-columns:1fr 1fr}.ab__claims{grid-template-columns:minmax(0,1fr)}}
          @media(max-width:520px){.ab__team{grid-template-columns:minmax(0,1fr)}}
        `}</style>
      </section>

      <section className="section--tight white" aria-label="Plattformen und Technologien">
        <div className="container">
          <p className="eyebrow">Plattformen & Technologien</p>
        </div>
        <Marquee speed={30}>
          {platforms.map((p) => (
            <span key={p.alt} className="ab__pl">
              <Image src={p.src} alt={p.alt} width={180} height={60} />
            </span>
          ))}
        </Marquee>
        <style>{`.ab__pl{display:grid;place-items:center;width:240px;height:110px;margin:0 14px;border-radius:20px;background:var(--mist)}.ab__pl img{max-width:150px;max-height:54px;width:auto;height:auto;object-fit:contain}`}</style>
      </section>

      <Testimonials />
      <CtaBand />
    </>
  );
}
