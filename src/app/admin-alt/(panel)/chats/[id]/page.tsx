import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { listSessions, visitorLabel } from "@/lib/server/chats";
import { listRequests } from "@/lib/server/requests";
import { removeChat } from "../../../actions";
import { ConfirmForm } from "../../../ui";
import { dateTime } from "../../../format";
import { Icon, PageHeader } from "../../../kit";

export const metadata = { title: "Chat-Verlauf" };

export default async function ChatDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const s = (await listSessions()).find((x) => x.id === id);
  if (!s) notFound();
  const request = s.requestRef ? (await listRequests()).find((r) => r.reference === s.requestRef) : undefined;
  return (
    <>
      <PageHeader
        crumb={{ href: "/admin-alt/chats", label: "Chat-Verläufe" }}
        title={`Besucher ${visitorLabel(s.id)}`}
        description={`Begonnen am ${dateTime(s.createdAt)}${s.page ? ` auf ${s.page}` : ""} · ${s.messages.length} Nachrichten`}
        actions={
          <>
            {request && (
              <Link className="a-btn a-btn--ghost" href={`/admin-alt/anfragen/${request.id}`}>
                <Icon name="inbox" size={16} />
                Anfrage {request.reference}
              </Link>
            )}
            <ConfirmForm action={removeChat.bind(null, s.id)} label="Verlauf löschen" question="Diesen Chat-Verlauf endgültig löschen?" />
          </>
        }
      />
      <section className="a-panel a-transcript" aria-label="Gesprächsverlauf">
        {s.messages.map((m, i) => (
          <div key={i} className={`a-bubble a-bubble--${m.role}`}>
            <small>
              {m.role === "user" ? "Besucher" : "Assistent"} · {dateTime(m.at)}
            </small>
            <p>{m.content.replace(/\[\[(seite:[a-z0-9-]+|pakete|termin|analyse|kontakt)\]\]/g, "").trim()}</p>
          </div>
        ))}
      </section>
    </>
  );
}
