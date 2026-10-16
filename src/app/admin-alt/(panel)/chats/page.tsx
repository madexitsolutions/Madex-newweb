import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { listSessions, visitorLabel } from "@/lib/server/chats";
import { getSettings } from "@/lib/server/settings";
import { purgeChats } from "../../actions";
import { ConfirmForm } from "../../ui";
import { dateTime } from "../../format";
import { Empty, PageHeader, Pager, Tabs, one, qs } from "../../kit";

export const metadata = { title: "Chat-Verläufe" };

const PER_PAGE = 25;

export default async function Chats({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = one(sp.f);
  const [all, settings] = await Promise.all([listSessions(), getSettings()]);
  const real = all.filter((s) => s.messages.some((m) => m.role === "user")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const withRequest = real.filter((s) => s.requestRef);
  const items = filter === "anfrage" ? withRequest : real;
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(one(sp.p)) || 1));
  const shown = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const days = settings.chatbot.retentionDays;
  const name = settings.chatbot.assistantName;

  return (
    <>
      <PageHeader
        title="Chat-Verläufe"
        description={`Gespräche mit ${name}. Besucher erscheinen pseudonym, ohne IP-Adresse${days > 0 ? `; Verläufe werden nach ${days} Tagen gelöscht` : ""}.`}
        actions={days > 0 && <ConfirmForm action={purgeChats.bind(null, days)} variant="ghost" label={`Älter als ${days} Tage löschen`} question={`Alle Chats löschen, die älter als ${days} Tage sind?`} />}
      />

      <div className="a-toolbar">
        <Tabs
          label="Filter"
          variant="segment"
          active={filter === "anfrage" ? "anfrage" : "all"}
          items={[
            { key: "all", label: "Alle Gespräche", count: real.length, href: "/admin-alt/chats" },
            { key: "anfrage", label: "Mit Anfrage", count: withRequest.length, href: "/admin-alt/chats?f=anfrage" },
          ]}
        />
      </div>

      <section className="a-panel a-panel--flush">
        {items.length === 0 ? (
          filter === "anfrage" && real.length ? (
            <Empty icon="chat" title="Noch kein Gespräch hat zu einer Anfrage geführt" action={<Link href="/admin-alt/chats" className="a-btn a-btn--ghost">Alle Gespräche anzeigen</Link>}>
              Wenn Besucher im Chat einen Termin oder eine Analyse anfragen, erscheint das Gespräch hier.
            </Empty>
          ) : (
            <Empty icon="chat" title="Noch keine Gespräche" action={<Link href="/admin-alt/chatbot" className="a-btn a-btn--ghost">Chatbot einrichten</Link>}>
              Sobald jemand {name} auf der Website schreibt, erscheint der Verlauf hier.
            </Empty>
          )
        ) : (
          <>
            <div className="a-tablewrap">
              <table className="a-table a-table--stack">
                <thead>
                  <tr>
                    <th>Besucher</th>
                    <th>Erste Frage</th>
                    <th className="a-num">Nachrichten</th>
                    <th>Anfrage</th>
                    <th>Letzte Nachricht</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.id}>
                      <td className="a-nowrap">
                        <Link href={`/admin-alt/chats/${s.id}`} className="a-rowlink">
                          Besucher {visitorLabel(s.id)}
                        </Link>
                        {s.page && <small>{s.page}</small>}
                      </td>
                      <td className="a-clip a-clip--wide">{s.messages.find((m) => m.role === "user")?.content}</td>
                      <td className="a-num" data-label="Nachrichten">{s.messages.length}</td>
                      <td>{s.requestRef ? <span className="a-pill a-pill--confirmed">{s.requestRef}</span> : <span className="a-muted">–</span>}</td>
                      <td className="a-nowrap">{dateTime(s.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pages={pages} total={items.length} from={(page - 1) * PER_PAGE + 1} to={Math.min(page * PER_PAGE, items.length)} href={(p) => `/admin-alt/chats${qs({ f: filter || undefined, p: p > 1 ? p : undefined })}`} />
          </>
        )}
      </section>
    </>
  );
}
