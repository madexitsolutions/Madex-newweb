import { adminInfo, requireAdmin } from "@/lib/server/auth";
import { resetTwoFactor, revokeSessions } from "../../actions";
import { ConfirmForm } from "../../ui";
import { dateTime } from "../../format";
import { Empty, Icon, PageHeader, Panel } from "../../kit";

export const metadata = { title: "Konto" };

const EVENTS: Record<string, string> = {
  password_ok: "Passwort korrekt",
  login_ok: "Anmeldung erfolgreich",
  login_failed: "Falsches Passwort",
  login_locked: "Anmeldung gesperrt (zu viele Versuche)",
  "2fa_failed": "Falscher Bestätigungscode",
  "2fa_enrolled": "Zwei-Faktor-Anmeldung eingerichtet",
  "2fa_reset": "Zwei-Faktor-Anmeldung zurückgesetzt",
  enroll_failed: "Einrichtung: falscher Code",
  recovery_code_used: "Wiederherstellungscode verwendet",
  logout: "Abgemeldet",
  sessions_revoked: "Alle Sitzungen beendet",
};

const BAD = new Set(["login_failed", "login_locked", "2fa_failed", "enroll_failed"]);

const device = (ua: string) => ua.split(") ")[0].replace(/^Mozilla\/5\.0 \(/, "") || "Unbekanntes Gerät";

export default async function Account() {
  const me = await requireAdmin();
  const info = await adminInfo();
  return (
    <>
      <PageHeader
        title="Konto"
        description={
          <>
            Angemeldet als <strong>{me.username}</strong>. Benutzername und Passwort werden in den Umgebungsvariablen (<code>ADMIN_USERNAME</code>, <code>ADMIN_PASSWORD</code>) verwaltet.
          </>
        }
      />
      <div className="a-grid2">
        <Panel title="Zwei-Faktor-Anmeldung" description="Schützt das Konto mit einem Code aus der Authenticator-App.">
          <p className={`a-state a-state--${info.has2fa ? "ok" : "bad"}`}>{info.has2fa ? `Aktiv · noch ${info.recoveryLeft} Wiederherstellungscodes übrig` : "Nicht eingerichtet"}</p>
          <p className="a-muted a-small">Neues Smartphone? Zurücksetzen und bei der nächsten Anmeldung neu einrichten.</p>
          <div className="a-panel__foot">
            <ConfirmForm action={resetTwoFactor} label="Zurücksetzen und abmelden" question="Zwei-Faktor-Anmeldung zurücksetzen? Sie werden abgemeldet und richten sie bei der nächsten Anmeldung neu ein." />
          </div>
        </Panel>
        <Panel title="Aktive Sitzungen" description={`${info.sessions.length} ${info.sessions.length === 1 ? "Gerät ist" : "Geräte sind"} angemeldet.`}>
          <ul className="a-devices">
            {info.sessions.map((s, i) => (
              <li key={i}>
                <span className="a-devices__icon">
                  <Icon name="user" size={16} />
                </span>
                <div>
                  {device(s.ua)}
                  <small>
                    seit {dateTime(s.createdAt)} · Netzwerk {s.ipHint}
                  </small>
                </div>
              </li>
            ))}
          </ul>
          <div className="a-panel__foot">
            <ConfirmForm action={revokeSessions} variant="ghost" label="Alle Sitzungen beenden" question="Alle Geräte abmelden, auch dieses?" />
          </div>
        </Panel>
      </div>
      <Panel flush title="Protokoll" description="Die letzten 100 Anmeldeereignisse.">
        {info.audit.length === 0 ? (
          <Empty icon="clock" title="Noch keine Ereignisse" />
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th>Ereignis</th>
                  <th>Netzwerk</th>
                  <th>Zeit</th>
                </tr>
              </thead>
              <tbody>
                {info.audit.map((a, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`a-state a-state--${BAD.has(a.event) ? "bad" : "plain"}`}>{EVENTS[a.event] ?? a.event}</span>
                      {a.detail && <small>{a.detail}</small>}
                    </td>
                    <td className="a-mono-cell">{a.ipHint}</td>
                    <td className="a-nowrap">{dateTime(a.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
