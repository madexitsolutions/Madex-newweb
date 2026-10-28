import { ActionButton } from "@/components/admin/action-button";
import { ActionForm, Submit } from "@/components/admin/forms";
import { FormSection, Icon, PageHeader, Panel, Tabs, one } from "@/components/admin/kit";
import { requirePermission } from "@/server/auth/session";
import { smtpConfig } from "@/server/mail/mailer";
import { envManaged, getSettings, getSettingsForForm } from "@/server/settings";
import { enabledModules } from "@/modules/registry";
import { saveBrandingAction, saveEmailAction, saveGeneralAction, sendDigestAction, testEmailAction } from "./actions";
import { BrandingFields } from "./branding-fields";
import { SETTINGS_TABS } from "./tabs";
import "../../system.css";

export const metadata = { title: "Einstellungen" };

const OWN_TABS = ["allgemein", "branding", "email"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("settings.manage");
  const sp = await searchParams;
  const tab = OWN_TABS.includes(one(sp.tab)) ? one(sp.tab) : "allgemein";
  return (
    <>
      <PageHeader title="Einstellungen" description="Firmendaten, Erscheinungsbild und wer welche E-Mails bekommt. Google, E-Mail-Server und KI sind in den Umgebungsvariablen (.env) eingerichtet." />
      <Tabs items={SETTINGS_TABS} active={tab} label="Einstellungen" />
      {tab === "allgemein" && <GeneralTab />}
      {tab === "branding" && <BrandingTab />}
      {tab === "email" && <EmailTab />}
    </>
  );
}

async function GeneralTab() {
  const g = await getSettings("general");
  return (
    <Panel className="a-panel--form">
      <ActionForm action={saveGeneralAction} className="a-form">
        <FormSection title="Website" help="Name der Website im Dashboard, in E-Mails und Rechnungen. Die Adresse ist die öffentliche Domain dieser Website (für Links in E-Mails, Vorschaubilder in sozialen Medien usw.).">
          <label className="a-field">
            <span>Name</span>
            <input name="siteName" defaultValue={g.siteName} required maxLength={80} />
          </label>
          {envManaged("general").includes("siteUrl") ? (
            <div className="a-field">
              <span>Adresse der Website</span>
              <p className="s-envvalue">
                {g.siteUrl} <small>aus .env (NEXT_PUBLIC_SITE_URL)</small>
              </p>
            </div>
          ) : (
            <label className="a-field">
              <span>
                Adresse der Website <em>optional</em>
              </span>
              <input name="siteUrl" type="url" defaultValue={g.siteUrl} placeholder="https://www.kunde.ch" inputMode="url" />
            </label>
          )}
        </FormSection>
        <FormSection title="Firma" help="Erscheint als Absender auf Rechnungen, Lieferscheinen und in der Fusszeile der E-Mails.">
          <label className="a-field">
            <span>Firmenname</span>
            <input name="companyName" defaultValue={g.companyName} autoComplete="organization" placeholder="Muster AG" />
          </label>
          <label className="a-field">
            <span>Strasse und Nr.</span>
            <input name="street" defaultValue={g.street} autoComplete="street-address" />
          </label>
          <div className="a-fields3">
            <label className="a-field">
              <span>PLZ</span>
              <input name="zip" defaultValue={g.zip} autoComplete="postal-code" inputMode="numeric" />
            </label>
            <label className="a-field">
              <span>Ort</span>
              <input name="city" defaultValue={g.city} autoComplete="address-level2" />
            </label>
            <label className="a-field">
              <span>Land</span>
              <input name="country" defaultValue={g.country} maxLength={2} autoComplete="country" />
            </label>
          </div>
          <div className="a-fields2">
            <label className="a-field">
              <span>E-Mail</span>
              <input name="email" type="email" defaultValue={g.email} placeholder="info@kunde.ch" />
            </label>
            <label className="a-field">
              <span>Telefon</span>
              <input name="phone" type="tel" defaultValue={g.phone} placeholder="+41 44 000 00 00" />
            </label>
          </div>
          <label className="a-field">
            <span>
              UID / MWST-Nummer <em>optional</em>
            </span>
            <input name="vatNumber" defaultValue={g.vatNumber} placeholder="CHE-123.456.789 MWST" />
            <small>Pflicht auf Rechnungen, wenn die Firma mehrwertsteuerpflichtig ist.</small>
          </label>
        </FormSection>
        <FormSection title="Region" help="Zeitzone für Datumsangaben, Sprache und Währung für Beträge.">
          <div className="a-fields3">
            <label className="a-field">
              <span>Zeitzone</span>
              <input name="timezone" defaultValue={g.timezone} list="tz-list" />
              <datalist id="tz-list">
                <option value="Europe/Zurich" />
                <option value="Europe/Berlin" />
                <option value="Europe/Vienna" />
              </datalist>
            </label>
            <label className="a-field">
              <span>Sprache</span>
              <select name="locale" defaultValue={g.locale}>
                <option value="de-CH">Deutsch (Schweiz)</option>
                <option value="fr-CH">Französisch (Schweiz)</option>
                <option value="it-CH">Italienisch (Schweiz)</option>
                <option value="en-CH">Englisch (Schweiz)</option>
              </select>
            </label>
            <label className="a-field">
              <span>Währung</span>
              <select name="currency" defaultValue={g.currency}>
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
          </div>
        </FormSection>
        <div className="a-savebar">
          <Submit>Speichern</Submit>
        </div>
      </ActionForm>
    </Panel>
  );
}

