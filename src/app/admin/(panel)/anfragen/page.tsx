import Link from "next/link";
import { listRequests, STATUS_LABELS, TYPE_LABELS, type RequestStatus, type RequestType } from "@/lib/server/requests";
import { dateTime } from "../../format";

export const metadata = { title: "Anfragen" };

type Search = { q?: string; status?: string; type?: string; email?: string };

export default async function Requests({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").toLowerCase().trim();
  const all = await listRequests();
  const items = all.filter(
    (r) =>
      (!sp.status || r.status === sp.status) &&
      (!sp.type || r.type === sp.type) &&
      (!sp.email || r.emailStatus === sp.email) &&
      (!q || [r.name, r.company, r.email, r.phone, r.reference, r.message, r.website].some((v) => v?.toLowerCase().includes(q))),
  );
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <header className="a-head a-head--row">
        <div>
          <h1>Anfragen</h1>
          <p className="a-muted">Alle Formulare der Website und Terminanfragen aus dem Chat.</p>
        </div>
        <a className="a-btn a-btn--ghost" href={`/admin/export${exportQs ? "?" + exportQs : ""}`}>
          Als CSV exportieren
        </a>
      </header>

      <form className="a-filters" role="search">
        <label className="a-field a-field--grow">
          <span className="sr-only">Suchen</span>
          <input name="q" defaultValue={sp.q} placeholder="Name, Firma, E-Mail, Referenz …" />
        </label>
        <label className="a-field">
          <span className="sr-only">Status</span>
          <select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Alle Status</option>
            {(Object.keys(STATUS_LABELS) as RequestStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span className="sr-only">Art</span>
          <select name="type" defaultValue={sp.type ?? ""}>
            <option value="">Alle Arten</option>
            {(Object.keys(TYPE_LABELS) as RequestType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <button className="a-btn a-btn--primary" type="submit">
          Filtern
        </button>
        {(sp.q || sp.status || sp.type || sp.email) && (
          <Link href="/admin/anfragen" className="a-btn a-btn--ghost">
            Zurücksetzen
          </Link>
        )}
      </form>

      <section className="a-panel a-panel--flush">
        {items.length === 0 ? (
          <p className="a-empty">{all.length ? "Keine Anfrage entspricht diesen Filtern." : "Noch keine Anfragen eingegangen."}</p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>Eingang</th>
                <th>Kontakt</th>
                <th>Art</th>
                <th>Anliegen</th>
                <th>E-Mail</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className={r.status === "new" ? "is-new" : undefined}>
                  <td>
                    {dateTime(r.createdAt)}
                    <small>{r.reference}</small>
                  </td>
                  <td>
                    <Link href={`/admin/anfragen/${r.id}`}>{r.name}</Link>
                    <small>{r.company || r.email}</small>
                  </td>
                  <td>
                    {TYPE_LABELS[r.type]}
                    <small>{r.source === "orion" ? "Chat" : r.source}</small>
                  </td>
                  <td className="a-clip">{r.service || r.packageInterest || r.message || "–"}</td>
                  <td>{r.emailStatus === "sent" ? "Zugestellt" : r.emailStatus === "failed" ? <span className="a-warn">Fehlgeschlagen</span> : r.emailStatus === "skipped" ? "Kein SMTP" : "Ausstehend"}</td>
                  <td>
                    <span className={`a-pill a-pill--${r.status}`}>{STATUS_LABELS[r.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="a-muted a-small">{items.length} von {all.length} Anfragen</p>
    </>
  );
}
