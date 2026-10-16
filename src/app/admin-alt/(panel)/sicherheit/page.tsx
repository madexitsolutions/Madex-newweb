import { requireAdmin } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";
import { securityLog } from "@/lib/server/security";
import { saveSecurity } from "../../actions";
import { ActionForm, Submit } from "../../ui";
import { dateTime } from "../../format";
import { Empty, FormSection, PageHeader, Panel } from "../../kit";

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
  await requireAdmin();
  const [s, log] = await Promise.all([getSettings(), securityLog()]);
  const x = s.security;
  const num = (name: keyof typeof x, label: string, min: number, max: number, help?: string) => (
    <label className="a-field">
      <span>{label}</span>
      <input name={name} type="number" min={min} max={max} defaultValue={x[name] as number} />
      {help && <small>{help}</small>}
    </label>
  );
  const day = Date.now() - 86400000;
  const last24 = log.filter((e) => new Date(e.at).getTime() >= day).length;

  return (
    <>
      <PageHeader title="Sicherheit" description="Schützt den Chat und die Formulare vor Missbrauch und vor unerwarteten KI-Kosten." />

      <section className="a-panel a-panel--form">
        <ActionForm action={saveSecurity} className="a-form">
          <FormSection title="Nachrichten-Limits" help="Wie oft ein Besucher dem Assistenten schreiben darf. Limits gelten pro Besucher-Netzwerk.">
            <div className="a-fields3">
              {num("perMinute", "Pro Minute", 1, 60)}
              {num("perDay", "Pro Tag", 1, 1000)}
              {num("cooldownSeconds", "Mindestabstand (Sek.)", 0, 60)}
            </div>
          </FormSection>
          <FormSection title="Gespräche" help="Bremst Skripte, die ständig neue Chats eröffnen.">
            <div className="a-fields3">{num("sessionsPerHour", "Neue Gespräche pro Stunde", 1, 100)}</div>
          </FormSection>
          <FormSection title="Nachrichtenlänge" help="Sehr lange Nachrichten verursachen hohe KI-Kosten.">
            <div className="a-fields3">
              {num("minLength", "Mindestlänge (Zeichen)", 1, 100)}
              {num("maxLength", "Maximallänge (Zeichen)", 50, 4000)}
            </div>
          </FormSection>
          <FormSection title="Spam & Sperren" help="Bekannte Störer dauerhaft aussperren.">
            <label className="a-check a-check--box">
              <input type="checkbox" name="blockSpam" defaultChecked={x.blockSpam} />
              <span>
                Offensichtlichen Spam blockieren
                <small>Links, Werbung und wiederholte Zeichen werden abgewiesen.</small>
              </span>
            </label>
            <label className="a-field">
              <span>Gesperrte IP-Adressen oder Ranges</span>
              <textarea name="blockedIps" rows={4} defaultValue={x.blockedIps.join("\n")} placeholder={"203.0.113.7\n198.51.100.0/24"} className="a-mono" />
              <small>Eine Adresse oder CIDR-Range pro Zeile.</small>
            </label>
          </FormSection>
          <div className="a-savebar">
            <Submit>Sicherheitseinstellungen speichern</Submit>
          </div>
        </ActionForm>
      </section>

      <Panel flush title="Blockierte Zugriffe" description={log.length ? `${last24} in den letzten 24 Stunden · die letzten ${Math.min(100, log.length)} werden angezeigt` : undefined}>
        {log.length === 0 ? (
          <Empty icon="shield" title="Keine blockierten Zugriffe">
            Wenn ein Limit greift oder Spam abgewiesen wird, erscheint das Ereignis hier.
          </Empty>
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
                {log.slice(0, 100).map((e, i) => (
                  <tr key={i}>
                    <td>
                      {LABELS[e.type] ?? e.type}
                      {e.detail && <small>{e.detail}</small>}
                    </td>
                    <td className="a-mono-cell">{e.ip}</td>
                    <td className="a-nowrap">{dateTime(e.at)}</td>
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
