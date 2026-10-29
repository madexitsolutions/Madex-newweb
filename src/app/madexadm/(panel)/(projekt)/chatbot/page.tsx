/**
 * PROJEKTCODE (Madex): the chat assistant Orion – conversations, the knowledge
 * it answers from, and its settings.
 */
import Link from "next/link";
import { Drawer } from "@/components/admin/drawer";
import { ConfirmForm } from "@/components/admin/forms";
import {
  Empty,
  Icon,
  PageHeader,
  Pager,
  Panel,
  Tabs,
  one,
  qs,
} from "@/components/admin/kit";
import { dateTime, number } from "@/lib/format";
import {
  chatStats,
  getSettings,
  listSessions,
} from "@/lib/server/chatbot-admin";
import { visitorLabel } from "@/lib/server/chats";
import { DEFAULT_COMPANY_PROFILE } from "@/lib/server/company-profile";
import { listKnowledge, openAiConfigured } from "@/lib/server/orion";
import { requirePermission } from "@/server/auth/session";
import { deleteChatAction, deleteKnowledgeAction } from "./actions";
import { ChatbotSettingsForm, KnowledgeForm } from "./client";
import "./chatbot.css";

export const metadata = { title: "Chatbot Orion" };

const PER_PAGE = 25;
/** Markers like [[kontakt]] steer the widget's buttons – not meant for reading. */
const clean = (s: string) => s.replace(/\[\[[^\]]+\]\]/g, "").trim();

