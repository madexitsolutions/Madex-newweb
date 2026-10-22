import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm, Submit } from "@/components/admin/forms";
import { FormSection, Icon, PageHeader, Panel } from "@/components/admin/kit";
import { pluginByKey } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { appUrl } from "@/server/lib/app-url";
import { pluginSetupStates } from "@/server/plugins";
import { getSettings, getSettingsForForm } from "@/server/settings";
import { togglePluginAction } from "../actions";
import { saveAnalyticsAction, saveAnnouncementAction, saveContactFormAction, saveCookiesAction, saveCustomCodeAction, saveMaintenanceAction, saveSeoSiteAction } from "./actions";
import "../../../system.css";
import "../plugins.css";

const FORMS = ["inquiries", "seo", "analytics", "cookies", "announcement", "maintenance", "customCode"] as const;
type FormKey = (typeof FORMS)[number];

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  return { title: pluginByKey((await params).key)?.name ?? "Plugin" };
}

export default async function PluginSetupPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const plugin = pluginByKey(key);
  if (!plugin) notFound();
  if (!FORMS.includes(key as FormKey)) redirect(plugin.setup?.href ?? "/admin/plugins");
  await requirePermission(key === "seo" ? "seo.manage" : "settings.manage");
  const [modules, states] = await Promise.all([getSettings("modules"), pluginSetupStates()]);
  const active = modules[plugin.key];
  const state = states[plugin.key];

  return (
    <>
      <PageHeader
        crumb={{ href: "/admin/plugins", label: "Plugins" }}
        title={plugin.name}
        meta={active ? <span className="a-pill a-pill--ok">Aktiv</span> : <span className="a-pill a-pill--muted">Inaktiv</span>}
        description={plugin.description}
        actions={
          active ? (
            <ActionButton action={togglePluginAction} fields={{ key: plugin.key, active: "0" }} label="Deaktivieren" variant="quiet" small={false} question={`«${plugin.name}» deaktivieren? Die Einstellungen bleiben gespeichert.`} />
          ) : (
            <ActionButton action={togglePluginAction} fields={{ key: plugin.key, active: "1" }} label="Aktivieren" variant="primary" small={false} />
          )
        }
      />
      {!active ? (
        <Panel>
          <p className="a-muted">Aktivieren Sie das Plugin, um es einzurichten. Bereits gespeicherte Einstellungen bleiben erhalten.</p>
        </Panel>
      ) : (
        <>
          {state && (
            <p className={`pl-card__state pl-card__state--${state.tone} pl-banner`}>
              <Icon name={state.tone === "ok" ? "check" : state.tone === "warn" ? "alert" : "sparkle"} size={16} />
              {state.text}
            </p>
          )}
          {key === "inquiries" && <ContactForm />}
          {key === "seo" && <SeoForm />}
          {key === "analytics" && <AnalyticsForm />}
          {key === "cookies" && <CookiesForm />}
          {key === "announcement" && <AnnouncementForm />}
          {key === "maintenance" && <MaintenanceForm />}
          {key === "customCode" && <CustomCodeForm />}
        </>
      )}
    </>
  );
}

function Help({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel title={title} className="pl-help">
      {children}
    </Panel>
  );
}

