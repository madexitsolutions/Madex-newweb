import Link from "next/link";
import { listRequests, STATUS_LABELS, TYPE_LABELS } from "@/lib/server/requests";
import { listSessions } from "@/lib/server/chats";
import { smtpConfigured } from "@/lib/server/mailer";
import { openAiConfigured } from "@/lib/server/orion";
import { analyticsIds, getSettings } from "@/lib/server/settings";
import { ga4Configured } from "@/lib/server/ga4";
import { dataDir } from "@/lib/server/store";
import { Bars } from "../chart";
import { dateTime, perDay } from "../format";

export const metadata = { title: "Übersicht" };

export default async function Overview() {
  const [requests, chats, settings] = await Promise.all([listRequests(), listSessions(), getSettings()]);
  const since = Date.now() - 30 * 86400000;
  const recent = requests.filter((r) => new Date(r.createdAt).getTime() >= since);
  const chats30 = chats.filter((c) => new Date(c.createdAt).getTime() >= since && c.messages.some((m) => m.role === "user"));
  const failed = requests.filter((r) => r.emailStatus === "failed").length;
  const ids = analyticsIds(settings.analytics);
  const checks = [
    { label: "E-Mail-Versand (SMTP)", ok: smtpConfigured(), hint: "SMTP_HOST, SMTP_USER, SMTP_PASSWORD in der .env" },
    { label: "Chatbot (OpenAI)", ok: openAiConfigured(), hint: "OPENAI_API_KEY in der .env" },
    { label: "Google Analytics Tracking", ok: Boolean(ids.ga4Id || ids.gtmId), hint: "Mess-ID unter Google Analytics eintragen" },
    { label: "Google Analytics Berichte", ok: ga4Configured(), hint: "GA4_PROPERTY_ID und Dienstkonto in der .env" },
    { label: "Verschlüsselte Datenablage", ok: Boolean(process.env.DATA_ENCRYPTION_KEY), hint: "DATA_ENCRYPTION_KEY in der .env" },
  ];

  return (
    <>
      <header className="a-head">
        <h1>Übersicht</h1>
        <p className="a-muted">Die letzten 30 Tage auf madex-it.ch</p>
      </header>

      <section className="a-kpis">
        <Link href="/admin/anfragen?status=new" className="a-kpi">
          <strong>{requests.filter((r) => r.status === "new").length}</strong>
          <span>Neue Anfragen</span>
        </Link>
        <Link href="/admin/anfragen" className="a-kpi">
          <strong>{recent.length}</strong>
          <span>Anfragen in 30 Tagen</span>
        </Link>
        <Link href="/admin/chats" className="a-kpi">
          <strong>{chats30.length}</strong>
          <span>Chat-Gespräche in 30 Tagen</span>
        </Link>
        <Link href="/admin/anfragen?email=failed" className={`a-kpi${failed ? " a-kpi--warn" : ""}`}>
          <strong>{failed}</strong>
          <span>E-Mails nicht zugestellt</span>
        </Link>
      </section>

      <div className="a-grid2">
        <section className="a-panel">
          <h2>Anfragen pro Tag</h2>
          <Bars data={perDay(recent.map((r) => r.createdAt))} label="Anfragen pro Tag in den letzten 30 Tagen" />
        </section>
        <section className="a-panel">
          <h2>Einrichtung</h2>
          <ul className="a-checks">
            {checks.map((c) => (
              <li key={c.label} className={c.ok ? "is-ok" : "is-off"}>
                <span aria-hidden="true">{c.ok ? "✓" : "!"}</span>
                <div>
                  {c.label}
                  {!c.ok && <small>{c.hint}</small>}
                </div>
              </li>
            ))}
          </ul>
          <p className="a-muted a-small">Datenablage: {dataDir}</p>
        </section>
      </div>

      <section className="a-panel">
        <div className="a-panel__head">
          <h2>Neueste Anfragen</h2>
          <Link href="/admin/anfragen">Alle anzeigen</Link>
        </div>
        {requests.length === 0 ? (
          <p className="a-empty">Noch keine Anfragen. Sobald jemand ein Formular oder den Chat nutzt, erscheint die Anfrage hier.</p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>Eingang</th>
                <th>Name</th>
                <th>Art</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 6).map((r) => (
                <tr key={r.id}>
                  <td>{dateTime(r.createdAt)}</td>
                  <td>
                    <Link href={`/admin/anfragen/${r.id}`}>{r.name}</Link>
                    {r.company && <small>{r.company}</small>}
                  </td>
                  <td>{TYPE_LABELS[r.type]}</td>
                  <td>
                    <span className={`a-pill a-pill--${r.status}`}>{STATUS_LABELS[r.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
