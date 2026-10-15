import Image from "next/image";
import { legalNav, mainNav, site } from "@/content/site";
import { services } from "@/content/services";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Link } from "./Transition";
import { FooterReveal } from "./FooterReveal";

export function Footer() {
  const year = new Date().getFullYear();
  const who = mainNav.find((n) => n.label === "Wer wir sind")?.children ?? [];
  const portfolio = mainNav.find((n) => n.label === "Portfolio")?.children ?? [];
  return (
    <FooterReveal>
      <footer className="ft dark grain" aria-labelledby="footer-title">
        <div className="container">
          <div className="ft__cta">
            <p className="eyebrow">{site.tagline}</p>
            <h2 id="footer-title" className="ft__title">
              Lassen Sie uns <span className="text-gradient">gemeinsam</span> wachsen.
            </h2>
            <div className="ft__cta-row">
              <Button href="/kostenlose-prufung">Gratis-Analyse anfordern</Button>
              <Button href="/kontakt" variant="ghost">
                Erstgespräch buchen
              </Button>
            </div>
          </div>

          <div className="ft__grid">
            <div className="ft__brand">
              <div className="ft__logo">
                <Image src="/brand/logo-light.png" alt="Madex IT Solutions" width={936} height={201} unoptimized />
              </div>
              <address className="ft__addr">
                {site.legalName}
                <br />
                {site.contact.street}
                <br />
                {site.contact.postalCode} {site.contact.locality}
              </address>
              <ul className="ft__contact">
                <li>
                  <a href={site.contact.phonePrimary.href}>
                    <Icon name="phone" size={16} /> {site.contact.phonePrimary.label}
                  </a>
                </li>
                <li>
                  <a href={site.contact.phoneSecondary.href}>
                    <Icon name="phone" size={16} /> {site.contact.phoneSecondary.label}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${site.contact.email}`}>
                    <Icon name="mail" size={16} /> {site.contact.email}
                  </a>
                </li>
              </ul>
            </div>

            <nav aria-label="Marketing Lösungen" className="ft__col">
              <h3>Marketing Lösungen</h3>
              <ul>
                {services.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/marketing-solutions/${s.slug}`}>{s.name}</Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Wer wir sind" className="ft__col">
              <h3>Wer wir sind</h3>
              <ul>
                {who.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
                <li>
                  <Link href="/partners">Partner</Link>
                </li>
                <li>
                  <Link href="/kontakt">Kontakt</Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Portfolio" className="ft__col">
              <h3>Portfolio</h3>
              <ul>
                {portfolio.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
                <li>
                  <Link href="/kostenlose-prufung">Kostenlose Prüfung</Link>
                </li>
              </ul>
              <h3 className="ft__social-h">Folgen Sie uns</h3>
              <ul className="ft__social">
                {site.social.map((s) => (
                  <li key={s.href}>
                    <a href={s.href} target="_blank" rel="noopener noreferrer">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="ft__bottom">
            <span>
              © {year} {site.legalName} · UID {site.uid}
            </span>
            <ul>
              {legalNav.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <style>{`
          .ft{position:relative;overflow:hidden;padding:clamp(90px,10vw,150px) 0 28px;background:var(--deep)}
          .ft__cta{display:grid;gap:10px;padding-bottom:clamp(60px,7vw,110px);border-bottom:1px solid rgba(255,255,255,.1)}
          .ft__title{font-size:clamp(30px,3.4vw,52px);font-weight:700;letter-spacing:-.028em;line-height:1.05;margin:0 0 20px;max-width:16ch}
          .ft__cta-row{display:flex;flex-wrap:wrap;gap:14px}
          .ft__grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:40px;padding-block:clamp(50px,6vw,90px)}
          .ft__logo{display:block;margin-bottom:24px}
          .ft__logo img{width:170px;height:auto}
          .ft__addr{font-style:normal;color:var(--on-dark-soft);margin-bottom:18px;line-height:1.7}
          .ft__contact,.ft__col ul{list-style:none;margin:0;padding:0;display:grid;gap:2px}
          .ft__contact a,.ft__col a{display:inline-flex;align-items:center;min-height:44px}
          .ft__contact a{display:inline-flex;gap:10px;align-items:center;transition:color .3s}
          .ft__contact a:hover,.ft__col a:hover{color:#fff}
          .ft__col h3{font:600 15px/1.2 var(--font-body);color:#fff;margin-bottom:18px;letter-spacing:0}
          .ft__col a{color:var(--on-dark-soft);transition:color .3s}
          .ft__social-h{margin-top:30px}
          .ft__social{display:flex!important;flex-wrap:wrap;gap:0 18px!important}
          .ft__bottom{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;padding:24px 84px 0 0;border-top:1px solid rgba(255,255,255,.1);font-size:14px;color:var(--on-dark-soft)}
          .ft__bottom ul{display:flex;gap:22px;list-style:none;margin:0;padding:0}
          .ft__bottom a{display:inline-flex;align-items:center;min-height:44px}
          @media(max-width:1000px){.ft__grid{grid-template-columns:1fr 1fr}}
          @media(max-width:560px){.ft__grid{grid-template-columns:minmax(0,1fr)}}
        `}</style>
      </footer>
    </FooterReveal>
  );
}