async function ContactForm() {
  const c = await getSettings("contactForm");
  return (
    <div className="s-twocol">
      <Panel className="a-panel--form">
        <ActionForm action={saveContactFormAction} className="a-form">
          <FormSection title="Seite" help="Titel und Einleitung über dem Formular auf /kontakt.">
            <label className="a-field">
              <span>Seitentitel</span>
              <input name="title" defaultValue={c.title} required maxLength={80} />
            </label>
            <label className="a-field">
              <span>
                Einleitung <em>optional</em>
              </span>
              <textarea name="intro" rows={3} defaultValue={c.intro} maxLength={600} />
            </label>
          </FormSection>
          <FormSection title="Felder" help="Name, E-Mail und Nachricht sind immer dabei.">
            <label className="a-check a-check--box">
              <input type="checkbox" name="askPhone" defaultChecked={c.askPhone} />
              <span>Telefonnummer abfragen (freiwillig)</span>
            </label>
            <label className="a-check a-check--box">
              <input type="checkbox" name="askCompany" defaultChecked={c.askCompany} />
              <span>Firma abfragen (freiwillig)</span>
            </label>
          </FormSection>
          <FormSection title="Nach dem Absenden" help="Diese Bestätigung sehen Besucher, wenn ihre Nachricht angekommen ist.">
            <label className="a-field">
              <span>Bestätigung</span>
              <textarea name="successMessage" rows={2} defaultValue={c.successMessage} required maxLength={400} />
            </label>
          </FormSection>
          <div className="a-savebar">
            <Submit>Speichern</Submit>
            <a href={appUrl("/kontakt")} target="_blank" rel="noopener" className="a-link">
              Formular ansehen
              <Icon name="external" size={14} />
            </a>
          </div>
        </ActionForm>
      </Panel>
      <Help title="Wer bekommt die Anfragen?">
        <p className="a-muted">Neue Anfragen erscheinen unter «Anfragen» und werden an die Empfänger aus Einstellungen → E-Mail gemeldet. Dafür muss der E-Mail-Versand eingerichtet sein.</p>
        <p className="a-small">
          <Link href="/admin/einstellungen?tab=email" className="a-link">
            E-Mail-Versand und Empfänger
            <Icon name="arrow" size={14} />
          </Link>
        </p>
      </Help>
    </div>
  );
}

async function SeoForm() {
  const [s, g] = await Promise.all([getSettings("seoSite"), getSettings("general")]);
  return (
    <div className="s-twocol">
      <Panel className="a-panel--form">
        <ActionForm action={saveSeoSiteAction} className="a-form">
          <FormSection title="Titel in Google" help="%s steht für den Titel der Seite, {site} für den Namen der Website. Einzelne Seiten passen Sie unter SEO an.">
            <label className="a-field">
              <span>Vorlage für Seitentitel</span>
              <input name="titleTemplate" defaultValue={s.titleTemplate} placeholder="%s · {site}" maxLength={120} />
              <small>Beispiel: «Kontakt · {g.siteName}»</small>
            </label>
            <label className="a-field">
              <span>
                Standard-Beschreibung <em>optional</em>
              </span>
              <textarea name="defaultDescription" rows={3} defaultValue={s.defaultDescription} maxLength={300} />
              <small>Für Seiten ohne eigene Beschreibung. Ideal sind 70–160 Zeichen.</small>
            </label>
            <label className="a-field">
              <span>
                Vorschaubild für soziale Medien <em>optional</em>
              </span>
              <input name="ogImage" defaultValue={s.ogImage} placeholder="/uploads/…/bild.jpg" />
              <small>Adresse eines Bildes aus der Mediathek, ideal 1200 × 630 px.</small>
            </label>
          </FormSection>
          <FormSection title="Bestätigung der Inhaberschaft" help="Für Google Search Console und Bing Webmaster Tools: den ganzen Meta-Tag oder nur den Code einfügen.">
            <label className="a-field">
              <span>
                Google Search Console <em>optional</em>
              </span>
              <input name="googleVerification" defaultValue={s.googleVerification} spellCheck={false} placeholder='<meta name="google-site-verification" content="…">' />
            </label>
            <label className="a-field">
              <span>
                Bing <em>optional</em>
              </span>
              <input name="bingVerification" defaultValue={s.bingVerification} spellCheck={false} />
            </label>
          </FormSection>
          <FormSection title="Sichtbarkeit" help="Für Testinstallationen: Suchmaschinen sollen die Website nicht aufnehmen.">
            <label className="a-check a-check--box">
              <input type="checkbox" name="noindexSite" defaultChecked={s.noindexSite} />
              <span>
                Suchmaschinen ausschliessen
                <small>Setzt «noindex» auf allen Seiten und sperrt alles in robots.txt.</small>
              </span>
            </label>
          </FormSection>
          <div className="a-savebar">
            <Submit>Speichern</Submit>
            <Link href="/admin/seo" className="a-link">
              Titel je Seite bearbeiten
              <Icon name="arrow" size={14} />
            </Link>
          </div>
        </ActionForm>
      </Panel>
      <Help title="Automatisch erstellt">
        <ul className="pl-list">
          <li>
            <a href={appUrl("/sitemap.xml")} target="_blank" rel="noopener" className="a-link">
              sitemap.xml
            </a>{" "}
            – alle öffentlichen Seiten, Beiträge und Produkte. In der Google Search Console unter «Sitemaps» eintragen.
          </li>
          <li>
            <a href={appUrl("/robots.txt")} target="_blank" rel="noopener" className="a-link">
              robots.txt
            </a>{" "}
            – sperrt Dashboard, Warenkorb und Kasse für Suchmaschinen.
          </li>
          <li>Titel, Beschreibung, Vorschaubild (Open Graph) und Canonical-Adresse auf jeder Seite.</li>
        </ul>
      </Help>
    </div>
  );
}

