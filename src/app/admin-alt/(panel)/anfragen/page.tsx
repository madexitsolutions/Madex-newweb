import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { listRequests, STATUS_LABELS, TYPE_LABELS, type InboxRequest, type RequestStatus, type RequestType } from "@/lib/server/requests";
import { dateTime } from "../../format";
import { Empty, Icon, PageHeader, Pager, Tabs, one, qs } from "../../kit";

export const metadata = { title: "Anfragen" };

type Search = { q?: string; status?: string; type?: string; email?: string; p?: string };
const PER_PAGE = 25;

const EMAIL: Record<InboxRequest["emailStatus"], { label: string; cls: string }> = {
  sent: { label: "Zugestellt", cls: "ok" },
  failed: { label: "Fehlgeschlagen", cls: "bad" },
  skipped: { label: "Kein SMTP", cls: "muted" },
  pending: { label: "Ausstehend", cls: "muted" },
};

export default async function Requests({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const raw = await searchParams;
  const sp: Search = { q: one(raw.q), status: one(raw.status), type: one(raw.type), email: one(raw.email), p: one(raw.p) };
  const q = (sp.q ?? "").toLowerCase().trim();
  const all = await listRequests();
  const matchesRest = (r: InboxRequest) =>
    (!sp.type || r.type === sp.type) && (!sp.email || r.emailStatus === sp.email) && (!q || [r.name, r.company, r.email, r.phone, r.reference, r.message, r.website].some((v) => v?.toLowerCase().includes(q)));
  const base = all.filter(matchesRest);
  const items = base.filter((r) => !sp.status || r.status === sp.status);
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(sp.p) || 1));
  const shown = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const keep = { q: sp.q, type: sp.type, email: sp.email };
  const exportQs = qs({ q: sp.q, status: sp.status, type: sp.type, email: sp.email });
  const filtered = Boolean(sp.q || sp.status || sp.type || sp.email);

  return (
    <>
      <PageHeader
        title="Anfragen"
        description="Alle Formulare der Website und Terminanfragen aus dem Chat – neueste zuerst."
        actions={
          <a className="a-btn a-btn--ghost" href={`/admin-alt/export${exportQs}`}>
            <Icon name="download" size={16} />
            Als CSV exportieren
          </a>
        }
      />

      <div className="a-toolbar">
        <Tabs
          label="Status"
          variant="segment"
          active={sp.status || "all"}
          items={[
            { key: "all", label: "Alle", count: base.length, href: `/admin-alt/anfragen${qs(keep)}` },
            ...(Object.keys(STATUS_LABELS) as RequestStatus[]).map((s) => ({ key: s, label: STATUS_LABELS[s], count: base.filter((r) => r.status === s).length, href: `/admin-alt/anfragen${qs({ ...keep, status: s })}` })),
          ]}
        />
        <form className="a-filters" role="search">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          {sp.email && <input type="hidden" name="email" value={sp.email} />}
          <label className="a-search">
            <Icon name="search" size={16} />
            <span className="sr-only">Suchen</span>
            <input name="q" type="search" defaultValue={sp.q} placeholder="Name, Firma, E-Mail, Referenz …" />
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
            Suchen
          </button>
          {filtered && (
            <Link href="/admin-alt/anfragen" className="a-btn a-btn--quiet">
              Zurücksetzen
            </Link>
          )}
        </form>
        {sp.email && (
          <p className="a-activefilter">
            Gefiltert: E-Mail {EMAIL[sp.email as InboxRequest["emailStatus"]]?.label.toLowerCase() ?? sp.email}
            <Link href={`/admin-alt/anfragen${qs({ q: sp.q, type: sp.type, status: sp.status })}`} aria-label="Filter entfernen">
              <Icon name="close" size={14} />
            </Link>
          </p>
        )}
      </div>

      <section className="a-panel a-panel--flush">
        {items.length === 0 ? (
          all.length ? (
            <Empty icon="search" title="Keine Anfrage entspricht diesen Filtern" action={<Link href="/admin-alt/anfragen" className="a-btn a-btn--ghost">Alle Anfragen anzeigen</Link>}>
              Passen Sie die Suche an oder setzen Sie die Filter zurück.
            </Empty>
          ) : (
            <Empty title="Noch keine Anfragen eingegangen">Anfragen aus dem Kontaktformular, der kostenlosen Analyse und aus dem Chat erscheinen hier automatisch.</Empty>
          )
        ) : (
          <>
            <div className="a-tablewrap">
              <table className="a-table a-table--stack">
                <thead>
                  <tr>
                    <th>Kontakt</th>
                    <th>Art</th>
                    <th>Anliegen</th>
                    <th>Eingang</th>
                    <th>E-Mail</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className={r.status === "new" ? "is-new" : undefined}>
                      <td>
                        <Link href={`/admin-alt/anfragen/${r.id}`} className="a-rowlink">
                          {r.name}
                        </Link>
                        <small>{r.company || r.email}</small>
                      </td>
                      <td>
                        {TYPE_LABELS[r.type]}
                        <small>{r.source === "orion" ? "Chat" : r.source}</small>
                      </td>
                      <td className="a-clip">{r.service || r.packageInterest || r.message || "–"}</td>
                      <td className="a-nowrap">
                        {dateTime(r.createdAt)}
                        <small>{r.reference}</small>
                      </td>
                      <td>
                        <span className={`a-state a-state--${EMAIL[r.emailStatus].cls}`}>{EMAIL[r.emailStatus].label}</span>
                      </td>
                      <td>
                        <span className={`a-pill a-pill--${r.status}`}>{STATUS_LABELS[r.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pages={pages} total={items.length} from={(page - 1) * PER_PAGE + 1} to={Math.min(page * PER_PAGE, items.length)} href={(p) => `/admin-alt/anfragen${qs({ ...keep, status: sp.status, p: p > 1 ? p : undefined })}`} />
          </>
        )}
      </section>
    </>
  );
}
