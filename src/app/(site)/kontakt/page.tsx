import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { ContactForm } from "@/components/sections/ContactForm";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/motion";
import { site } from "@/content/site";
import { staticSeo, withSeo } from "@/lib/seo";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/kontakt", ...staticSeo["/kontakt"] });

export default function ContactPage() {
  const c = site.contact;
  return (
    <>
      <PageHero
        scene="contact"
        eyebrow="Kontakt"
        title="Wir sind hier, um Ihnen beim Wachstum zu helfen."
        lead="Sie können uns gerne über Ihre bevorzugte Kontaktmethode erreichen. Wir freuen uns darauf, herauszufinden, wie unser Team für digitales Marketing zu Ihrem Erfolg beitragen kann."
        crumbs={[{ name: "Kontakt", path: "/kontakt" }]}
        compact
      />
      <section className="section light kt-sec" aria-label="Kontaktdaten und Formular">
        <div className="container kt">
          <aside className="kt__info" aria-labelledby="kt-info-h">
            <div className="kt__panel">
              <h2 id="kt-info-h" className="kt__panel-h">
                Direkt erreichen
              </h2>
              <p className="kt__panel-lead">Rufen Sie an, schreiben Sie uns oder kommen Sie in Neuhausen vorbei. Antwort in der Regel innerhalb von 24 Stunden.</p>

              <dl className="kt__list">
                <div className="kt__row">
                  <dt>
                    <Icon name="phone" size={20} />
                    Telefon
                  </dt>
                  <dd>
                    <a href={c.phonePrimary.href} className="kt__val">
                      {c.phonePrimary.label}
                      <span className="kt__tag">Festnetz</span>
                    </a>
                    <a href={c.phoneSecondary.href} className="kt__val">
                      {c.phoneSecondary.label}
                      <span className="kt__tag">Mobil</span>
                    </a>
                  </dd>
                </div>
                <div className="kt__row">
                  <dt>
                    <Icon name="mail" size={20} />
                    E-Mail
                  </dt>
                  <dd>
                    <a href={`mailto:${c.email}`} className="kt__val">
                      {c.email}
                    </a>
                  </dd>
                </div>
                <div className="kt__row">
                  <dt>
                    <Icon name="pin" size={20} />
                    Adresse
                  </dt>
                  <dd>
                    <address className="kt__addr">
                      <strong>{site.legalName}</strong>
                      {c.street}
                      <br />
                      {c.postalCode} {c.locality}
                    </address>
                    <a href={c.mapUrl} target="_blank" rel="noopener noreferrer" className="kt__map">
                      In Google Maps öffnen
                      <Icon name="arrow-up-right" size={16} strokeWidth={2} />
                      <span className="sr-only"> (öffnet in neuem Tab)</span>
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          </aside>

          <Reveal className="kt__form" y={24}>
            <h2 className="kt__form-h">Kostenloses Erstgespräch anfragen</h2>
            <p className="kt__form-lead">
              Erzählen Sie uns, wo Ihr Unternehmen heute steht und was Sie digital erreichen möchten. Wir melden uns, um den Bedarf einzuordnen und die passenden nächsten Schritte zu besprechen.
            </p>
            <ContactForm source="kontakt" />
          </Reveal>
        </div>
        <style>{`
          .kt{display:grid;grid-template-columns:minmax(0,.82fr) minmax(0,1.18fr);gap:clamp(24px,3.5vw,48px);align-items:start}
          .kt__info{position:sticky;top:calc(var(--header-h) + 24px)}
          .kt__panel{padding:clamp(26px,3vw,40px);border-radius:var(--radius-m);background:var(--deep);color:var(--on-dark)}
          .kt__panel-h{margin:0 0 10px;font-size:clamp(24px,2.1vw,30px);line-height:1.1;letter-spacing:-.02em;color:#fff}
          .kt__panel-lead{margin:0 0 26px;max-width:42ch;font-size:15.5px;line-height:1.6;color:var(--on-dark-soft)}
          .kt__list{margin:0;display:grid}
          .kt__row{display:grid;gap:8px;padding:20px 0;border-top:1px solid rgba(233,244,243,.14)}
          .kt__row:last-child{padding-bottom:0}
          .kt__row dt{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;color:var(--teal-glow)}
          .kt__row dd{margin:0;display:grid;justify-items:start}
          .kt__val{display:inline-flex;align-items:center;gap:12px;min-height:44px;font:600 clamp(19px,1.6vw,23px)/1.25 var(--font-display);letter-spacing:-.01em;color:#fff;
            text-decoration:underline;text-decoration-color:transparent;text-underline-offset:5px;text-decoration-thickness:1.5px;transition:text-decoration-color .2s;overflow-wrap:anywhere}
          .kt__val:hover{text-decoration-color:var(--teal-glow)}
          .kt__tag{font:500 12.5px/1 var(--font-body);letter-spacing:.02em;padding:5px 9px;border-radius:999px;background:rgba(79,224,210,.12);color:var(--on-dark)}
          .kt__addr{font-style:normal;font-size:17px;line-height:1.55;color:var(--on-dark)}
          .kt__addr strong{display:block;font:600 clamp(18px,1.5vw,21px)/1.3 var(--font-display);color:#fff;margin-bottom:2px}
          .kt__map{display:inline-flex;align-items:center;gap:8px;min-height:44px;margin-top:10px;padding:0 18px;border-radius:10px;border:1.5px solid rgba(233,244,243,.3);font-size:15px;font-weight:600;color:#fff;transition:background-color .2s,border-color .2s}
          .kt__map:hover{background:rgba(79,224,210,.12);border-color:var(--teal-glow)}
          .kt__form{padding:clamp(22px,3.6vw,48px);border-radius:var(--radius-m);background:#fff;border:1px solid var(--line-soft);box-shadow:0 40px 80px -60px rgba(1,41,45,.45)}
          .kt__form-h{margin:0 0 10px;font-size:clamp(24px,2.1vw,32px);line-height:1.12;letter-spacing:-.02em;color:var(--deep);text-wrap:balance}
          .kt__form-lead{margin:0 0 28px;max-width:60ch;color:var(--ink-soft);line-height:1.6}
          @media(max-width:1000px){
            .kt{grid-template-columns:minmax(0,1fr)}
            .kt__info{position:static}
          }
          @media(max-width:520px){
            .kt-sec{padding-top:36px}
            .kt{padding-inline:12px}
            .kt__form{padding:22px 18px;border-radius:var(--radius-s)}
            .kt__panel{border-radius:var(--radius-s)}
          }
        `}</style>
      </section>
    </>
  );
}