async function AnalyticsForm() {
  const a = await getSettingsForForm("analytics");
  const configured = Boolean(a.ga4PropertyId && a._secrets.serviceAccountKey);
  const cookies = (await getSettings("modules")).cookies;
  return (
    <div className="s-twocol">
      <Panel className="a-panel--form">
        <ActionForm action={saveAnalyticsAction} className="a-form">
          <FormSection title="1. Besucher messen" help="Mit der Mess-ID wird Google Analytics auf allen Seiten der Website eingebunden.">
            <label className="a-field">
              <span>Mess-ID</span>
              <input name="ga4MeasurementId" defaultValue={a.ga4MeasurementId} placeholder="G-XXXXXXXXXX" spellCheck={false} />
              <small>Google Analytics → Verwaltung → Datenstreams → Web.</small>
            </label>
            {!cookies && (
              <p className="a-alert a-alert--warn">
                Ohne Einwilligung misst Google Analytics jeden Besuch. Für die Schweiz und die EU empfehlen wir das Plugin{" "}
                <Link href="/admin/plugins/cookies" className="a-link">
                  Cookie-Hinweis
                </Link>
                .
              </p>
            )}
          </FormSection>
          <FormSection title="2. Zahlen im Dashboard" help="Damit Übersicht und Statistiken Besucherzahlen zeigen, liest das Dashboard die Daten über ein Google-Dienstkonto (Anleitung rechts).">
            <label className="a-field">
              <span>Property-ID</span>
              <input name="ga4PropertyId" defaultValue={a.ga4PropertyId} placeholder="412345678" inputMode="numeric" />
            </label>
            <label className="a-field">
              <span>E-Mail des Dienstkontos</span>
              <input name="serviceAccountEmail" defaultValue={a.serviceAccountEmail} placeholder="dashboard@projekt.iam.gserviceaccount.com" spellCheck={false} />
              <small>Wird beim Einfügen der JSON-Datei automatisch übernommen.</small>
            </label>
            <div className="s-secretfield">
              <label className="a-field">
                <span>Schlüssel (Inhalt der JSON-Datei)</span>
                <textarea name="serviceAccountKey" rows={4} className="a-mono" spellCheck={false} placeholder={a._secrets.serviceAccountKey ? `Gespeichert (${a._secrets.serviceAccountKey}) – leer lassen, um ihn zu behalten` : '{ "type": "service_account", … }'} />
              </label>
              {a._secrets.serviceAccountKey && (
                <label className="a-check">
                  <input type="checkbox" name="remove_serviceAccountKey" />
                  <span>Gespeicherten Schlüssel entfernen</span>
                </label>
              )}
              <small className="s-hint">Wird verschlüsselt gespeichert und nie wieder angezeigt.</small>
            </div>
          </FormSection>
          <div className="a-savebar">
            <Submit>Speichern</Submit>
            {configured ? (
              <Link href="/admin/statistiken#besucher" className="a-link">
                Besucherzahlen ansehen
                <Icon name="arrow" size={14} />
              </Link>
            ) : (
              <span className="a-pill a-pill--muted">Dashboard noch nicht verbunden</span>
            )}
          </div>
        </ActionForm>
      </Panel>
      <Help title="Dienstkonto einrichten (einmalig, ca. 10 Minuten)">
        <ol className="s-steps">
          <li>
            In der{" "}
            <a className="a-link" href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">
              Google Cloud Console
            </a>{" "}
            ein Projekt wählen oder anlegen.
          </li>
          <li>Unter «APIs &amp; Dienste» die «Google Analytics Data API» aktivieren.</li>
          <li>Unter «IAM &amp; Verwaltung → Dienstkonten» ein Dienstkonto erstellen (keine Rollen nötig).</li>
          <li>Beim Dienstkonto unter «Schlüssel» einen JSON-Schlüssel erstellen und herunterladen.</li>
          <li>
            In Google Analytics unter «Verwaltung → Property-Zugriffsverwaltung» die E-Mail des Dienstkontos als <strong>Betrachter</strong> hinzufügen.
          </li>
          <li>Property-ID (Verwaltung → Property-Details) und den Inhalt der JSON-Datei links einfügen.</li>
        </ol>
      </Help>
    </div>
  );
}

