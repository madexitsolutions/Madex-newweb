import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { getRequest, STATUS_LABELS, TIME_LABELS, TYPE_LABELS, type RequestStatus } from "@/lib/server/requests";
import { SERVICE_OPTIONS } from "@/lib/server/packages";
import { removeRequest, resendRequestEmail, saveRequestNotes, setRequestStatus } from "../../../actions";
import { ConfirmForm, Submit } from "../../../ui";
import { dateOnly, dateTime } from "../../../format";
import { Icon, PageHeader, Panel } from "../../../kit";

export const metadata = { title: "Anfrage" };

const EVENT_LABELS: Record<string, string> = {
  created: "Anfrage eingegangen",
  status: "Status geändert",
  note: "Notiz gespeichert",
  email_sent: "Benachrichtigung zugestellt",
  email_failed: "Benachrichtigung fehlgeschlagen",
  email_skipped: "Kein E-Mail-Versand (SMTP nicht eingerichtet)",
};

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v);
  if (!shown.length) return null;
  return (
    <dl className="a-dl">
      {shown.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const r = await getRequest(id);
  if (!r) notFound();
  const mailto = `mailto:${r.email}?subject=${encodeURIComponent("Ihre Anfrage " + r.reference)}`;
  const contact: [string, React.ReactNode][] = [
    ["Name", r.name],
    ["Firma", r.company],
    ["E-Mail", <a key="e" href={mailto}>{r.email}</a>],
    ["Telefon", r.phone && <a key="p" href={`tel:${r.phone.replace(/\s/g, "")}`}>{r.phone}</a>],
    ["Bereits Kunde", r.existingClient === undefined ? undefined : r.existingClient ? "Ja" : "Nein"],
    ["Website", r.website && <a key="w" href={/^https?:/.test(r.website) ? r.website : `https://${r.website}`} target="_blank" rel="noopener noreferrer">{r.website}</a>],
  ];
  const concern: [string, React.ReactNode][] = [
    ["Art", TYPE_LABELS[r.type]],
    ["Leistung", r.service && (SERVICE_OPTIONS[r.service] ?? r.service)],
    ["Paket", r.packageInterest],
    ["Wunschtermin", r.preferredDate && `${dateOnly(r.preferredDate)}${r.preferredTime ? ", " + (TIME_LABELS[r.preferredTime] ?? r.preferredTime) : ""}`],
  ];
  const meta: [string, React.ReactNode][] = [
    ["Referenz", r.reference],
    ["Quelle", r.source === "orion" ? "Chat (Orion)" : r.source],
    ["Eingang", dateTime(r.createdAt)],
    ["Einwilligung", dateTime(r.consentAt)],
  ];

  return (
    <>
      <PageHeader
        crumb={{ href: "/admin/anfragen", label: "Anfragen" }}
        title={r.name}
        meta={<span className={`a-pill a-pill--${r.status} a-pill--lg`}>{STATUS_LABELS[r.status]}</span>}
        description={`${TYPE_LABELS[r.type]}${r.company ? ` von ${r.company}` : ""}, eingegangen am ${dateTime(r.createdAt)} · ${r.reference}`}
        actions={
          <>
            {r.phone && (
              <a className="a-btn a-btn--ghost" href={`tel:${r.phone.replace(/\s/g, "")}`}>
                Anrufen
              </a>
            )}
            <a className="a-btn a-btn--primary" href={mailto}>
              <Icon name="mail" size={16} />
              Per E-Mail antworten
            </a>
          </>
        }
      />

      <div className="a-grid2 a-grid2--wide">
        <div className="a-stack">
          <Panel title="Anliegen">
            <Facts rows={concern} />
            {r.message ? (
              <div className="a-message-wrap">
                <h3>Nachricht</h3>
                <p className="a-message">{r.message}</p>
              </div>
            ) : (
              <p className="a-muted a-small">Keine Nachricht hinterlassen.</p>
            )}
          </Panel>
          <Panel title="Kontakt">
            <Facts rows={contact} />
          </Panel>
          <Panel title="Interne Notizen" description="Nur für das Team sichtbar. Jede Änderung erscheint im Verlauf.">
            <form action={saveRequestNotes.bind(null, r.id)} className="a-stack">
              <label className="a-field">
                <span className="sr-only">Notizen</span>
                <textarea name="notes" rows={5} defaultValue={r.notes} placeholder="z. B. «Am Dienstag angerufen, Offerte folgt bis Freitag.»" />
              </label>
              <div>
                <Submit>Notiz speichern</Submit>
              </div>
            </form>
          </Panel>
        </div>

        <div className="a-stack">
          <Panel title="Status" description="Hält fest, wie weit die Anfrage bearbeitet ist.">
            <form action={setRequestStatus.bind(null, r.id)} className="a-inline">
              <label className="a-field a-field--grow">
                <span className="sr-only">Status</span>
                <select name="status" defaultValue={r.status}>
                  {(Object.keys(STATUS_LABELS) as RequestStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <Submit>Ändern</Submit>
            </form>
          </Panel>
          <Panel title="Benachrichtigung ans Team">
            <p className={`a-state a-state--${r.emailStatus === "sent" ? "ok" : r.emailStatus === "failed" ? "bad" : "muted"}`}>
              {r.emailStatus === "sent" && "Die E-Mail an das Team wurde zugestellt."}
              {r.emailStatus === "failed" && `Zustellung fehlgeschlagen${r.emailError ? `: ${r.emailError}` : "."}`}
              {r.emailStatus === "skipped" && "Nicht versendet – SMTP ist nicht eingerichtet."}
              {r.emailStatus === "pending" && "Wird versendet …"}
            </p>
            <form action={resendRequestEmail.bind(null, r.id)} className="a-panel__foot">
              <Submit variant="ghost" pending="Wird gesendet …">
                Erneut senden
              </Submit>
            </form>
          </Panel>
          <Panel title="Verlauf">
            <ol className="a-timeline">
              {[...r.events].reverse().map((e, i) => (
                <li key={i}>
                  <span>{dateTime(e.at)}</span>
                  {EVENT_LABELS[e.type] ?? e.type}
                  {e.type === "status" && e.to && ` zu «${STATUS_LABELS[e.to as RequestStatus] ?? e.to}»`}
                  {e.note && <small>{e.note}</small>}
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Details">
            <Facts rows={meta} />
            {r.sessionId && (
              <div className="a-panel__foot">
                <Link className="a-btn a-btn--ghost" href={`/admin/chats/${r.sessionId}`}>
                  <Icon name="chat" size={16} />
                  Zugehörigen Chat ansehen
                </Link>
              </div>
            )}
          </Panel>
          <section className="a-danger">
            <div>
              <h2>Anfrage löschen</h2>
              <p>Entfernt die Anfrage samt Notizen endgültig.</p>
            </div>
            <ConfirmForm action={removeRequest.bind(null, r.id)} label="Löschen" question="Diese Anfrage endgültig löschen?" />
          </section>
        </div>
      </div>
    </>
  );
}
