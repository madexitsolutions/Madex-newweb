import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { listRequests, STATUS_LABELS, TYPE_LABELS } from "@/lib/server/requests";
import { listSessions } from "@/lib/server/chats";
import { smtpConfigured } from "@/lib/server/mailer";
import { openAiConfigured } from "@/lib/server/orion";
import { analyticsIds, getSettings } from "@/lib/server/settings";
import { ga4Configured } from "@/lib/server/ga4";
import { dataDir } from "@/lib/server/store";
import { Bars } from "../chart";
import { dateTime, perDay } from "../format";
import { Empty, Icon, PageHeader, Panel, type IconName } from "../kit";

export const metadata = { title: "Übersicht" };

type Todo = { icon: IconName; tone: "warn" | "info"; title: string; text: string; href: string; cta: string };

export default async function Overview() {
  await requireAdmin();
  const [requests, chats, settings] = await Promise.all([listRequests(), listSessions(), getSettings()]);
  const since = Date.now() - 30 * 86400000;
  const recent = requests.filter((r) => new Date(r.createdAt).getTime() >= since);
  const chats30 = chats.filter((c) => new Date(c.createdAt).getTime() >= since && c.messages.some((m) => m.role === "user"));
  const fresh = requests.filter((r) => r.status === "new");
  const failed = requests.filter((r) => r.emailStatus === "failed").length;
  const ids = analyticsIds(settings.analytics);
  const checks = [
    { label: "E-Mail-Versand (SMTP)", ok: smtpConfigured(), hint: "SMTP_HOST, SMTP_USER und SMTP_PASSWORD in der .env setzen.", href: "/admin-alt/anfragen" },
    { label: "Chatbot (OpenAI)", ok: openAiConfigured(), hint: "OPENAI_API_KEY in der .env setzen.", href: "/admin-alt/chatbot?tab=verbindung" },
    { label: "Google Analytics Tracking", ok: Boolean(ids.ga4Id || ids.gtmId), hint: "Mess-ID unter Google Analytics eintragen.", href: "/admin-alt/analytics" },
    { label: "Google Analytics Berichte", ok: ga4Configured(), hint: "GA4_PROPERTY_ID und Dienstkonto in der .env setzen.", href: "/admin-alt/analytics" },
    { label: "Verschlüsselte Datenablage", ok: Boolean(process.env.DATA_ENCRYPTION_KEY), hint: "DATA_ENCRYPTION_KEY in der .env setzen.", href: "/admin-alt" },
  ];
  const setupOk = checks.filter((c) => c.ok).length;

  const todos: Todo[] = [];
  if (fresh.length)
    todos.push({
      icon: "inbox",
      tone: "info",
      title: fresh.length === 1 ? "1 neue Anfrage wartet auf Antwort" : `${fresh.length} neue Anfragen warten auf Antwort`,
      text: `Älteste vom ${dateTime(fresh.map((r) => r.createdAt).sort()[0])}`,
      href: "/admin-alt/anfragen?status=new",
      cta: "Anfragen öffnen",
    });
  if (failed)
    todos.push({
      icon: "mail",
      tone: "warn",
      title: failed === 1 ? "1 Benachrichtigung wurde nicht zugestellt" : `${failed} Benachrichtigungen wurden nicht zugestellt`,
      text: "Prüfen Sie die SMTP-Angaben und senden Sie die E-Mail in der Anfrage erneut.",
      href: "/admin-alt/anfragen?email=failed",
      cta: "Betroffene ansehen",
    });
  for (const c of checks.filter((x) => !x.ok && x.href !== "/admin-alt"))
    todos.push({ icon: "alert", tone: "warn", title: `${c.label} ist nicht eingerichtet`, text: c.hint, href: c.href, cta: "Einrichten" });

  return (
    <>
      <PageHeader
        title="Übersicht"
        description="Was in den letzten 30 Tagen auf madex-it.ch passiert ist – und was jetzt zu tun ist."
        actions={
          <Link href="/admin-alt/anfragen" className="a-btn a-btn--primary">
            <Icon name="inbox" size={16} />
            Zu den Anfragen
          </Link>
        }
      />

      <section className="a-kpis" aria-label="Kennzahlen">
        <Link href="/admin-alt/anfragen?status=new" className={`a-kpi${fresh.length ? " a-kpi--accent" : ""}`}>
          <span className="a-kpi__label">Neue Anfragen</span>
          <strong>{fresh.length}</strong>
          <span className="a-kpi__hint">{fresh.length ? "noch nicht bearbeitet" : "alles beantwortet"}</span>
        </Link>
        <Link href="/admin-alt/anfragen" className="a-kpi">
          <span className="a-kpi__label">Anfragen</span>
          <strong>{recent.length}</strong>
          <span className="a-kpi__hint">in 30 Tagen</span>
        </Link>
        <Link href="/admin-alt/chats" className="a-kpi">
          <span className="a-kpi__label">Chat-Gespräche</span>
          <strong>{chats30.length}</strong>
          <span className="a-kpi__hint">in 30 Tagen</span>
        </Link>
        <Link href="/admin-alt/anfragen?email=failed" className={`a-kpi${failed ? " a-kpi--warn" : ""}`}>
          <span className="a-kpi__label">E-Mails nicht zugestellt</span>
          <strong>{failed}</strong>
          <span className="a-kpi__hint">{failed ? "bitte prüfen" : "alle zugestellt"}</span>
        </Link>
      </section>

      <div className="a-grid2 a-grid2--wide">
        <Panel title="Was ist zu tun" description={todos.length ? `${todos.length} offene ${todos.length === 1 ? "Aufgabe" : "Aufgaben"}` : undefined}>
          {todos.length === 0 ? (
            <Empty icon="check" title="Alles erledigt">
              Keine offenen Anfragen, alle E-Mails zugestellt und alles eingerichtet.
            </Empty>
          ) : (
            <ul className="a-todo">
              {todos.map((t) => (
                <li key={t.title} className={`a-todo__item a-todo__item--${t.tone}`}>
                  <span className="a-todo__icon">
                    <Icon name={t.icon} />
                  </span>
                  <div className="a-todo__text">
                    <strong>{t.title}</strong>
                    <small>{t.text}</small>
                  </div>
                  <Link href={t.href} className="a-btn a-btn--ghost a-btn--sm">
                    {t.cta}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Anfragen pro Tag" description={`${recent.length} in den letzten 30 Tagen`}>
          <Bars data={perDay(recent.map((r) => r.createdAt))} label="Anfragen pro Tag in den letzten 30 Tagen" />
        </Panel>
      </div>

      <Panel
        flush
        title="Neueste Anfragen"
        action={
          <Link href="/admin-alt/anfragen" className="a-link">
            Alle anzeigen <Icon name="arrow" size={15} />
          </Link>
        }
      >
        {requests.length === 0 ? (
          <Empty title="Noch keine Anfragen">Sobald jemand ein Formular auf der Website oder den Chat nutzt, erscheint die Anfrage hier.</Empty>
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th>Kontakt</th>
                  <th>Art</th>
                  <th>Eingang</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.slice(0, 6).map((r) => (
                  <tr key={r.id} className={r.status === "new" ? "is-new" : undefined}>
                    <td>
                      <Link href={`/admin-alt/anfragen/${r.id}`} className="a-rowlink">
                        {r.name}
                      </Link>
                      <small>{r.company || r.email}</small>
                    </td>
                    <td>{TYPE_LABELS[r.type]}</td>
                    <td className="a-nowrap">{dateTime(r.createdAt)}</td>
                    <td>
                      <span className={`a-pill a-pill--${r.status}`}>{STATUS_LABELS[r.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Einrichtung" description={`${setupOk} von ${checks.length} Punkten erledigt`}>
        <ul className="a-checks">
          {checks.map((c) => (
            <li key={c.label} className={c.ok ? "is-ok" : "is-off"}>
              <span className="a-checks__dot">
                <Icon name={c.ok ? "check" : "alert"} size={14} />
              </span>
              <div>
                {c.label}
                <small>{c.ok ? "Eingerichtet" : c.hint}</small>
              </div>
            </li>
          ))}
        </ul>
        <p className="a-footnote">
          Datenablage: <code>{dataDir}</code>
        </p>
      </Panel>
    </>
  );
}
