"use client";

import { useState } from "react";
import { Link } from "@/components/layout/Transition";
import { openOrion } from "@/components/layout/Orion";
import { offerSteps, packages } from "@/content/site";

const CHECKS = [
  "Individuelles Design",
  "Für Smartphone & Google optimiert",
  "Domain, Hosting & SSL",
  "Website gehört Ihnen",
  "Änderungen kostenlos",
  "Keine versteckten Kosten",
];

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="ic-check">
      <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* --------------------------------------------------------------- Offer */
export function Offer() {
  return (
    <section id="angebot" className="offer" aria-labelledby="offer-title">
      <div className="container offer__grid">
        <div className="offer__copy">
          <h2 id="offer-title" className="sec-title">
            Ihre neue Website ist inklusive.
          </h2>
          <p className="sec-lead">
            Bei Abschluss eines Online-Marketing-Pakets erstellen wir Ihre Website im Wert von CHF 8’000 ohne Erstellungskosten. Wir betreuen sie, solange wir zusammenarbeiten – und sie gehört Ihnen.
          </p>
          <ul className="offer__checks">
            {CHECKS.map((c) => (
              <li key={c}>
                <Check />
                {c}
              </li>
            ))}
          </ul>
          <div className="offer__cta">
            <Link href="/kostenlose-prufung" className="b b--primary">
              Angebot sichern
            </Link>
            <Link href="/website-portfolio" className="b b--quiet">
              Realisierte Websites ansehen
            </Link>
          </div>
        </div>

        <figure className="quote" aria-label="Beispiel-Offerte: Webdesign CHF 8’000, mit Marketing-Paket CHF 0">
          <header className="quote__head">
            <div>
              <strong>Offerte</strong>
              <span>Madex IT Solutions GmbH, Neuhausen am Rheinfall</span>
            </div>
            <span className="quote__no">Nr. 2026-0418</span>
          </header>
          <table className="quote__table">
            <thead>
              <tr>
                <th scope="col">Position</th>
                <th scope="col">CHF</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Webdesign & Entwicklung
                  <small>Individuelles Design, bis 15 Seiten, responsive</small>
                </td>
                <td>8’000.00</td>
              </tr>
              <tr>
                <td>
                  Domain, Hosting & SSL
                  <small>Laufend, solange wir zusammenarbeiten</small>
                </td>
                <td>inklusive</td>
              </tr>
              <tr>
                <td>
                  Änderungen an der Website
                  <small>Während der Zusammenarbeit</small>
                </td>
                <td>inklusive</td>
              </tr>
              <tr className="quote__credit">
                <td>Mit Online-Marketing-Paket</td>
                <td>−8’000.00</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total Website</th>
                <td>
                  <s>8’000.00</s>
                  <strong>0.–</strong>
                </td>
              </tr>
            </tfoot>
          </table>
          <span className="quote__stamp" aria-hidden="true">
            Inklusive
          </span>
          <figcaption>Mindestlaufzeit 12 Monate, Kündigungsfrist 3 Monate. Die Website gehört Ihnen – auch nach Vertragsende.</figcaption>
        </figure>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Steps */
export function Steps() {
  return (
    <section className="steps" aria-labelledby="steps-title">
      <div className="container">
        <h2 id="steps-title" className="sec-title sec-title--sm">
          So kommen Sie zu Ihrer neuen Website
        </h2>
        <ol className="steps__list">
          {offerSteps.map((s, i) => (
            <li key={s}>
              <span className="steps__n">{i + 1}</span>
              <p>{s}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ AI */
/** Example conversation on a client website (used on the home page and the KI service page). */
export function AiDemo() {
  return (
  <div className="ai__demo" aria-label="Beispielgespräch mit einem KI-Assistenten auf einer Garagen-Website">
    <div className="ai__win">
      <div className="ai__bar">
        <span className="ai__avatar" aria-hidden="true">
          G
        </span>
        <div>
          <strong>Assistent der Garage Muster</strong>
          <small>Antwortet sofort</small>
        </div>
      </div>
      <div className="ai__chat">
        <p className="ai__msg ai__msg--user">Haben Sie am Samstag offen? Mein Auto braucht neue Winterreifen.</p>
        <p className="ai__msg">Ja, samstags sind wir von 8 bis 12 Uhr für Sie da. Der Reifenwechsel dauert etwa 30 Minuten. Soll ich Ihnen einen Termin reservieren?</p>
        <p className="ai__msg ai__msg--user">Gerne, am 8. November vormittags.</p>
        <p className="ai__msg">
          Notiert: Samstag, 8. November, Vormittag. Das Team bestätigt Ihnen den Termin per E-Mail.
          <span className="ai__chip">Terminanfrage gesendet</span>
        </p>
      </div>
    </div>
    <p className="ai__note">Beispiel. Inhalte, Ton und Design passen wir an Ihr Unternehmen an.</p>
  </div>
  );
}


export function AiSection() {
  return (
    <section className="ai" aria-labelledby="ai-title">
      <div className="container ai__grid">
        <div className="ai__copy">
          <p className="ai__new">Neu bei Madex</p>
          <h2 id="ai-title" className="sec-title">
            Ein KI-Assistent für Ihre Website, der Ihr Unternehmen kennt.
          </h2>
          <p className="sec-lead">
            Wir integrieren einen Chat-Assistenten in Ihre Website, der mit Ihren Leistungen, Preisen und Abläufen arbeitet. Er beantwortet Kundenfragen rund um die Uhr, nimmt Terminanfragen auf und leitet alles Weitere an Ihr Team.
          </p>
          <ul className="ai__list">
            <li>
              <strong>Auf Ihr Geschäft zugeschnitten.</strong> Er antwortet nur mit Informationen, die Sie freigeben – nichts wird erfunden.
            </li>
            <li>
              <strong>Anfragen statt Absprünge.</strong> Termin- und Offertanfragen landen direkt in Ihrem Postfach.
            </li>
            <li>
              <strong>Sie behalten die Kontrolle.</strong> Wissen, Verläufe und Anfragen verwalten Sie in Ihrem eigenen Dashboard.
            </li>
          </ul>
          <div className="offer__cta">
            <button type="button" className="b b--light" onClick={openOrion}>
              Unseren Assistenten testen
            </button>
            <Link href="/marketing-solutions/ki-integration" className="b b--quiet-dark">
              Mehr zur KI-Integration
            </Link>
          </div>
        </div>
        <AiDemo />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Pricing */
const PRICES: Record<string, { price: string; unit?: string; note: string }> = {
  wartung: { price: "CHF 250", unit: "/ Monat", note: "Website inklusive, komplett betreut" },
  basic: { price: "Auf Anfrage", note: "Website & Social Media" },
  premium: { price: "Auf Anfrage", note: "Website, Social Media & Google Ads" },
};

export function Pricing() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section id="pakete" className="price" aria-labelledby="price-title">
      <div className="container">
        <div className="price__head">
          <h2 id="price-title" className="sec-title">
            Pakete und Preise
          </h2>
          <p className="sec-lead">Jedes Paket enthält Ihre neue Website. Sie wählen, wie viel Marketing dazugehört.</p>
        </div>
        <div className="price__panel">
          {packages.map((p) => {
            const meta = PRICES[p.id];
            const all = open === p.id;
            return (
              <article key={p.id} className={`price__col${p.highlight ? " is-pick" : ""}`} aria-labelledby={`pr-${p.id}`}>
                {p.highlight && <span className="price__pick">Am häufigsten gewählt</span>}
                <h3 id={`pr-${p.id}`}>{p.name}</h3>
                <p className="price__note">{meta.note}</p>
                <p className="price__amount">
                  {meta.price}
                  {meta.unit && <span>{meta.unit}</span>}
                </p>
                <Link href="/kostenlose-prufung" className={`b ${p.highlight ? "b--primary" : "b--outline"} b--block`}>
                  {meta.unit ? "Angebot sichern" : "Offerte anfragen"}
                </Link>
                <ul className="price__features" id={`pf-${p.id}`}>
                  {(all ? p.features : p.features.slice(0, 8)).map((f) => (
                    <li key={f}>
                      <Check />
                      {f}
                    </li>
                  ))}
                </ul>
                {p.features.length > 8 && (
                  <button type="button" className="price__more" aria-expanded={all} aria-controls={`pf-${p.id}`} onClick={() => setOpen(all ? null : p.id)}>
                    {all ? "Weniger anzeigen" : `Alle ${p.features.length} Leistungen anzeigen`}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        <ul className="price__foot">
          <li>Keine versteckten Kosten</li>
          <li>Website gehört Ihnen – auch nach Vertragsende</li>
          <li>Änderungen während der Zusammenarbeit kostenlos</li>
        </ul>
      </div>
    </section>
  );
}