async function CookiesForm() {
  const c = await getSettings("cookies");
  return (
    <div className="s-twocol">
      <Panel className="a-panel--form">
        <ActionForm action={saveCookiesAction} className="a-form">
          <FormSection title="Text" help="Kurz und verständlich: wofür werden Cookies verwendet?">
            <label className="a-field">
              <span>Hinweis</span>
              <textarea name="text" rows={3} defaultValue={c.text} maxLength={600} />
            </label>
            <div className="a-fields2">
              <label className="a-field">
                <span>Knopf «Zustimmen»</span>
                <input name="acceptLabel" defaultValue={c.acceptLabel} maxLength={40} />
              </label>
              <label className="a-field">
                <span>Knopf «Ablehnen»</span>
                <input name="declineLabel" defaultValue={c.declineLabel} maxLength={40} />
              </label>
            </div>
            <label className="a-field">
              <span>Link zur Datenschutzerklärung</span>
              <input name="privacyUrl" defaultValue={c.privacyUrl} placeholder="/datenschutz" />
            </label>
          </FormSection>
          <div className="a-savebar">
            <Submit>Speichern</Submit>
          </div>
        </ActionForm>
      </Panel>
      <Help title="Vorschau">
        <div className="pl-cookiepreview">
          <p>{c.text}</p>
          <div>
            <span className="a-btn a-btn--ghost a-btn--sm">{c.declineLabel}</span>
            <span className="a-btn a-btn--primary a-btn--sm">{c.acceptLabel}</span>
          </div>
        </div>
        <p className="a-muted a-small">Google Analytics und eigener Code mit Einwilligungspflicht laden erst nach «{c.acceptLabel}». Die Wahl gilt 6 Monate; Besucher können sie über «Cookie-Einstellungen» in der Fusszeile ändern.</p>
      </Help>
    </div>
  );
}

