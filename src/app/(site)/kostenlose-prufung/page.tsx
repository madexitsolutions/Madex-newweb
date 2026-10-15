import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/sections/PageHero";
import { ContactForm } from "@/components/sections/ContactForm";
import { Reveal, SplitText, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { freeAnalysis } from "@/content/site";
import { staticSeo, withSeo } from "@/lib/seo";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/kostenlose-prufung", ...staticSeo["/kostenlose-prufung"] });

const checks = [
  { t: "Marketingziele überprüfen", d: "Überprüfen Sie zunächst Ihre Marketingziele und -vorgaben." },
  { t: "Zielpublikum bewerten", d: "Bewerten Sie Ihr Zielpublikum, um festzustellen, ob es sich verändert hat oder ob Sie Ihre Botschaften anpassen müssen." },
  { t: "Website analysieren", d: "Ist Ihre Website benutzerfreundlich, reagiert sie auf mobile Geräte und ist sie für Suchmaschinen optimiert?" },
  { t: "Content-Marketing prüfen", d: "Überprüfen Sie Ihre Content-Marketing-Bemühungen, einschliesslich der sozialen Medien und der Website." },
];

export default function FreeCheckPage() {
  return (
    <>
      <PageHero scene="check"
        eyebrow="Kostenlose Prüfung"
        title="Bereit zum Wachstum Ihres Unternehmens?"
        lead="Wenn Sie mit Madex IT Solutions zusammenarbeiten, nehmen wir Ihnen die Arbeit ab, damit Sie sich auf mehr Website-Traffic, Anfragen und Kunden konzentrieren können."
        crumbs={[{ name: "Kostenlose Prüfung", path: "/kostenlose-prufung" }]}
        compact
      />
      <section className="section light" aria-label="Analyse und Formular">
        <div className="container fp">
          <div>
            <p className="eyebrow">So gehen wir vor</p>
            <SplitText as="h2" text="Vier Fragen, die wir mit Ihnen klären." className="h2" />
            <StaggerGroup as="ol" className="fp__checks">
              {checks.map((c, i) => (
                <StaggerItem as="li" key={c.t} className="fp__check">
                  <span>{i + 1}</span>
                  <div>
                    <h3>{c.t}</h3>
                    <p>{c.d}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
            <Reveal className="fp__incl dark grain">
              <h3 className="h3">Website- & Marketing-Analyse inklusive</h3>
              <ul className="check-list">
                {freeAnalysis.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Image src="/media/2023/06/g3-1.webp" alt="" width={400} height={756} className="fp__phone" />
            </Reveal>
          </div>
          <Reveal className="fp__form">
            <h2 className="h3">Erhalten Sie Ihr kostenloses Angebot</h2>
            <p className="muted">Wir analysieren Ihre Ausgangslage und melden uns mit einem individuellen Vorschlag.</p>
            <ContactForm source="kostenlose-prufung" defaultService="Kostenlose Analyse" submitLabel="Senden Sie mir einen Vorschlag" showWebsite />
          </Reveal>
        </div>
        <style>{`
          .fp{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,5vw,80px);align-items:start}
          .fp__checks{list-style:none;margin:30px 0;padding:0;display:grid;gap:10px}
          .fp__check{display:flex;gap:18px;padding:22px;border-radius:20px;background:#fff}
          .fp__check>span{flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font:700 17px/1 var(--font-display);color:#fff;background:linear-gradient(135deg,var(--teal),var(--petrol))}
          .fp__check h3{font-size:19px;margin:6px 0}
          .fp__check p{margin:0;color:var(--text-soft);font-size:15px}
          .fp__incl{position:relative;overflow:hidden;padding:36px;border-radius:var(--radius-l);background:linear-gradient(150deg,var(--petrol),var(--night))}
          .fp__incl .check-list{max-width:60%}
          .fp__phone{position:absolute;right:-20px;bottom:-60px;width:180px;height:auto;transform:rotate(-8deg);filter:drop-shadow(0 30px 40px rgba(0,0,0,.5))}
          .fp__form{position:sticky;top:110px;padding:clamp(26px,4vw,52px);border-radius:var(--radius-l);background:#fff;box-shadow:0 50px 100px -60px rgba(1,41,45,.6)}
          @media(max-width:1000px){.fp{grid-template-columns:minmax(0,1fr)}.fp__form{position:static}.fp__incl .check-list{max-width:none}.fp__phone{display:none}}
        `}</style>
      </section>
    </>
  );
}
