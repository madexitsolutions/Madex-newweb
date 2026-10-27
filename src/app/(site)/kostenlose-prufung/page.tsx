import type { Metadata } from "next";
import { ScanForm } from "@/components/analysis/ScanForm";
import { CtaBand } from "@/components/sections/CtaBand";
import { FaqSection } from "@/components/sections/FaqSection";
import { Link } from "@/components/layout/Transition";
import { Icon } from "@/components/ui/Icon";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { site } from "@/content/site";
import { breadcrumbJsonLd, staticSeo, withSeo } from "@/lib/seo";
import "./analyse.css";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/kostenlose-prufung", ...staticSeo["/kostenlose-prufung"] });

/** The seven areas of the report – same order and names as the real analysis (lib/analysis.ts). */
const AREAS: { name: string; text: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { name: "SEO-Grundlagen", text: "Seitentitel, Beschreibung, Überschriften und Bildtexte – alles, was Google zum Verstehen Ihrer Seite braucht.", icon: "seo" },
  { name: "Google-Sichtbarkeit", text: "Ob Google Ihre Seiten findet und aufnehmen darf: Sitemap, Indexierung und Firmendaten für die lokale Suche.", icon: "google" },
  { name: "Design & Wirkung", text: "Wie der erste Bildschirm auf neue Besucher wirkt – Gestaltung, Schriften, Bilder und ein klarer nächster Schritt.", icon: "design" },
  { name: "Mobile & Responsive", text: "Ein echter Test auf dem Smartphone: Lesbarkeit, Bedienung mit dem Daumen und Darstellung auf kleinen Bildschirmen.", icon: "phone" },
  { name: "Ladezeit & Leistung", text: "Die Ladezeit auf Desktop und Mobile, gemessen mit den Werkzeugen von Google – inklusive der grössten Bremsen.", icon: "analysis" },
  { name: "Technik & Sicherheit", text: "SSL-Zertifikat, Server und Sicherheits-Einstellungen, die Besucher und Google heute erwarten.", icon: "web" },
  { name: "Inhalte & Kundengewinnung", text: "Ob Besucher Sie einfach erreichen: Kontaktwege, Kundenstimmen und Aufrufe, die zu Anfragen führen.", icon: "chat" },
];

const STEPS = [
  { t: "Adresse eingeben", d: "Ihre Website und Ihre E-Mail-Adresse – mehr braucht es nicht. Keine Registrierung, kein Passwort." },
  { t: "Der Prüfung zuschauen", d: "In rund einer Minute testen wir Ihre Seite live auf dem Computer und dem Smartphone. Sie sehen jeden Schritt." },
  { t: "Bericht erhalten", d: "Punktzahl, die drei wichtigsten Verbesserungen und alle Einzelprüfungen – online und als PDF per E-Mail." },
];

/** Sample report on the right of the hero – a fixed example, labelled as such. */
const SAMPLE = { score: 61, rows: [["SEO", 72], ["Google", 58], ["Design", 49], ["Mobile", 66], ["Tempo", 38], ["Technik", 81], ["Inhalte", 63]] as [string, number][] };
const tone = (n: number) => (n >= 75 ? "ok" : n >= 55 ? "mid" : "low");