async function AnnouncementForm() {
  const a = await getSettings("announcement");
  return (
    <div className="s-twocol">
      <Panel className="a-panel--form">
        <ActionForm action={saveAnnouncementAction} className="a-form">
          <FormSection title="Inhalt" help="Ein Satz, z. B. «Betriebsferien vom 22.12. bis 5.1.» oder «Gratis Versand ab CHF 100».">
            <label className="a-field">
              <span>Text</span>
              <input name="text" defaultValue={a.text} maxLength={200} />
            </label>
            <div className="a-fields2">
              <label className="a-field">
                <span>
                  Link-Text <em>optional</em>
                </span>
                <input name="linkLabel" defaultValue={a.linkLabel} maxLength={40} placeholder="Mehr erfahren" />
              </label>
              <label className="a-field">
                <span>
                  Link-Adresse <em>optional</em>
                </span>
                <input name="linkUrl" defaultValue={a.linkUrl} placeholder="/shop" />
              </label>
            </div>
          </FormSection>
          <FormSection title="Zeitraum" help="Leer lassen = immer anzeigen. Die Leiste erscheint und verschwindet automatisch.">
            <div className="a-fields2">
              <label className="a-field">
                <span>
                  Ab <em>optional</em>
                </span>
                <input type="date" name="startsAt" defaultValue={a.startsAt} />
              </label>
              <label className="a-field">
                <span>
                  Bis und mit <em>optional</em>
                </span>
                <input type="date" name="endsAt" defaultValue={a.endsAt} />
              </label>
            </div>
          </FormSection>
          <FormSection title="Darstellung">
            <div className="s-radiocards">
              {(
                [
                  ["brand", "Hauptfarbe"],
                  ["accent", "Akzentfarbe"],
                  ["dark", "Dunkel"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className="a-check a-check--box">
                  <input type="radio" name="tone" value={v} defaultChecked={a.tone === v} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
            <label className="a-check a-check--box">
              <input type="checkbox" name="dismissible" defaultChecked={a.dismissible} />
              <span>Besucher können die Leiste schliessen</span>
            </label>
          </FormSection>
          <div className="a-savebar">
            <Submit>Speichern</Submit>
          </div>
        </ActionForm>
      </Panel>
      <Help title="Vorschau">
        {a.text ? (
          <p className={`pl-annpreview pl-annpreview--${a.tone}`}>
            {a.text} {a.linkLabel && <u>{a.linkLabel}</u>}
          </p>
        ) : (
          <p className="a-muted">Geben Sie einen Text ein – ohne Text bleibt die Leiste unsichtbar.</p>
        )}
      </Help>
    </div>
  );
}

async function MaintenanceForm() {
  const m = await getSettings("maintenance");
  return (
    <div className="s-twocol">
      <Panel className="a-panel--form">
        <ActionForm action={saveMaintenanceAction} className="a-form">
          <FormSection title="Wartungsseite" help="Diese Seite sehen Besucher, solange das Plugin aktiv ist. Suchmaschinen erhalten den Status 503 (vorübergehend nicht verfügbar).">
            <label className="a-field">
              <span>Titel</span>
              <input name="title" defaultValue={m.title} maxLength={120} />
            </label>
            <label className="a-field">
              <span>Text</span>
              <textarea name="text" rows={4} defaultValue={m.text} maxLength={800} />
            </label>
            <label className="a-check a-check--box">
              <input type="checkbox" name="showContact" defaultChecked={m.showContact} />
              <span>E-Mail und Telefon aus den Firmendaten anzeigen</span>
            </label>
          </FormSection>
          <div className="a-savebar">
            <Submit>Speichern</Submit>
          </div>
        </ActionForm>
      </Panel>
      <Help title="Sie sehen die Website trotzdem">
        <p className="a-muted">Solange Sie im Dashboard angemeldet sind, sehen Sie die Website normal – mit einem Hinweis, dass der Wartungsmodus aktiv ist. Zum Beenden das Plugin deaktivieren.</p>
        <p className="a-small">
          <a href={appUrl("/")} target="_blank" rel="noopener" className="a-link">
            Website öffnen
            <Icon name="external" size={14} />
          </a>
        </p>
      </Help>
    </div>
  );
}

async function CustomCodeForm() {
  const c = await getSettings("customCode");
  return (
    <div className="s-twocol">
      <Panel className="a-panel--form">
        <ActionForm action={saveCustomCodeAction} className="a-form">
          <FormSection title="Im <head>" help="Für Bestätigungs-Tags, Meta-Pixel, Schriftarten usw. Nur Code von vertrauenswürdigen Anbietern einfügen.">
            <label className="a-field">
              <span>Code</span>
              <textarea name="head" rows={7} className="a-mono" defaultValue={c.head} spellCheck={false} placeholder="<script>…</script>" />
            </label>
          </FormSection>
          <FormSection title="Am Ende der Seite" help="Für Chat-Widgets und andere Skripte, die nach dem Inhalt laden.">
            <label className="a-field">
              <span>Code</span>
              <textarea name="bodyEnd" rows={7} className="a-mono" defaultValue={c.bodyEnd} spellCheck={false} />
            </label>
          </FormSection>
          <FormSection title="Einwilligung" help="Mit aktivem Cookie-Hinweis wird der Code erst nach Zustimmung geladen.">
            <label className="a-check a-check--box">
              <input type="checkbox" name="needsConsent" defaultChecked={c.needsConsent} />
              <span>Erst nach Zustimmung laden (empfohlen für Tracking)</span>
            </label>
          </FormSection>
          <div className="a-savebar">
            <Submit>Speichern</Submit>
          </div>
        </ActionForm>
      </Panel>
      <Help title="Achtung">
        <p className="a-muted">Eingefügter Code läuft auf jeder Seite der Website mit vollen Rechten. Fehlerhafter Code kann die Website beschädigen. Im Dashboard selbst wird er nie ausgeführt.</p>
      </Help>
    </div>
  );
}
