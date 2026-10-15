import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequest, STATUS_LABELS, TIME_LABELS, TYPE_LABELS, type RequestStatus } from "@/lib/server/requests";
import { SERVICE_OPTIONS } from "@/lib/server/packages";
import { removeRequest, resendRequestEmail, saveRequestNotes, setRequestStatus } from "../../../actions";
import { ConfirmForm, Submit } from "../../../ui";
import { dateOnly, dateTime } from "../../../format";

export const metadata = { title: "Anfrage" };

const EVENT_LABELS: Record<string, string> = {
  created: "Anfrage eingegangen",
  status: "Status geändert",
  note: "Notiz gespeichert",
  email_sent: "Benachrichtigung zugestellt",
  email_failed: "Benachrichtigung fehlgeschlagen",
  email_skipped: "Kein E-Mail-Versand (SMTP nicht eingerichtet)",
};

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getRequest(id);
  if (!r) notFound();
  const rows: [string, React.ReactNode][] = [
    ["Referenz", r.reference],
    ["Art", TYPE_LABELS[r.type]],
    ["Quelle", r.source === "orion" ? "Chat (Orion)" : r.source],
    ["Name", r.name],
    ["Firma", r.company],
    ["E-Mail", <a key="e" href={`mailto:${r.email}?subject=${encodeURIComponent("Ihre Anfrage " + r.reference)}`}>{r.email}</a>],
    ["Telefon", r.phone && <a key="p" href={`tel:${r.phone.replace(/\s/g, "")}`}>{r.phone}</a>],
    ["Bereits Kunde", r.existingClient === undefined ? undefined : r.existingClient ? "Ja" : "Nein"],
    ["Leistung", r.service && (SERVICE_OPTIONS[r.service] ?? r.service)],
    ["Paket", r.packageInterest],
    ["Website", r.website && <a key="w" href={/^https?:/.test(r.website) ? r.website : `https://${r.website}`} target="_blank" rel="noopener noreferrer">{r.website}</a>],
    ["Wunschtermin", r.preferredDate && `${dateOnly(r.preferredDate)}${r.preferredTime ? ", " + (TIME_LABELS[r.preferredTime] ?? r.preferredTime) : ""}`],
    ["Einwilligung", dateTime(r.consentAt)],
  ];

  return (
    <>
      <p className="a-crumb">
        <Link href="/admin/anfragen">Anfragen</Link> / {r.reference}
      </p>
      <header className="a-head a-head--row">
        <div>
          <h1>{r.name}</h1>
          <p className="a-muted">
            {TYPE_LABELS[r.type]}, eingegangen am {dateTime(r.createdAt)}
          </p>
        </div>
        <span className={`a-pill a-pill--${r.status} a-pill--lg`}>{STATUS_LABELS[r.status]}</span>
      </header>

      <div className="a-grid2 a-grid2--wide">
        <div className="a-stack">
          <section className="a-panel">
            <h2>Angaben</h2>
            <dl className="a-dl">
              {rows
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
            {r.message && (
              <>
                <h3>Nachricht</h3>
                <p className="a-message">{r.message}</p>
              </>
            )}
          </section>
          <section className="a-panel">
            <h2>Interne Notizen</h2>
            <form action={saveRequestNotes.bind(null, r.id)} className="a-stack">
              <label className="a-field">
                <span className="sr-only">Notizen</span>
                <textarea name="notes" rows={4} defaultValue={r.notes} placeholder="Nur für das Team sichtbar" />
              </label>
              <div>
                <Submit>Notiz speichern</Submit>
              </div>
            </form>
          </section>
        </div>

        <div className="a-stack">
          <section className="a-panel">
            <h2>Status</h2>
            <form action={setRequestStatus.bind(null, r.id)} className="a-row">
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
          </section>
          <section className="a-panel">
            <h2>Benachrichtigung</h2>
            <p>
              {r.emailStatus === "sent" && "Die E-Mail an das Team wurde zugestellt."}
              {r.emailStatus === "failed" && <span className="a-warn">Zustellung fehlgeschlagen{r.emailError ? `: ${r.emailError}` : "."}</span>}
              {r.emailStatus === "skipped" && "Nicht versendet – SMTP ist nicht eingerichtet."}
              {r.emailStatus === "pending" && "Wird versendet …"}
            </p>
            <form action={resendRequestEmail.bind(null, r.id)}>
              <Submit variant="ghost" pending="Wird gesendet …">
                Erneut senden
              </Submit>
            </form>
          </section>
          <section className="a-panel">
            <h2>Verlauf</h2>
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
          </section>
          {r.sessionId && (
            <Link className="a-btn a-btn--ghost" href={`/admin/chats/${r.sessionId}`}>
              Zugehörigen Chat ansehen
            </Link>
          )}
          <ConfirmForm action={removeRequest.bind(null, r.id)} label="Anfrage löschen" question="Diese Anfrage endgültig löschen?" />
        </div>
      </div>
    </>
  );
}