export default function FreeAnalysisPage() {
  const c = site.contact;
  const faq = [
    { q: "Was kostet die Analyse?", a: "Nichts. Die Analyse ist kostenlos und unverbindlich. Wenn Sie möchten, besprechen wir das Ergebnis anschliessend in einem kostenlosen Erstgespräch – Sie müssen aber nicht." },
    { q: "Wie lange dauert es?", a: "Etwa eine Minute. Sie können live zuschauen, wie Ihre Website auf dem Computer und dem Smartphone geprüft wird. Danach steht der Bericht sofort bereit." },
    { q: "Wofür braucht es meine E-Mail-Adresse?", a: "Wir senden Ihnen den Bericht als PDF, damit Sie ihn später wiederfinden und weitergeben können. Ihre Adresse verwenden wir für nichts anderes und geben sie nicht weiter." },
    { q: "Kann ich dieselbe Website mehrmals prüfen?", a: "Jede Website wird einmal automatisch analysiert. Möchten Sie nach Änderungen eine neue Auswertung, melden Sie sich bei uns – wir prüfen sie gerne erneut und besprechen die Fortschritte mit Ihnen." },
    { q: "Was passiert nach der Analyse?", a: "Sie entscheiden. Viele Verbesserungen setzen Sie mit dem Bericht selbst um. Wenn Sie Unterstützung möchten, zeigen wir Ihnen im Erstgespräch, was sich lohnt und was es kostet." },
  ];
  const trail = [
    { name: "Home", path: "/" },
    { name: "Kostenlose Website-Analyse", path: "/kostenlose-prufung" },
  ];

  return (
    <>
      <section className="ka dark" aria-labelledby="ka-title">
        <div className="ka__glow" aria-hidden="true" />
        <div className="container ka__grid">
          <div className="ka__copy">
            <nav aria-label="Breadcrumb" className="ka__crumbs">
              <ol>
                <li>
                  <Link href="/">Home</Link>
                </li>
                <li>
                  <span aria-current="page">Kostenlose Website-Analyse</span>
                </li>
              </ol>
            </nav>
            <h1 id="ka-title" className="ka__title">
              Wie gut ist Ihre Website wirklich?
            </h1>
            <p className="ka__lead">
              In rund einer Minute prüfen wir SEO, Google-Sichtbarkeit, Design, Mobile, Ladezeit, Technik und Inhalte – und zeigen Ihnen die drei Verbesserungen, die am meisten bringen.
            </p>
            <ScanForm hint="Kostenlos und unverbindlich. Den Bericht erhalten Sie zusätzlich als PDF per E-Mail." />
            <ul className="ka__facts">
              <li>
                <Icon name="check" size={16} strokeWidth={2.4} />
                Ergebnis in etwa 60 Sekunden
              </li>
              <li>
                <Icon name="check" size={16} strokeWidth={2.4} />
                Desktop und Smartphone
              </li>
              <li>
                <Icon name="check" size={16} strokeWidth={2.4} />
                Ohne Registrierung
              </li>
            </ul>
          </div>

          <figure className="ka__sample" aria-label="Beispiel eines Analyse-Berichts">
            <div className="ka__sample-head">
              <span className="ka__sample-url">ihre-firma.ch</span>
              <span className="ka__sample-tag">Beispielbericht</span>
            </div>
            <div className="ka__sample-score">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="52" className="ka__ring-bg" />
                <circle cx="60" cy="60" r="52" className="ka__ring" style={{ ["--p" as string]: SAMPLE.score }} pathLength={100} />
              </svg>
              <div>
                <strong>{SAMPLE.score}</strong>
                <span>von 100 Punkten</span>
              </div>
            </div>
            <ul className="ka__bars">
              {SAMPLE.rows.map(([label, n], i) => (
                <li key={label} style={{ ["--i" as string]: i }}>
                  <span>{label}</span>
                  <span className={`ka__bar ka__bar--${tone(n)}`}>
                    <i style={{ width: `${n}%` }} />
                  </span>
                  <b>{n}</b>
                </li>
              ))}
            </ul>
            <figcaption className="ka__sample-tip">
              <Icon name="spark" size={16} />
              <span>
                <b>Grösster Hebel:</b> Ladezeit auf dem Smartphone halbieren – der Inhalt erscheint erst nach 9 Sekunden.
              </span>
            </figcaption>
          </figure>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(trail)) }} />
      </section>

      <section className="section white ka-areas" aria-labelledby="ka-areas-title">
        <div className="container">
          <Reveal className="ka-areas__head" y={20}>
            <h2 id="ka-areas-title" className="h2">
              Sieben Bereiche, ein klares Bild
            </h2>
            <p className="lead">Jeder Bereich bekommt eine eigene Punktzahl. So sehen Sie auf einen Blick, wo Ihre Website stark ist und wo Sie Kunden verlieren.</p>
          </Reveal>
          <StaggerGroup as="ul" className="ka-areas__list">
            {AREAS.map((a) => (
              <StaggerItem as="li" key={a.name} className="ka-area">
                <span className="ka-area__icon" aria-hidden="true">
                  <Icon name={a.icon} size={22} />
                </span>
                <div>
                  <h3>{a.name}</h3>
                  <p>{a.text}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="section light ka-steps" aria-labelledby="ka-steps-title">
        <div className="container">
          <h2 id="ka-steps-title" className="h2">
            So läuft die Analyse ab
          </h2>
          <ol className="ka-steps__list">
            {STEPS.map((s, i) => (
              <li key={s.t}>
                <span className="ka-steps__n" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </li>
            ))}
          </ol>
          <p className="ka-steps__again">
            <a href="#ka-title" className="link-arrow">
              Jetzt Website prüfen
            </a>
            <span>
              Lieber direkt sprechen? <a href={c.phonePrimary.href}>{c.phonePrimary.label}</a>
            </span>
          </p>
        </div>
      </section>

      <FaqSection items={faq} title="Fragen zur Analyse" />
      <CtaBand title="Lieber persönlich besprechen?" text="Erzählen Sie uns von Ihrem Unternehmen – wir melden uns innerhalb von 24 Stunden mit einer ehrlichen Einschätzung." href="/kontakt" cta="Erstgespräch anfragen" />
    </>
  );
}
