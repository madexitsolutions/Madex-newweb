import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { ContactForm } from "@/components/sections/ContactForm";
import { Icon } from "@/components/ui/Icon";
import { Reveal, StaggerGroup, StaggerItem, Tilt } from "@/components/ui/motion";
import { site } from "@/content/site";
import { staticSeo, withSeo } from "@/lib/seo";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/kontakt", ...staticSeo["/kontakt"] });

export default function ContactPage() {
  const c = site.contact;
  const cards = [
    { icon: "phone" as const, label: "Telefon", lines: [c.phonePrimary, c.phoneSecondary] },
    { icon: "mail" as const, label: "E-Mail", lines: [{ label: c.email, href: `mailto:${c.email}` }] },
    { icon: "pin" as const, label: "Adresse", lines: [{ label: `${c.street}, ${c.postalCode} ${c.locality}`, href: c.mapUrl }] },
  ];
  return (
    <>
      <PageHero scene="contact"
        eyebrow="Kontakt"
        title="Wir sind hier, um Ihnen beim Wachstum zu helfen."
        lead="Sie können uns gerne über Ihre bevorzugte Kontaktmethode erreichen. Wir freuen uns darauf, herauszufinden, wie unser Team für digitales Marketing zu Ihrem Erfolg beitragen kann."
        crumbs={[{ name: "Kontakt", path: "/kontakt" }]}
        compact
      />
      <section className="section light" aria-label="Kontaktdaten und Formular">
        <div className="container kt">
          <div className="kt__side">
            <StaggerGroup className="kt__cards">
              {cards.map((card) => (
                <StaggerItem key={card.label}>
                  <Tilt max={6}>
                    <div className="kt__card">
                      <span className="kt__icon">
                        <Icon name={card.icon} size={22} />
                      </span>
                      <div>
                        <h2 className="kt__label">{card.label}</h2>
                        {card.lines.map((l) => (
                          <a key={l.label} href={l.href} className="kt__line" target={l.href.startsWith("http") ? "_blank" : undefined} rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}>
                            {l.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  </Tilt>
                </StaggerItem>
              ))}
            </StaggerGroup>
            <Reveal className="kt__map">
              <a href={c.mapUrl} target="_blank" rel="noopener noreferrer" className="kt__map-link" data-cursor="Karte">
                <span className="kt__map-grid" aria-hidden="true" />
                <span className="kt__pin" aria-hidden="true">
                  <span />
                </span>
                <span className="kt__map-text">
                  <strong>Standort</strong>
                  {c.street}, {c.postalCode} {c.locality}
                  <small>
                    Auf der Karte anzeigen <Icon name="arrow-up-right" size={14} />
                  </small>
                </span>
              </a>
            </Reveal>
          </div>
          <Reveal className="kt__form">
            <p className="eyebrow">Kontakt aufnehmen</p>
            <h2 className="h3">Kostenloses Erstgespräch buchen</h2>
            <p className="muted">Erzählen Sie uns, wo Ihr Unternehmen heute steht und was Sie digital erreichen möchten. Wir melden uns, um den Bedarf einzuordnen und die passenden nächsten Schritte zu besprechen.</p>
            <ContactForm source="kontakt" />
          </Reveal>
        </div>
        <style>{`
          .kt{display:grid;grid-template-columns:.8fr 1.2fr;gap:clamp(24px,4vw,60px);align-items:start}
          .kt__cards{display:grid;gap:12px}
          .kt__card{display:flex;gap:18px;padding:24px;border-radius:var(--radius-m);background:#fff;box-shadow:0 20px 40px -34px rgba(1,41,45,.6)}
          .kt__icon{flex:none;width:52px;height:52px;border-radius:16px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--teal),var(--petrol))}
          .kt__label{font:600 14px/1.2 var(--font-body);color:var(--teal-ink);margin:4px 0 8px}
          .kt__line{display:flex;align-items:center;min-height:44px;width:fit-content;font:600 19px/1.4 var(--font-display);transition:color .3s}
          .kt__line:hover{color:var(--teal-ink)}
          .kt__map{margin-top:12px}
          .kt__map-link{position:relative;display:block;height:280px;border-radius:var(--radius-m);overflow:hidden;color:#fff;background:radial-gradient(60% 70% at 50% 45%,rgba(2,141,134,.55),transparent 70%),var(--night)}
          .kt__map-grid{position:absolute;inset:-50%;background-image:linear-gradient(rgba(79,224,210,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(79,224,210,.14) 1px,transparent 1px);background-size:34px 34px;transform:perspective(500px) rotateX(55deg)}
          .kt__pin{position:absolute;left:50%;top:42%;translate:-50% -50%;width:22px;height:22px;border-radius:50%;background:var(--teal-glow);box-shadow:0 0 0 0 rgba(79,224,210,.6);animation:pinPulse 2s infinite}
          .kt__pin span{position:absolute;inset:6px;border-radius:50%;background:#fff}
          @keyframes pinPulse{70%{box-shadow:0 0 0 36px rgba(79,224,210,0)}100%{box-shadow:0 0 0 0 rgba(79,224,210,0)}}
          .kt__map-text{position:absolute;left:20px;right:20px;bottom:18px;display:grid;gap:2px;font-size:15px}
          .kt__map-text strong{font:700 18px/1.2 var(--font-display)}
          .kt__map-text small{display:flex;gap:6px;align-items:center;color:var(--teal-glow);margin-top:4px}
          .kt__form{padding:clamp(26px,4vw,52px);border-radius:var(--radius-l);background:#fff;box-shadow:0 50px 100px -60px rgba(1,41,45,.6)}
          @media(max-width:1000px){.kt{grid-template-columns:minmax(0,1fr)}}
        `}</style>
      </section>
    </>
  );
}
