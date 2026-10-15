import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { ContactForm } from "@/components/sections/ContactForm";
import { Icon } from "@/components/ui/Icon";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { freeAnalysis, site } from "@/content/site";
import { staticSeo, withSeo } from "@/lib/seo";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/kostenlose-prufung", ...staticSeo["/kostenlose-prufung"] });

const checks = [
  { t: "Marketingziele überprüfen", d: "Überprüfen Sie zunächst Ihre Marketingziele und -vorgaben." },
  { t: "Zielpublikum bewerten", d: "Bewerten Sie Ihr Zielpublikum, um festzustellen, ob es sich verändert hat oder ob Sie Ihre Botschaften anpassen müssen." },
  { t: "Website analysieren", d: "Ist Ihre Website benutzerfreundlich, reagiert sie auf mobile Geräte und ist sie für Suchmaschinen optimiert?" },
  { t: "Content-Marketing prüfen", d: "Überprüfen Sie Ihre Content-Marketing-Bemühungen, einschliesslich der sozialen Medien und der Website." },
];

export default function FreeCheckPage() {
  const c = site.contact;
  return (
    <>
      <PageHero
        scene="check"
        eyebrow="Kostenlose Prüfung"
        title="Bereit zum Wachstum Ihres Unternehmens?"
        lead="Wenn Sie mit Madex IT Solutions zusammenarbeiten, nehmen wir Ihnen die Arbeit ab, damit Sie sich auf mehr Website-Traffic, Anfragen und Kunden konzentrieren können."
        crumbs={[{ name: "Kostenlose Prüfung", path: "/kostenlose-prufung" }]}
        compact
      />
      <section className="section light fp-sec" aria-label="Analyse und Formular">
        <div className="container fp">
          <Reveal className="fp__incl" y={24}>
            <h2 className="fp__incl-h">Website- & Marketing-Analyse inklusive</h2>
            <p className="fp__incl-lead">Kostenlos und unverbindlich. Sie erhalten eine ehrliche Einschätzung, wo Ihr Auftritt heute steht.</p>
            <ul className="fp__incl-list">
              {freeAnalysis.map((f) => (
                <li key={f}>
                  <Icon name="check" size={18} strokeWidth={2.4} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="fp__form" id="formular">
            <h2 className="fp__form-h">Erhalten Sie Ihr kostenloses Angebot</h2>
            <p className="fp__form-lead">Wir analysieren Ihre Ausgangslage und melden uns mit einem individuellen Vorschlag.</p>
            <ContactForm source="kostenlose-prufung" defaultService="Kostenlose Analyse" submitLabel="Senden Sie mir einen Vorschlag" showWebsite />
          </div>

          <div className="fp__how">
            <h2 className="fp__how-h">Vier Fragen, die wir mit Ihnen klären</h2>
            <StaggerGroup as="ol" className="fp__checks">
              {checks.map((ch, i) => (
                <StaggerItem as="li" key={ch.t} className="fp__check">
                  <span className="fp__n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <h3>{ch.t}</h3>
                    <p>{ch.d}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
            <p className="fp__direct">
              Lieber direkt sprechen? <a href={c.phonePrimary.href}>{c.phonePrimary.label}</a> oder <a href={`mailto:${c.email}`}>{c.email}</a>
            </p>
          </div>
        </div>
        <style>{`
          .fp{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);grid-template-areas:"incl form" "how form";grid-template-rows:auto 1fr;gap:clamp(28px,3.5vw,48px) clamp(28px,4vw,64px);align-items:start}
          .fp__incl{grid-area:incl;padding:clamp(26px,3vw,40px);border-radius:var(--radius-m);background:var(--deep);color:var(--on-dark)}
          .fp__incl-h{margin:0 0 10px;font-size:clamp(23px,2vw,30px);line-height:1.12;letter-spacing:-.02em;color:#fff;text-wrap:balance}
          .fp__incl-lead{margin:0 0 22px;max-width:46ch;font-size:15.5px;line-height:1.6;color:var(--on-dark-soft)}
          .fp__incl-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 24px}
          .fp__incl-list li{display:flex;gap:10px;align-items:flex-start;font-size:15.5px;line-height:1.45;font-weight:500}
          .fp__incl-list svg{flex:none;margin-top:2px;color:var(--teal-glow)}
          .fp__form{grid-area:form;padding:clamp(22px,3.6vw,48px);border-radius:var(--radius-m);background:#fff;border:1px solid var(--line-soft);box-shadow:0 40px 80px -60px rgba(1,41,45,.45);scroll-margin-top:calc(var(--header-h) + 16px)}
          .fp__form-h{margin:0 0 10px;font-size:clamp(24px,2.1vw,32px);line-height:1.12;letter-spacing:-.02em;color:var(--deep);text-wrap:balance}
          .fp__form-lead{margin:0 0 28px;max-width:60ch;color:var(--ink-soft);line-height:1.6}
          .fp__how{grid-area:how;padding-top:8px}
          .fp__how-h{margin:0 0 8px;font-size:clamp(22px,1.9vw,28px);line-height:1.15;letter-spacing:-.02em;color:var(--deep);text-wrap:balance}
          .fp__checks{list-style:none;margin:0;padding:0;display:grid}
          .fp__check{display:grid;grid-template-columns:36px minmax(0,1fr);gap:16px;padding:20px 0;border-bottom:1px solid var(--line)}
          .fp__n{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font:700 15px/1 var(--font-display);color:var(--teal-ink);background:var(--mint);font-variant-numeric:tabular-nums}
          .fp__check h3{margin:6px 0 6px;font-size:18px;line-height:1.3;letter-spacing:-.01em;color:var(--deep)}
          .fp__check p{margin:0;max-width:56ch;color:var(--ink-soft);font-size:15.5px;line-height:1.6}
          .fp__direct{margin:22px 0 0;font-size:15px;color:var(--ink-soft)}
          .fp__direct a{color:var(--teal-ink);font-weight:600;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}
          @media(max-width:1000px){
            .fp{grid-template-columns:minmax(0,1fr);grid-template-areas:"incl" "form" "how";grid-template-rows:none}
          }
          @media(max-width:520px){
            .fp-sec{padding-top:36px}
            .fp{padding-inline:12px}
            .fp__incl,.fp__form{border-radius:var(--radius-s)}
            .fp__form{padding:22px 18px}
            .fp__incl{padding:24px 20px}
            .fp__incl-list{grid-template-columns:minmax(0,1fr)}
          }
        `}</style>
      </section>
    </>
  );
}
