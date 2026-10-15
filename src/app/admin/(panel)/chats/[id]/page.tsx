import Link from "next/link";
import { notFound } from "next/navigation";
import { listSessions, visitorLabel } from "@/lib/server/chats";
import { removeChat } from "../../../actions";
import { ConfirmForm } from "../../../ui";
import { dateTime } from "../../../format";

export const metadata = { title: "Chat-Verlauf" };

export default async function ChatDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = (await listSessions()).find((x) => x.id === id);
  if (!s) notFound();
  return (
    <>
      <p className="a-crumb">
        <Link href="/admin/chats">Chat-Verläufe</Link> / Besucher {visitorLabel(s.id)}
      </p>
      <header className="a-head a-head--row">
        <div>
          <h1>Besucher {visitorLabel(s.id)}</h1>
          <p className="a-muted">
            Begonnen am {dateTime(s.createdAt)}
            {s.page ? ` auf ${s.page}` : ""}
            {s.requestRef ? `, Anfrage ${s.requestRef}` : ""}
          </p>
        </div>
        <ConfirmForm action={removeChat.bind(null, s.id)} label="Verlauf löschen" question="Diesen Chat-Verlauf endgültig löschen?" />
      </header>
      <section className="a-panel a-transcript">
        {s.messages.map((m, i) => (
          <div key={i} className={`a-bubble a-bubble--${m.role}`}>
            <small>
              {m.role === "user" ? "Besucher" : "Assistent"}, {dateTime(m.at)}
            </small>
            <p>{m.content.replace(/\[\[(seite:[a-z0-9-]+|pakete|termin|analyse|kontakt)\]\]/g, "").trim()}</p>
          </div>
        ))}
      </section>
    </>
  );
}
