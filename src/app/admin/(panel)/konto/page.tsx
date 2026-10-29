import QRCode from "qrcode";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm, Submit } from "@/components/admin/forms";
import { Empty, Icon, PageHeader, Panel } from "@/components/admin/kit";
import { dateTime, relative } from "@/lib/format";
import { describeUserAgent } from "@/lib/user-agent";
import { activeSessions, requireUser } from "@/server/auth/session";
import { otpauthUrl } from "@/server/auth/totp";
import { LOGIN_REASONS } from "@/server/security";
import { getSettings } from "@/server/settings";
import { beginTwoFactorSetup, listTotpDevices, recentLoginEvents, recoveryCodesLeft } from "@/server/users";
import { addDeviceAction, disableTwoFactorAction, enableTwoFactorAction, passwordAction, profileAction, regenerateCodesAction, removeDeviceAction, revokeOtherSessionsAction, revokeSessionAction } from "./actions";
import "../../system.css";

export const metadata = { title: "Mein Konto" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireUser();
  const deviceAdded = (await searchParams).geraet === "1";
  const [security, general, sessions, events, codesLeft] = await Promise.all([getSettings("security"), getSettings("general"), activeSessions(me.id), recentLoginEvents(me.id, 15), recoveryCodesLeft(me.id)]);
  sessions.sort((a, b) => (a.id === me.sessionId ? -1 : b.id === me.sessionId ? 1 : b.lastSeenAt.getTime() - a.lastSeenAt.getTime()));
  const others = sessions.filter((s) => s.id !== me.sessionId).length;

  // QR code: first setup, or a further device once 2FA is on
  const { secret, sealed } = beginTwoFactorSetup(me);
  const qr = await QRCode.toDataURL(otpauthUrl(secret, me.email, `${general.siteName} Dashboard`), { margin: 1, width: 180, color: { dark: "#12262a", light: "#ffffff" } });
  const setup: { qr: string; secret: string; sealed: string } = { qr, secret, sealed };
  const devices = me.totpEnabled ? await listTotpDevices(me.id) : [];

  return (
    <>
      <PageHeader title="Mein Konto" description={`Angemeldet als ${me.email} · Rolle ${me.role.name}`} />

      <div className="a-grid2">
        <Panel title="Profil" description="Name und Anmelde-Adresse. Eine neue E-Mail-Adresse bestätigen Sie mit Ihrem Passwort.">
          <ActionForm action={profileAction} className="a-stack">
            <label className="a-field">
              <span>Name</span>
              <input name="name" defaultValue={me.name} autoComplete="name" required maxLength={100} />
            </label>
            <label className="a-field">
              <span>E-Mail</span>
              <input name="email" type="email" defaultValue={me.email} autoComplete="email" required />
            </label>
            <label className="a-field">
              <span>
                Aktuelles Passwort <em>nur bei neuer E-Mail</em>
              </span>
              <input name="currentPassword" type="password" autoComplete="current-password" />
            </label>
            <div>
              <Submit>Profil speichern</Submit>
            </div>
          </ActionForm>
        </Panel>

        <Panel title="Passwort ändern" description="Nach der Änderung werden alle anderen Geräte abgemeldet.">
          <ActionForm action={passwordAction} className="a-stack" resetOnSuccess>
            <input type="hidden" name="username" value={me.email} autoComplete="username" />
            <label className="a-field">
              <span>Aktuelles Passwort</span>
              <input name="current" type="password" autoComplete="current-password" required />
            </label>
            <label className="a-field">
              <span>Neues Passwort</span>
              <input name="password" type="password" autoComplete="new-password" minLength={security.passwordMinLength} required />
              <small>Mindestens {security.passwordMinLength} Zeichen.</small>
            </label>
            <label className="a-field">
              <span>Neues Passwort wiederholen</span>
              <input name="password2" type="password" autoComplete="new-password" required />
            </label>
            <div>
              <Submit>Passwort ändern</Submit>
            </div>
          </ActionForm>
        </Panel>
      </div>

      <Panel
        title="Zwei-Faktor-Anmeldung"
        description="Zusätzlich zum Passwort ein Code aus einer Authenticator-App. Schützt das Konto, auch wenn das Passwort bekannt wird."
        action={me.totpEnabled ? <span className="a-pill a-pill--ok a-pill--lg">Eingeschaltet</span> : <span className="a-pill a-pill--warn a-pill--lg">Ausgeschaltet</span>}
      >
        {me.totpEnabled ? (
          <div className="s-actionlist">
            <div className="s-actionrow">
              <div>
                <strong>Wiederherstellungscodes</strong>
                <small>
                  {codesLeft === 0 ? "Keine Codes mehr übrig – erstellen Sie neue." : `${codesLeft} von 10 Codes übrig.`} Neue Codes ersetzen die bisherigen; sie werden einmal angezeigt.
                </small>
              </div>
              <ActionForm action={regenerateCodesAction} className="s-inlineform">
                <label className="a-field">
                  <span className="sr-only">Passwort zur Bestätigung</span>
                  <input name="password" type="password" autoComplete="current-password" placeholder="Passwort zur Bestätigung" required />
                </label>
                <Submit variant="ghost" pending="Erstellen …">
                  Neue Codes erstellen
                </Submit>
              </ActionForm>
            </div>
            <div className="s-devices">
              <div>
                <strong>Weitere Geräte</strong>
                <small>Zum Beispiel für eine Mitarbeiterin, die sich mit diesem Konto anmeldet: Jedes Gerät erhält einen eigenen Code und lässt sich einzeln entfernen.</small>
              </div>
              {deviceAdded && (
                <p className="a-alert a-alert--ok" role="status">
                  Gerät hinzugefügt. Ab sofort funktionieren dessen Codes bei der Anmeldung.
                </p>
              )}
              <ul className="s-devicelist">
                <li>
                  <span>
                    <strong>Hauptgerät</strong>
                    <small>bei der Einrichtung verbunden</small>
                  </span>
                </li>
                {devices.map((d) => (
                  <li key={d.id}>
                    <span>
                      <strong>{d.name}</strong>
                      <small>
                        hinzugefügt {dateTime(d.createdAt)}
                        {d.lastUsedAt ? `, zuletzt verwendet ${dateTime(d.lastUsedAt)}` : ", noch nicht verwendet"}
                      </small>
                    </span>
                    <ActionForm action={removeDeviceAction} className="s-inlineform">
                      <input type="hidden" name="id" value={d.id} />
                      <label className="a-field">
                        <span className="sr-only">Passwort zur Bestätigung</span>
                        <input name="password" type="password" autoComplete="current-password" placeholder="Passwort zur Bestätigung" required />
                      </label>
                      <Submit variant="ghost" pending="Entfernen …">
                        Entfernen
                      </Submit>
                    </ActionForm>
                  </li>
                ))}
              </ul>
              <details className="s-adddevice">
                <summary>Gerät hinzufügen</summary>
                <div className="s-twofa">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={setup.qr} alt="QR-Code für das neue Gerät" width={180} height={180} />
                  <div className="a-stack">
                    <ol className="s-steps">
                      <li>Auf dem neuen Gerät eine Authenticator-App öffnen (z. B. Google Authenticator, Microsoft Authenticator).</li>
                      <li>Diesen QR-Code scannen – er gilt nur für dieses Gerät.</li>
                      <li>Gerät benennen und den angezeigten 6-stelligen Code eingeben.</li>
                    </ol>
                    <details className="a-login__manual">
                      <summary>Schlüssel manuell eingeben</summary>
                      <code>{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
                    </details>
                    <ActionForm action={addDeviceAction} className="s-inlineform s-inlineform--wrap">
                      <input type="hidden" name="sealed" value={setup.sealed} />
                      <label className="a-field">
                        <span>Name des Geräts</span>
                        <input name="name" required maxLength={60} placeholder="z. B. iPhone Anna" />
                      </label>
                      <label className="a-field">
                        <span>Code aus der App</span>
                        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} required className="a-code-input" style={{ maxWidth: 180 }} />
                      </label>
                      <Submit pending="Prüfen …">Gerät hinzufügen</Submit>
                    </ActionForm>
                  </div>
                </div>
              </details>
            </div>
            <div className="s-actionrow">
              <div>
                <strong>Ausschalten</strong>
                <small>{security.require2fa ? "Nicht möglich: Die Sicherheitsrichtlinie verlangt 2FA für alle Konten." : "Nicht empfohlen. Das Konto ist dann nur noch durch das Passwort geschützt."}</small>
              </div>
              {!security.require2fa && (
                <ActionForm action={disableTwoFactorAction} className="s-inlineform">
                  <label className="a-field">
                    <span className="sr-only">Passwort zur Bestätigung</span>
                    <input name="password" type="password" autoComplete="current-password" placeholder="Passwort zur Bestätigung" required />
                  </label>
                  <Submit variant="danger" pending="Bitte warten …">
                    Ausschalten
                  </Submit>
                </ActionForm>
              )}
            </div>
          </div>
        ) : (
          (
            <div className="s-twofa">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qr} alt="QR-Code für die Authenticator-App" width={180} height={180} />
              <div className="a-stack">
                <ol className="s-steps">
                  <li>Öffnen Sie eine Authenticator-App (z. B. Google Authenticator, Microsoft Authenticator, 1Password).</li>
                  <li>Scannen Sie den QR-Code oder geben Sie den Schlüssel ein.</li>
                  <li>Geben Sie den angezeigten 6-stelligen Code ein. Danach sehen Sie einmalig Ihre Wiederherstellungscodes.</li>
                </ol>
                <details className="a-login__manual">
                  <summary>Schlüssel manuell eingeben</summary>
                  <code>{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
                </details>
                <ActionForm action={enableTwoFactorAction} className="s-inlineform">
                  <input type="hidden" name="sealed" value={setup.sealed} />
                  <label className="a-field">
                    <span>Code aus der App</span>
                    <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} required className="a-code-input" style={{ maxWidth: 180 }} />
                  </label>
                  <Submit pending="Prüfen …">Einschalten</Submit>
                </ActionForm>
              </div>
            </div>
          )
        )}
      </Panel>

      <div className="s-twocol">
        <Panel
          title="Angemeldete Geräte"
          description="Sitzungen, die aktuell Zugriff auf Ihr Konto haben."
          action={others > 0 ? <ActionButton action={revokeOtherSessionsAction} label="Alle anderen abmelden" question="Alle anderen Geräte abmelden?" /> : undefined}
        >
          <ul className="s-sessions">
            {sessions.map((s) => {
              const ua = describeUserAgent(s.userAgent);
              const current = s.id === me.sessionId;
              return (
                <li key={s.id}>
                  <span className="a-devices__icon" aria-hidden="true">
                    <Icon name={ua.mobile ? "phone" : "monitor"} size={16} />
                  </span>
                  <div className="s-sessions__main">
                    <strong>
                      {ua.label}
                      {current && <span className="a-pill a-pill--accent">Dieses Gerät</span>}
                    </strong>
                    <small>
                      IP {s.ip || "unbekannt"} · zuletzt aktiv {relative(s.lastSeenAt)} · angemeldet {dateTime(s.createdAt)}
                    </small>
                  </div>
                  {!current && <ActionButton action={revokeSessionAction} fields={{ sessionId: s.id }} label="Abmelden" variant="quiet" />}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Letzte Anmeldungen" description="Erfolgreiche und fehlgeschlagene Versuche mit Ihrer Adresse." flush>
          {events.length === 0 ? (
            <Empty icon="clock" title="Noch keine Einträge" />
          ) : (
            <ul className="s-sessions s-loginlist">
              {events.map((e) => (
                <li key={e.id}>
                  <span className={`a-state ${e.success ? "a-state--ok" : "a-state--bad"}`}>{e.success ? "Erfolgreich" : (LOGIN_REASONS[e.reason] ?? e.reason)}</span>
                  <div className="s-sessions__main">
                    <small>
                      {dateTime(e.createdAt)} · IP {e.ip || "unbekannt"} · {describeUserAgent(e.userAgent).label}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
