import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/sections/PageHero";
import { TeamCard } from "@/components/sections/TeamCard";
import { CtaBand } from "@/components/sections/CtaBand";
import { Button } from "@/components/ui/Button";
import { Parallax, Reveal, ScrollZoom, SplitText, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { clientSupport, leadership, teamGroups } from "@/content/site";
import { staticSeo, withSeo } from "@/lib/seo";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/das-team", ...staticSeo["/das-team"] });

const beliefs = ["Skalierung", "Verbreitung", "Verbesserung", "Integrität"];

export default function TeamPage() {
  return (
    <>
      <PageHero scene="team"
        eyebrow="Das Team"
        title="Treffen Sie die Umsatzrevolutionäre von Madex IT Solutions."
        lead="Wir glauben an ein talentiertes Team, das für unsere Kunden die besten Ergebnisse erzielen will."
        crumbs={[
          { name: "Wer wir sind", path: "/uber-uns" },
          { name: "Das Team", path: "/das-team" },
        ]}
      />

      <section className="section light" aria-labelledby="tm-believe">
        <div className="container grid-2">
          <ScrollZoom className="tm__img">
            <Image src="/media/2024/07/graphicdesign-madex.webp" alt="Grafikdesign-Team von Madex IT Solutions bei der Arbeit" width={1600} height={1000} sizes="(max-width: 900px) 100vw, 50vw" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </ScrollZoom>
          <div>
            <p className="eyebrow">Woran wir glauben</p>
            <SplitText as="h2" text="Wir glauben daran, Ihr Unternehmen durch Marketing an die Spitze zu bringen." className="h2" />
            <Reveal>
              <p className="muted">
                Wir erreichen dies durch die Skalierung wirkungsvoller Unternehmen. Unser Schwerpunkt liegt auf der Förderung der Marken unserer Kunden und der wirksamen Verbreitung ihrer Botschaft. Wir geben uns nicht
                mit dem Status quo zufrieden und streben ständig danach, unser eigenes Geschäft mit demselben Mass an Ehrlichkeit und Integrität auszubauen, mit dem wir die Unternehmen unserer Kunden fördern.
              </p>
            </Reveal>
            <StaggerGroup className="tm__beliefs">
              {beliefs.map((b) => (
                <StaggerItem key={b} className="tm__belief">
                  {b}
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </div>
      </section>

      <section className="section white" aria-labelledby="tm-lead">
        <div className="container">
          <p className="eyebrow">Geschäftsleitung & Lead</p>
          <SplitText as="h2" text="Das Team" className="h2" />
          <StaggerGroup className="tm__grid tm__grid--3">
            {leadership.map((m, i) => (
              <StaggerItem key={m.name}>
                <TeamCard {...m} priority={i === 0} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="section dark" aria-labelledby="tm-ceo">
        <div className="container grid-2">
          <div>
            <p className="eyebrow">Ein Wort vom Geschäftsführer</p>
            <Reveal>
              <blockquote className="tm__quote">
                In unserem Unternehmen sind wir darauf spezialisiert, nachhaltigen Erfolg für Ihr Geschäft zu erzielen. Wir glauben daran, dass wir durch ausgeklügelte Marketingstrategien und Innovation Ihre Marke auf ein
                neues Niveau heben können. Ihr Erfolg ist unsere Priorität, und wir arbeiten täglich mit Ehrlichkeit und Integrität.
              </blockquote>
              <p className="tm__sig">
                <strong>Marco Bräm</strong>
                <span>Geschäftsführer von Madex IT Solutions</span>
              </p>
            </Reveal>
          </div>
          <Parallax speed={0.08} className="tm__ceo">
            <Image src="/media/2024/07/Bram-Marco-0486.webp" alt="Marco Bräm, Geschäftsführer" width={1600} height={1067} sizes="(max-width: 900px) 100vw, 50vw" />
          </Parallax>
        </div>
      </section>

      <section className="section light" aria-labelledby="tm-support">
        <div className="container">
          <p className="eyebrow">Client Support</p>
          <SplitText as="h2" text="Ihre persönlichen Ansprechpartner" className="h2" />
          <StaggerGroup className="tm__grid tm__grid--3">
            {clientSupport.map((m) => (
              <StaggerItem key={m.name}>
                <TeamCard {...m} />
              </StaggerItem>
            ))}
          </StaggerGroup>

          {teamGroups.map((g) => (
            <div key={g.title} className="tm__group">
              <h2 className="h3 tm__group-h">{g.title}</h2>
              <StaggerGroup className={`tm__grid tm__grid--${g.members.length}`}>
                {g.members.map((m, i) => (
                  <StaggerItem key={m.image + i}>
                    <TeamCard role={m.role} image={m.image} />
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>
          ))}
        </div>
      </section>

      <section className="section white" aria-labelledby="tm-mission">
        <div className="container grid-2">
          <div className="tm__duo">
            <Parallax speed={0.1} className="tm__duo-a">
              <Image src="/media/2024/07/1d.webp" alt="Team-Meeting bei Madex IT Solutions" width={1400} height={968} sizes="(max-width: 900px) 80vw, 35vw" />
            </Parallax>
            <Parallax speed={-0.1} className="tm__duo-b">
              <Image src="/media/2024/07/3d.webp" alt="Arbeitsplatz bei Madex IT Solutions" width={1400} height={968} sizes="(max-width: 900px) 60vw, 25vw" />
            </Parallax>
          </div>
          <div>
            <p className="eyebrow">Unser Auftrag</p>
            <SplitText as="h2" text="Ihr Erfolg ist unser Ziel." className="h2" />
            <Reveal>
              <p className="muted">
                Wir bei Madex IT Solutions sind bestrebt, durch fortschrittliche Marketingstrategien und Innovationen den Erfolg Ihres Unternehmens zu sichern. Unsere Mission ist es, Ihre Marke zu stärken, Ihre Botschaft zu
                verbreiten und aussergewöhnliche Ergebnisse mit Ehrlichkeit und Integrität zu erzielen. Wir geben uns nicht mit dem Status quo zufrieden, sondern streben stets danach, uns selbst und unsere Kunden zu
                verbessern.
              </p>
              <Button href="/kontakt">Partner mit Experten</Button>
            </Reveal>
            <Reveal className="tm__career" delay={0.15}>
              <h3 className="h3">Erkunden Sie noch heute die Möglichkeiten bei uns</h3>
              <p className="muted">
                Wenn Sie bei Madex IT Solutions arbeiten, gehören Sie zu unserer grossen Familie. Uns ist nicht nur der Erfolg unserer Teammitglieder wichtig, sondern auch ihr Wohlbefinden und das ihrer Familien.
              </p>
              <Button href="/karriere" variant="ghost">
                Werden Sie Mitglied unseres Teams
              </Button>
            </Reveal>
          </div>
        </div>
      </section>

      <CtaBand />

      <style>{`
        .tm__img{aspect-ratio:16/10;border-radius:var(--radius-l)}
        .tm__beliefs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:24px}
        .tm__belief{position:relative;padding:18px 20px 18px 44px;border-radius:16px;background:#fff;font:700 18px/1 var(--font-display)}
        .tm__belief::before{content:"";position:absolute;left:20px;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:3px;background:var(--teal)}
        .tm__grid{display:grid;gap:18px;margin-top:36px}
        .tm__grid--3{grid-template-columns:repeat(3,1fr)}
        .tm__grid--4{grid-template-columns:repeat(4,1fr)}
        .tm__group{margin-top:clamp(60px,7vw,100px)}
        .tm__group-h{padding-bottom:16px;border-bottom:1px solid var(--line)}
        .tm__quote{margin:0 0 28px;font:500 clamp(20px,2vw,28px)/1.45 var(--font-display);letter-spacing:-.01em}
        .tm__quote::before{content:"“";display:block;font-size:120px;line-height:.6;color:var(--teal);height:50px}
        .tm__sig{display:grid}
        .tm__sig span{color:var(--teal-glow)}
        .tm__ceo{border-radius:var(--radius-l);overflow:hidden}
        .tm__ceo img{width:100%;height:auto}
        .tm__duo{position:relative;min-height:520px}
        .tm__duo-a{position:absolute;left:0;top:0;width:80%;border-radius:var(--radius-l);overflow:hidden}
        .tm__duo-b{position:absolute;right:0;bottom:0;width:58%;border-radius:var(--radius-m);overflow:hidden;border:8px solid #fff}
        .tm__duo img{width:100%;height:auto}
        .tm__career{margin-top:40px;padding:30px;border-radius:var(--radius-m);background:var(--mist)}
        @media(max-width:1000px){.tm__grid--4{grid-template-columns:repeat(2,1fr)}.tm__grid--3{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:520px){.tm__grid--3,.tm__grid--4{grid-template-columns:minmax(0,1fr)}.tm__duo{min-height:360px}}
      `}</style>
    </>
  );
}
