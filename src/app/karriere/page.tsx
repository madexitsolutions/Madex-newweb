import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/sections/PageHero";
import { CtaBand } from "@/components/sections/CtaBand";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Reveal, ScrollZoom, SplitText } from "@/components/ui/motion";
import { site } from "@/content/site";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Karriere",
  description: "Offene Stellen bei Madex IT Solutions in Neuhausen am Rheinfall. Werden Sie Teil eines dynamischen und zukunftsorientierten Teams.",
  path: "/karriere",
});

const jobs = [{ title: "Outbound Call Agent – Terminierung", type: "Vollzeit", location: "Neuhausen am Rheinfall" }];

export default function CareerPage() {
  return (
    <>
      <PageHero
        eyebrow="Karriere"
        title="Treten Sie unserem Team von Revolutionären bei."
        lead="Kommen Sie zu uns und werden Sie die Expertin oder der Experte, auf die sich Unternehmen verlassen, um ihre digitalen Herausforderungen zu lösen."
        crumbs={[
          { name: "Wer wir sind", path: "/uber-uns" },
          { name: "Karriere", path: "/karriere" },
        ]}
      >
        <Button href="#offene-stellen">Offene Stellen anzeigen</Button>
      </PageHero>

      <section id="offene-stellen" className="section light" aria-labelledby="jobs-title">
        <div className="container">
          <p className="eyebrow">Offene Stellen</p>
          <SplitText as="h2" text="Offene Stellen" className="h2" />
          <Reveal>
            <p className="lead muted">
              Lassen Sie sich die Gelegenheit nicht entgehen, in einem dynamischen und zukunftsorientierten Team mitzuarbeiten. Schreiben Sie uns eine E-Mail an <a href={`mailto:${site.contact.email}`} className="accent">{site.contact.email}</a> und
              lassen Sie uns darüber sprechen, wie Ihre Talente mit unseren spannenden Möglichkeiten in Einklang gebracht werden können.
            </p>
          </Reveal>
          <ul className="jobs">
            {jobs.map((j, i) => (
              <Reveal as="li" key={j.title} delay={i * 0.1}>
                <a className="job" href={`mailto:${site.contact.email}?subject=${encodeURIComponent("Bewerbung: " + j.title)}`} data-cursor="Bewerben">
                  <span className="job__title">{j.title}</span>
                  <span className="chip">{j.type}</span>
                  <span className="job__loc">
                    <Icon name="pin" size={16} /> {j.location}
                  </span>
                  <span className="job__cta">
                    Jetzt bewerben <Icon name="arrow-up-right" size={18} />
                  </span>
                </a>
              </Reveal>
            ))}
          </ul>
          <p className="muted jobs__hint">Lebenslauf und Portfolio (fakultativ) bitte per E-Mail mitsenden.</p>
        </div>
        <style>{`
          .jobs{list-style:none;margin:40px 0 16px;padding:0;display:grid;gap:12px}
          .job{display:grid;grid-template-columns:1fr auto auto auto;gap:24px;align-items:center;padding:30px 34px;border-radius:var(--radius-m);background:#fff;transition:background .5s,color .5s,transform .5s var(--ease-out)}
          .job:hover{background:var(--petrol);color:#fff;transform:translateX(10px)}
          .job__title{font:700 clamp(20px,2vw,28px)/1.2 var(--font-display)}
          .job__loc{display:flex;gap:6px;align-items:center;opacity:.7}
          .job__cta{display:flex;gap:8px;align-items:center;font-weight:500;color:var(--teal)}
          .job:hover .job__cta{color:var(--teal-glow)}
          .jobs__hint{font-size:14px}
          @media(max-width:800px){.job{grid-template-columns:minmax(0,1fr);gap:10px}}
        `}</style>
      </section>

      <section className="section white" aria-labelledby="life-title">
        <div className="container grid-2">
          <ScrollZoom className="life__img">
            <Image src="/media/2024/07/1d.webp" alt="Teamarbeit bei Madex IT Solutions" width={1400} height={968} sizes="(max-width: 900px) 100vw, 50vw" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </ScrollZoom>
          <div>
            <p className="eyebrow">Kultur</p>
            <SplitText as="h2" text="Das Leben bei Madex" className="h2" />
            <Reveal>
              <p className="muted">
                Wir sind mehr als nur eine Agentur. Wir verkörpern Intensität, freuen uns über rasante Herausforderungen und fördern ein teamorientiertes Umfeld. Wir engagieren uns für Ihr Wachstum, Ihr Lernen und den
                Aufbau von Fachwissen, weil wir glauben, dass Ihr Erfolg direkt zu unserem Erfolg beiträgt.
              </p>
              <p className="muted">
                Bei Madex werden Sie eine lebendige Kultur der Möglichkeiten entdecken, in der starke Zusammenarbeit und Mentorenschaft einen Weg zur Weiterentwicklung schaffen – ohne dass der Spass dabei zu kurz kommt.
              </p>
              <Button href="/das-team" variant="ghost">
                Treffen Sie unser Team
              </Button>
            </Reveal>
          </div>
        </div>
        <style>{`.life__img{aspect-ratio:4/3;border-radius:var(--radius-l)}`}</style>
      </section>

      <CtaBand title="Werden Sie Teil unseres Teams" text={`Senden Sie Ihre Bewerbung an ${site.contact.email}.`} href={`mailto:${site.contact.email}`} cta="Bewerbung senden" />
    </>
  );
}
