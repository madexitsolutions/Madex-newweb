import { adminInfo, currentAdmin } from "@/lib/server/auth";
import { resetTwoFactor, revokeSessions } from "../../actions";
import { ConfirmForm } from "../../ui";
import { dateTime } from "../../format";

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

export default async function Account() {
  const [me, info] = await Promise.all([currentAdmin(), adminInfo()]);
  return (
    <>
      <header className="a-head">
        <h1>Konto</h1>
        <p className="a-muted">
          Angemeldet als {me?.username}. Benutzername und Passwort werden in den Umgebungsvariablen (<code>ADMIN_USERNAME</code>, <code>ADMIN_PASSWORD</code>) verwaltet.
        </p>
      </header>
      <div className="a-grid2">
        <section className="a-panel">
          <h2>Zwei-Faktor-Anmeldung</h2>
          <p>{info.has2fa ? `Aktiv. Noch ${info.recoveryLeft} Wiederherstellungscodes übrig.` : "Nicht eingerichtet."}</p>
          <p className="a-muted a-small">Bei einem neuen Smartphone: zurücksetzen und bei der nächsten Anmeldung neu einrichten.</p>
          <ConfirmForm action={resetTwoFactor} label="Zurücksetzen und abmelden" question="Zwei-Faktor-Anmeldung zurücksetzen? Sie werden abgemeldet und richten sie bei der nächsten Anmeldung neu ein." />
        </section>
        <section className="a-panel">
          <h2>Aktive Sitzungen</h2>
          <ul className="a-list">
            {info.sessions.map((s, i) => (
              <li key={i}>
                {s.ua.split(") ")[0].replace(/^Mozilla\/5\.0 \(/, "") || "Unbekanntes Gerät"}
                <small>
                  seit {dateTime(s.createdAt)}, Netzwerk {s.ipHint}
                </small>
              </li>
            ))}
          </ul>
          <ConfirmForm action={revokeSessions} variant="ghost" label="Alle Sitzungen beenden" question="Alle Geräte abmelden, auch dieses?" />
        </section>
      </div>
      <section className="a-panel a-panel--flush">
        <h2 className="a-pad">Protokoll</h2>
        <table className="a-table">
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Ereignis</th>
              <th>Netzwerk</th>
            </tr>
          </thead>
          <tbody>
            {info.audit.map((a, i) => (
              <tr key={i}>
                <td>{dateTime(a.at)}</td>
                <td>
                  {EVENTS[a.event] ?? a.event}
                  {a.detail && <small>{a.detail}</small>}
                </td>
                <td>{a.ipHint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
