import { getSettings } from "@/lib/server/settings";
import { securityLog } from "@/lib/server/security";
import { saveSecurity } from "../../actions";
import { ActionForm, Submit } from "../../ui";
import { dateTime } from "../../format";

export const metadata = { title: "Sicherheit" };

const LABELS: Record<string, string> = {
  ip_blocked: "Gesperrte IP-Adresse",
  rate_minute: "Zu viele Nachrichten pro Minute",
  rate_day: "Tageslimit erreicht",
  rate_sessions: "Zu viele neue Gespräche",
  cooldown: "Nachrichten zu schnell hintereinander",
  too_short: "Nachricht zu kurz",
  too_long: "Nachricht zu lang",
  spam: "Spam erkannt",
  form_rate: "Formular zu oft gesendet",
};

export default async function Security() {
  const [s, log] = await Promise.all([getSettings(), securityLog()]);
  const x = s.security;
  const num = (name: keyof typeof x, label: string, min: number, max: number) => (
    <label className="a-field">
      <span>{label}</span>
      <input name={name} type="number" min={min} max={max} defaultValue={x[name] as number} />
    </label>
  );
  return (
    <>
      <header className="a-head">
        <h1>Sicherheit</h1>
        <p className="a-muted">Schutz des Chats vor Missbrauch und Kostenfallen bei der KI-Nutzung.</p>
      </header>
      <section className="a-panel">
        <h2>Limits</h2>
        <ActionForm action={saveSecurity} className="a-stack">
          <div className="a-grid3">
            {num("perMinute", "Nachrichten pro Minute", 1, 60)}
            {num("perDay", "Nachrichten pro Tag", 1, 1000)}
            {num("sessionsPerHour", "Neue Gespräche pro Stunde", 1, 100)}
            {num("cooldownSeconds", "Mindestabstand (Sekunden)", 0, 60)}
            {num("minLength", "Mindestlänge (Zeichen)", 1, 100)}
            {num("maxLength", "Maximallänge (Zeichen)", 50, 4000)}
          </div>
          <p className="a-muted a-small">Limits gelten pro Besucher-Netzwerk.</p>
          <label className="a-check">
            <input type="checkbox" name="blockSpam" defaultChecked={x.blockSpam} /> Offensichtlichen Spam blockieren (Links, Werbung, wiederholte Zeichen)
          </label>
          <label className="a-field">
            <span>Gesperrte IP-Adressen oder Ranges (eine pro Zeile)</span>
            <textarea name="blockedIps" rows={4} defaultValue={x.blockedIps.join("\n")} placeholder={"203.0.113.7\n198.51.100.0/24"} className="a-mono" />
          </label>
          <div>
            <Submit>Speichern</Submit>
          </div>
        </ActionForm>
      </section>
      <section className="a-panel a-panel--flush">
        <h2 className="a-pad">Ereignisse</h2>
        {log.length === 0 ? (
          <p className="a-empty">Keine blockierten Zugriffe.</p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Ereignis</th>
                <th>Netzwerk</th>
              </tr>
            </thead>
            <tbody>
              {log.slice(0, 100).map((e, i) => (
                <tr key={i}>
                  <td>{dateTime(e.at)}</td>
                  <td>
                    {LABELS[e.type] ?? e.type}
                    {e.detail && <small>{e.detail}</small>}
                  </td>
                  <td>{e.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
