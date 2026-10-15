import Link from "next/link";
import { listSessions, visitorLabel } from "@/lib/server/chats";
import { getSettings } from "@/lib/server/settings";
import { purgeChats } from "../../actions";
import { ConfirmForm } from "../../ui";
import { dateTime } from "../../format";

export const metadata = { title: "Chat-Verläufe" };

export default async function Chats() {
  const [all, settings] = await Promise.all([listSessions(), getSettings()]);
  const items = all.filter((s) => s.messages.some((m) => m.role === "user"));
  const days = settings.chatbot.retentionDays;
  return (
    <>
      <header className="a-head a-head--row">
        <div>
          <h1>Chat-Verläufe</h1>
          <p className="a-muted">Gespräche mit {settings.chatbot.assistantName}. Besucher erscheinen pseudonym, ohne IP-Adresse.</p>
        </div>
        {days > 0 && <ConfirmForm action={purgeChats.bind(null, days)} variant="ghost" label={`Älter als ${days} Tage löschen`} question={`Alle Chats löschen, die älter als ${days} Tage sind?`} />}
      </header>
      <section className="a-panel a-panel--flush">
        {items.length === 0 ? (
          <p className="a-empty">Noch keine Gespräche. Sobald jemand dem Assistenten schreibt, erscheint der Verlauf hier.</p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>Letzte Nachricht</th>
                <th>Besucher</th>
                <th>Erste Frage</th>
                <th>Nachrichten</th>
                <th>Anfrage</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>{dateTime(s.updatedAt)}</td>
                  <td>
                    <Link href={`/admin/chats/${s.id}`}>Besucher {visitorLabel(s.id)}</Link>
                    {s.page && <small>{s.page}</small>}
                  </td>
                  <td className="a-clip">{s.messages.find((m) => m.role === "user")?.content}</td>
                  <td>{s.messages.length}</td>
                  <td>{s.requestRef ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
