import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { site } from "@/content/site";
import { metaPixelId } from "@/server/analytics/meta";
import { staticSeo, withSeo } from "@/lib/seo";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/datenschutz", ...staticSeo["/datenschutz"] });

export default function PrivacyPage() {
  const c = site.contact;
  return (
    <>
      <PageHero eyebrow="Rechtliches" title="Datenschutz" lead="Wie wir auf dieser Website mit Ihren Daten umgehen." crumbs={[{ name: "Datenschutz", path: "/datenschutz" }]} compact scene="legal" />
      <section className="section white">
        <div className="container legal">
          <h2>Verantwortliche Stelle</h2>
          <p>
            {site.legalName}
            <br />
            {c.street}, {c.postalCode} {c.locality}, Schweiz
            <br />
            E-Mail: <a href={`mailto:${c.email}`}>{c.email}</a> · Telefon: <a href={c.phonePrimary.href}>{c.phonePrimary.label}</a>
          </p>

          <h2>Grundsatz</h2>
          <p>
            Wir bearbeiten Personendaten im Einklang mit dem schweizerischen Bundesgesetz über den Datenschutz (DSG). Wir erheben nur die Daten, die für den Betrieb dieser Website und die Bearbeitung Ihrer Anfragen
            erforderlich sind, und geben sie nicht an Dritte weiter oder verkaufen sie.
          </p>

          <h2>Kontakt- und Terminformular</h2>
          <p>
            Wenn Sie uns über das Formular kontaktieren, bearbeiten wir die von Ihnen angegebenen Daten (z. B. Name, Unternehmen, E-Mail, Telefonnummer, Projektbeschreibung und Terminwunsch), um Ihre Anfrage zu beantworten.
            Die Angaben werden verschlüsselt auf unserem Server gespeichert, per E-Mail an uns übermittelt und nur so lange aufbewahrt, wie es für die Bearbeitung Ihrer Anfrage und allfällige gesetzliche Pflichten erforderlich ist.
          </p>

          <h2>KI-Chat-Assistent</h2>
          <p>
            Auf dieser Website steht ein Chat-Assistent zur Verfügung. Ihre Nachrichten werden zur Beantwortung an die OpenAI, L.L.C. (USA) übermittelt und dort verarbeitet; OpenAI verwendet über die API übermittelte Daten
            gemäss eigenen Angaben nicht zum Training seiner Modelle. Der Gesprächsverlauf wird auf unserem Server gespeichert, damit Sie das Gespräch fortsetzen können und wir Ihre Anfrage bearbeiten können, und nach Ablauf
            der festgelegten Aufbewahrungsfrist automatisch gelöscht. Bitte geben Sie im Chat keine besonders schützenswerten Personendaten ein. Wenn Sie über den Chat einen Termin anfragen, gelten die Angaben zum
            Kontaktformular.
          </p>

          <h2>Server-Logdateien</h2>
          <p>Beim Aufruf dieser Website werden technisch notwendige Informationen (z. B. IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browsertyp) durch den Hosting-Server verarbeitet, um die Website sicher und stabil bereitzustellen.</p>

          <h2>Cookies und Tracking</h2>
          <p>
            Ohne Ihre Zustimmung setzt diese Website keine Tracking- oder Marketing-Cookies. Für Komfortfunktionen (z. B. ob die Startanimation bereits gezeigt wurde oder Ihre bisherigen Chat-Gespräche) wird der lokale
            Speicher Ihres Browsers genutzt.
          </p>
          <p>
            Wenn Sie zustimmen, verwenden wir Google Analytics (Google Ireland Ltd. bzw. Google LLC, USA), um anonymisiert zu messen, wie unsere Website genutzt wird. Dabei werden Cookies gesetzt und Nutzungsdaten (z. B.
            gekürzte IP-Adresse, aufgerufene Seiten, Gerät und Browser) an Google übermittelt. Ihre Entscheidung wird in Ihrem Browser gespeichert; Sie können sie jederzeit ändern, indem Sie die Website-Daten in Ihrem
            Browser löschen.
          </p>
          {process.env.NEXT_PUBLIC_GOOGLE_ADS_ID && (
            <p>
              Wenn Sie zustimmen, verwenden wir zudem das Conversion-Tracking von Google Ads (Google Ireland Ltd. bzw. Google LLC, USA), um zu messen, ob eine Anfrage über eine unserer Anzeigen bei Google
              zustande kam. Dabei werden Cookies gesetzt und Angaben zu Ihrem Besuch an Google übermittelt.
            </p>
          )}
          {metaPixelId() && (
            <p>
              Wenn Sie zustimmen, verwenden wir zudem das Meta-Pixel und die Conversions API (Meta Platforms Ireland Ltd. bzw. Meta Platforms Inc., USA), um die Wirkung unserer Werbung auf Facebook und Instagram
              zu messen. Dabei werden Cookies gesetzt und Angaben zu aufgerufenen Seiten an Meta übermittelt. Senden Sie uns eine Anfrage, übermitteln wir Meta zusätzlich Ihre E-Mail-Adresse und Telefonnummer – nur
              verschlüsselt (gehasht), damit Meta die Anfrage einer Werbeanzeige zuordnen kann. Ohne Ihre Zustimmung findet keine Übermittlung an Meta statt.
            </p>
          )}

          <h2>Schriften und Medien</h2>
          <p>Schriftarten, Bilder und Videos werden direkt von unserem Server ausgeliefert. Es findet dabei keine Verbindung zu Drittanbietern statt.</p>

          <h2>YouTube-Videos</h2>
          <p>
            Videos in unserem Werbevideos-Portfolio werden erst geladen, wenn Sie auf «Abspielen» klicken. Erst dann wird eine Verbindung zu YouTube (Google) über die datenschutzfreundlichere Domain youtube-nocookie.com
            hergestellt. Es gelten die Datenschutzbestimmungen von Google.
          </p>

          <h2>Externe Links</h2>
          <p>Links zu Google Maps, sozialen Netzwerken oder Websites unserer Kunden und Partner öffnen Angebote Dritter. Für deren Inhalte und Datenbearbeitung sind die jeweiligen Anbieter verantwortlich.</p>

          <h2>Ihre Rechte</h2>
          <p>
            Sie können jederzeit Auskunft über Ihre bei uns gespeicherten Personendaten verlangen sowie deren Berichtigung oder Löschung beantragen. Wenden Sie sich dazu an <a href={`mailto:${c.email}`}>{c.email}</a>.
          </p>

          <h2>Haftungsausschluss</h2>
          <p>
            Der Autor übernimmt keinerlei Gewähr hinsichtlich der inhaltlichen Richtigkeit, Genauigkeit, Aktualität, Zuverlässigkeit und Vollständigkeit der Informationen. Haftungsansprüche gegen den Autor wegen Schäden
            materieller oder immaterieller Art, welche aus dem Zugriff oder der Nutzung bzw. Nichtnutzung der veröffentlichten Informationen, durch Missbrauch der Verbindung oder durch technische Störungen entstanden sind,
            werden ausgeschlossen. Alle Angebote sind unverbindlich. Der Autor behält es sich ausdrücklich vor, Teile der Seiten oder das gesamte Angebot ohne besondere Ankündigung zu verändern, zu ergänzen, zu löschen oder
            die Veröffentlichung zeitweise oder endgültig einzustellen.
          </p>
        </div>
        <style>{`
          .legal{max-width:860px}
          .legal h2{font-size:clamp(22px,2vw,28px);margin:44px 0 14px;padding-top:24px;border-top:1px solid var(--line)}
          .legal h2:first-child{margin-top:0;border:0;padding:0}
          .legal p{color:var(--text-soft)}
          .legal a{color:var(--teal-ink);text-decoration:underline}
        `}</style>
      </section>
    </>
  );
}