function LogoPreview({ src, dark, fav, label }: { src: string; dark?: boolean; fav?: boolean; label: string }) {
  return (
    <span className={`s-logo__img ${dark ? "s-logo__img--dark" : "s-logo__img--light"}${fav ? " s-logo__img--fav" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={label} /> : <span>Kein Bild</span>}
    </span>
  );
}

function UploadField({ name, label, help, src, dark, fav }: { name: string; label: string; help: string; src: string; dark?: boolean; fav?: boolean }) {
  return (
    <div className="a-field">
      <span>{label}</span>
      <div className="s-logo">
        <LogoPreview src={src} dark={dark} fav={fav} label={label} />
        <div className="a-stack" style={{ gap: 6, flex: "1 1 220px" }}>
          <label className="s-file">
            <span className="sr-only">{label} hochladen</span>
            <input type="file" name={name} accept="image/png,image/svg+xml,image/webp,image/jpeg" />
          </label>
          {src && (
            <label className="a-check">
              <input type="checkbox" name={`remove_${name}`} />
              <span>Entfernen</span>
            </label>
          )}
        </div>
      </div>
      <small>{help}</small>
    </div>
  );
}

async function BrandingTab() {
  const [b, g] = await Promise.all([getSettings("branding"), getSettings("general")]);
  return (
    <Panel className="a-panel--form">
      <ActionForm action={saveBrandingAction} className="a-form">
        <FormSection title="Farben" help="Gelten für das Dashboard und die E-Mails. Die Vorschau zeigt die Navigation mit den gewählten Farben.">
          <BrandingFields primary={b.primaryColor} accent={b.accentColor} siteName={g.siteName} logoDark={b.logoDarkUrl || b.logoUrl} />
        </FormSection>
        <FormSection title="Logos" help="SVG oder PNG mit transparentem Hintergrund, mindestens 64 px hoch. Ohne Logo erscheint der Name als Text.">
          <UploadField name="logo" label="Logo für hellen Hintergrund" help="Anmeldeseite und E-Mails." src={b.logoUrl} />
          <UploadField name="logoDark" label="Logo für dunklen Hintergrund" help="Seitenleiste des Dashboards (meist eine weisse Version)." src={b.logoDarkUrl} dark />
        </FormSection>
        <FormSection title="Favicon" help="Symbol im Browser-Tab. Quadratisch, PNG oder SVG, höchstens 512 KB.">
          <UploadField name="favicon" label="Favicon" help="Empfohlen: 512 × 512 px." src={b.faviconUrl} fav />
        </FormSection>
        <div className="a-savebar">
          <Submit pending="Wird hochgeladen …">Speichern</Submit>
          <span className="a-small0 a-muted">Dateien werden in der Mediathek im Ordner «branding» abgelegt.</span>
        </div>
      </ActionForm>
    </Panel>
  );
}

async function EmailTab() {
  const [e, cfg, modules] = await Promise.all([getSettingsForForm("email"), smtpConfig(), enabledModules()]);
  const fromEnv = envManaged("email").includes("smtpHost");
  return (
    <div className="s-twocol">
      <Panel className="a-panel--form">
        <ActionForm action={saveEmailAction} className="a-form">
          <FormSection title="Antworten" help="Antwortet ein Empfänger auf eine E-Mail der Website, landet die Antwort hier.">
            <label className="a-field">
              <span>
                Antwort an <em>optional</em>
              </span>
              <input name="replyTo" type="email" defaultValue={e.replyTo} placeholder="info@madex-it.ch" />
            </label>
          </FormSection>
          <FormSection title="Benachrichtigungen" help="Wer bei neuen Ereignissen eine E-Mail bekommt. Eine Adresse pro Zeile; leer = keine E-Mail (die Meldung im Dashboard erscheint trotzdem).">
            <label className="a-field">
              <span>Neue Anfrage</span>
              <textarea name="notifyInquiry" rows={2} defaultValue={e.notifyInquiry.join("\n")} placeholder={process.env.CONTACT_TO_EMAIL || "info@kunde.ch"} />
              {process.env.CONTACT_TO_EMAIL && !e.notifyInquiry.length && <small>Leer = an {process.env.CONTACT_TO_EMAIL} (CONTACT_TO_EMAIL in .env).</small>}
            </label>
            {modules.shop && (
              <>
                <label className="a-field">
                  <span>Neue Bestellung</span>
                  <textarea name="notifyNewOrder" rows={2} defaultValue={e.notifyNewOrder.join("\n")} />
                </label>
                <label className="a-field">
                  <span>Lagerbestand niedrig</span>
                  <textarea name="notifyLowStock" rows={2} defaultValue={e.notifyLowStock.join("\n")} />
                </label>
              </>
            )}
            <label className="a-field">
              <span>Wochenbericht</span>
              <textarea name="notifyWeekly" rows={2} defaultValue={e.notifyWeekly.join("\n")} />
              <small>Jeden Montagmorgen: neue Anfragen, fällige Nachfass-Termine, Besucher und Google-Klicks der letzten Woche.</small>
            </label>
          </FormSection>
          <div className="a-savebar">
            <Submit>Speichern</Submit>
          </div>
        </ActionForm>
      </Panel>
      <Panel title="Versand" description="Server und Absender kommen aus den Umgebungsvariablen (.env bzw. Coolify).">
        <div className="a-stack">
          {cfg.configured ? (
            <dl className="s-envlist">
              <div>
                <dt>Server</dt>
                <dd>
                  {cfg.host}:{cfg.port}
                </dd>
              </div>
              <div>
                <dt>Absender</dt>
                <dd>{cfg.from}</dd>
              </div>
              {!fromEnv && (
                <div>
                  <dt>Quelle</dt>
                  <dd>ältere Dashboard-Einstellung – bitte nach .env übertragen</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="s-statusline">
              <Icon name="alert" size={16} />
              <span>
                Noch nicht eingerichtet – E-Mails werden nur protokolliert. In .env eintragen: <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASSWORD</code> und <code>MAIL_FROM</code>.
              </span>
            </p>
          )}
          <ActionButton action={testEmailAction} label="Test-E-Mail senden" small={false} pending="Wird gesendet …" icon={<Icon name="mail" size={16} />} />
          <ActionButton action={sendDigestAction} label="Wochenbericht an mich senden" variant="ghost" small={false} pending="Wird zusammengestellt …" icon={<Icon name="chart" size={16} />} />
          <p className="a-footnote" style={{ margin: 0 }}>
            Alle versendeten E-Mails sehen Sie unter Sicherheit → E-Mail-Protokoll.
          </p>
        </div>
      </Panel>
    </div>
  );
}