export default async function ChatbotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("inquiries.view");
  const sp = await searchParams;
  const canSettings = user.permissions.has("settings.manage");
  const tab =
    ["wissen", "einstellungen"].includes(one(sp.tab)) && canSettings
      ? one(sp.tab)
      : "gespraeche";
  const [sessions, knowledge, settings] = await Promise.all([
    listSessions(),
    listKnowledge(),
    getSettings(),
  ]);
  const s = settings.chatbot;
  const stats = chatStats(sessions);

  const tabs = [
    {
      key: "gespraeche",
      label: "Gespräche",
      href: "/madexadm/chatbot",
      count: sessions.length,
    },
    ...(canSettings
      ? [
          {
            key: "wissen",
            label: "Wissen",
            href: "/madexadm/chatbot?tab=wissen",
            count: knowledge.length,
          },
          {
            key: "einstellungen",
            label: "Einstellungen",
            href: "/madexadm/chatbot?tab=einstellungen",
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={`Chatbot ${s.assistantName}`}
        description="Der KI-Assistent auf der Website: was Besucher fragen, welches Wissen er verwendet und wie er auftritt."
        meta={
          <span
            className={`a-pill a-pill--lg a-pill--${s.enabled ? (openAiConfigured() ? "ok" : "warn") : "muted"}`}
          >
            {!s.enabled
              ? "ausgeschaltet"
              : openAiConfigured()
                ? "aktiv"
                : "ohne KI-Schlüssel"}
          </span>
        }
      />
      <Tabs items={tabs} active={tab} label="Bereiche" />
      {tab === "gespraeche" && (
        <Conversations
          sessions={sessions}
          stats={stats}
          sp={sp}
          canDelete={user.permissions.has("inquiries.manage")}
        />
      )}
      {tab === "wissen" && <Knowledge items={knowledge} sp={sp} />}
      {tab === "einstellungen" && (
        <Panel>
          <ChatbotSettingsForm s={s} defaultProfile={DEFAULT_COMPANY_PROFILE} />
        </Panel>
      )}
    </>
  );
}

function Conversations({
  sessions,
  stats,
  sp,
  canDelete,
}: {
  sessions: Awaited<ReturnType<typeof listSessions>>;
  stats: ReturnType<typeof chatStats>;
  sp: Record<string, string | string[] | undefined>;
  canDelete: boolean;
}) {
  const filter = one(sp.filter);
  const q = one(sp.q).trim().toLowerCase();
  const list = sessions
    .filter(
      (c) =>
        (filter !== "anfrage" || c.requestRef) &&
        (filter !== "offen" || c.messages.some((m) => m.fallback)),
    )
    .filter(
      (c) => !q || c.messages.some((m) => m.content.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const page = Math.max(1, Number(one(sp.seite)) || 1);
  const rows = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const open = one(sp.gespraech)
    ? sessions.find((c) => c.id === one(sp.gespraech))
    : undefined;
  const base = {
    filter: filter || undefined,
    q: q || undefined,
    seite: page > 1 ? page : undefined,
  };
  const closeHref = `/madexadm/chatbot${qs(base)}`;

  return (
    <>
      <div className="a-stats">
        <div className="a-stat">
          <strong>{number(stats.week)}</strong>
          <span>Gespräche in 7 Tagen</span>
        </div>
        <div className="a-stat">
          <strong>{number(stats.messages)}</strong>
          <span>Fragen in 7 Tagen</span>
        </div>
        <Link
          href="/madexadm/chatbot?filter=anfrage"
          className={`a-stat${filter === "anfrage" ? " is-active" : ""}`}
        >
          <strong>{number(stats.requests)}</strong>
          <span>mit Anfrage oder Termin</span>
        </Link>
        <Link
          href="/madexadm/chatbot?filter=offen"
          className={`a-stat${stats.unanswered ? " a-stat--warn" : ""}${filter === "offen" ? " is-active" : ""}`}
        >
          <strong>{number(stats.unanswered)}</strong>
          <span>Fragen ohne Antwort</span>
        </Link>
      </div>
      <div className="a-toolbar">
        <div className="a-toolbar__row">
          <form className="a-search" role="search" action="/madexadm/chatbot">
            <Icon name="search" size={16} />
            <label htmlFor="cb-q" className="sr-only">
              Gespräche durchsuchen
            </label>
            <input
              id="cb-q"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="In Gesprächen suchen"
            />
            {filter && <input type="hidden" name="filter" value={filter} />}
          </form>
          <div className="a-chips" role="group" aria-label="Filter">
            {[
              ["", "Alle"],
              ["anfrage", "Mit Anfrage"],
              ["offen", "Ohne Antwort"],
            ].map(([k, l]) => (
              <Link
                key={k}
                href={`/madexadm/chatbot${qs({ filter: k || undefined, q: q || undefined })}`}
                className={`a-chip${filter === k ? " is-active" : ""}`}
                scroll={false}
              >
                {l}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <section className="a-panel a-panel--flush">
        {rows.length === 0 ? (
          <Empty
            icon="chat"
            title={sessions.length ? "Keine Treffer" : "Noch keine Gespräche"}
          >
            {sessions.length
              ? "Kein Gespräch passt zur Suche oder zum Filter."
              : "Sobald ein Besucher den Chat auf der Website nutzt, erscheint das Gespräch hier."}
          </Empty>
        ) : (
          <ul className="cb-list">
            {rows.map((c) => {
              const first = c.messages.find((m) => m.role === "user");
              const n = c.messages.filter((m) => m.role === "user").length;
              return (
                <li key={c.id}>
                  <Link
                    href={`/madexadm/chatbot${qs({ ...base, gespraech: c.id })}`}
                    className={`cb-row${open?.id === c.id ? " is-selected" : ""}`}
                    scroll={false}
                  >
                    <span className="cb-row__who">{visitorLabel(c.id)}</span>
                    <span className="cb-row__main">
                      <span className="cb-row__q">
                        {first ? first.content : "Chat geöffnet, keine Frage"}
                      </span>
                      <span className="cb-row__meta">
                        {n} {n === 1 ? "Frage" : "Fragen"}
                        {c.page && (
                          <span className="a-mono-path">{c.page}</span>
                        )}
                        {c.requestRef && (
                          <span className="a-pill a-pill--ok">
                            Anfrage {c.requestRef}
                          </span>
                        )}
                        {c.messages.some((m) => m.fallback) && (
                          <span className="a-pill a-pill--warn">
                            ohne Antwort
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="cb-row__time">
                      {dateTime(c.updatedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Pager
          page={page}
          pages={Math.max(1, Math.ceil(list.length / PER_PAGE))}
          total={list.length}
          from={list.length ? (page - 1) * PER_PAGE + 1 : 0}
          to={Math.min(list.length, page * PER_PAGE)}
          href={(p) =>
            `/madexadm/chatbot${qs({ ...base, seite: p > 1 ? p : undefined })}`
          }
        />
      </section>
      {open && (
        <Drawer
          closeHref={closeHref}
          title={`Gespräch ${visitorLabel(open.id)}`}
          subtitle={`${dateTime(open.createdAt)}${open.page ? ` · ${open.page}` : ""}`}
        >
          <div className="a-stack">
            <ol className="cb-chat">
              {open.messages.map((m, i) => (
                <li
                  key={m.id ?? i}
                  className={`cb-msg cb-msg--${m.role}${m.fallback ? " is-fallback" : ""}`}
                >
                  <p>{clean(m.content)}</p>
                  <small>
                    {m.role === "user" ? "Besucher" : "Orion"} ·{" "}
                    {dateTime(m.at)}
                    {m.fallback ? " · keine freigegebene Antwort" : ""}
                  </small>
                </li>
              ))}
            </ol>
            {open.messages.some((m) => m.fallback) && (
              <p className="a-alert a-alert--warn">
                Orion konnte hier nicht antworten. Ergänzen Sie unter «Wissen»
                einen Eintrag zu dieser Frage – dann klappt es beim nächsten
                Mal.
              </p>
            )}
          </div>
          {canDelete && (
            <div className="a-danger a-danger--inset">
              <div>
                <h2>Gespräch löschen</h2>
                <p>Zum Beispiel auf Wunsch des Besuchers (Datenschutz).</p>
              </div>
              <ConfirmForm
                action={deleteChatAction}
                label="Löschen"
                question="Dieses Gespräch endgültig löschen?"
              >
                <input type="hidden" name="id" value={open.id} />
              </ConfirmForm>
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}

function Knowledge({
  items,
  sp,
}: {
  items: Awaited<ReturnType<typeof listKnowledge>>;
  sp: Record<string, string | string[] | undefined>;
}) {
  const editId = one(sp.eintrag);
  const isNew = one(sp.neu) === "1";
  const editing = editId ? items.find((k) => k.id === editId) : undefined;
  return (
    <>
      <div className="cb-knowhead">
        <p className="a-muted">
          Orion beantwortet Fragen mit dem Firmenprofil und diesen Einträgen –
          und mit nichts anderem. Fehlt etwas, sagt er das ehrlich und verweist
          an Ihr Team.
        </p>
        <Link
          href="/madexadm/chatbot?tab=wissen&neu=1"
          className="a-btn a-btn--primary"
          scroll={false}
        >
          <Icon name="plus" size={16} />
          Eintrag hinzufügen
        </Link>
      </div>
      <section className="a-panel a-panel--flush">
        {items.length === 0 ? (
          <Empty
            icon="book"
            title="Noch kein Wissen ergänzt"
            action={
              <Link
                href="/madexadm/chatbot?tab=wissen&neu=1"
                className="a-btn a-btn--primary"
              >
                Ersten Eintrag hinzufügen
              </Link>
            }
          >
            Ergänzen Sie, was Kunden oft fragen: Abläufe, Preise, Bedingungen,
            Ansprechpartner.
          </Empty>
        ) : (
          <ul className="cb-list">
            {items.map((k) => (
              <li key={k.id}>
                <Link
                  href={`/madexadm/chatbot?tab=wissen&eintrag=${k.id}`}
                  className={`cb-row cb-row--know${editId === k.id ? " is-selected" : ""}`}
                  scroll={false}
                >
                  <span className="cb-row__main">
                    <span className="cb-row__q">{k.title}</span>
                    <span className="cb-row__meta">
                      {k.type}
                      {!k.active && (
                        <span className="a-pill a-pill--muted">inaktiv</span>
                      )}
                    </span>
                  </span>
                  <span className="cb-row__time">{dateTime(k.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {(isNew || editId) && (
        <Drawer
          closeHref="/madexadm/chatbot?tab=wissen"
          title={
            isNew
              ? "Neuer Wissenseintrag"
              : (editing?.title ?? "Eintrag nicht gefunden")
          }
        >
          {isNew || editing ? (
            <>
              <KnowledgeForm
                key={editing?.id ?? "neu"}
                item={editing ?? null}
                saved={one(sp.gespeichert) === "1"}
              />
              {editing && (
                <div className="a-danger a-danger--inset">
                  <div>
                    <h2>Eintrag löschen</h2>
                    <p>Orion verwendet dieses Wissen danach nicht mehr.</p>
                  </div>
                  <ConfirmForm
                    action={deleteKnowledgeAction}
                    label="Löschen"
                    question={`«${editing.title}» löschen?`}
                  >
                    <input type="hidden" name="id" value={editing.id} />
                  </ConfirmForm>
                </div>
              )}
            </>
          ) : (
            <div className="a-stack">
              <p className="a-muted">Diesen Eintrag gibt es nicht mehr.</p>
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}
