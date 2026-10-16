import Link from "next/link";
import { Empty, Icon, PageHeader, Pager, Tabs, one, qs } from "@/components/admin/kit";
import { relative, dateTime } from "@/lib/format";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { INQUIRY_STATUS, inquiryCounts, inquiryForms, listInquiries } from "@/server/content/inquiries";
import { STATUS_TABS, readFilters } from "./filters";
import "../../content.css";

export const metadata = { title: "Anfragen" };

const PER_PAGE = 25;

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("inquiries.view");
  await requireModule("inquiries");
  const sp = await searchParams;
  const { tab, filter, params } = readFilters(sp);
  const page = Math.max(1, Number(one(sp.seite)) || 1);
  const [{ rows, total }, counts, forms] = await Promise.all([listInquiries(filter, page, PER_PAGE), inquiryCounts(filter), inquiryForms()]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const filtered = Boolean(filter.q || filter.form || filter.from || filter.to);
  const now = new Date().getTime();

  return (
    <>
      <PageHeader
        title="Anfragen"
        description="Kontakt- und Offertanfragen aus den Formularen der Website."
        actions={
          <a href={`/admin/anfragen/export${qs(params)}`} className="a-btn a-btn--ghost" download>
            <Icon name="download" size={16} />
            CSV exportieren
          </a>
        }
      />
      {one(sp.geloescht) === "1" && (
        <p className="a-alert a-alert--ok" role="status">
          Anfrage gelöscht.
        </p>
      )}
      <div className="a-toolbar">
        <Tabs label="Status" active={tab.key} items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key], href: `/admin/anfragen${qs({ ...params, status: t.param || undefined })}` }))} />
        <form className="iq-filters" role="search" action="/admin/anfragen">
          {tab.param && <input type="hidden" name="status" value={tab.param} />}
          <label className="a-search">
            <Icon name="search" size={16} />
            <span className="sr-only">Anfragen suchen</span>
            <input type="search" name="q" defaultValue={filter.q} placeholder="Name, E-Mail, Firma, Text oder Referenz" />
          </label>
          <label className="a-field">
            <span className="sr-only">Formular</span>
            <select name="formular" defaultValue={filter.form}>
              <option value="">Alle Formulare</option>
              {forms.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="a-field iq-date">
            <span>Von</span>
            <input type="date" name="von" defaultValue={filter.from} />
          </label>
          <label className="a-field iq-date">
            <span>Bis</span>
            <input type="date" name="bis" defaultValue={filter.to} />
          </label>
          <button type="submit" className="a-btn a-btn--ghost">
            Filtern
          </button>
          {filtered && (
            <Link href={`/admin/anfragen${qs({ status: tab.param || undefined })}`} className="a-btn a-btn--quiet">
              Zurücksetzen
            </Link>
          )}
        </form>
      </div>
      <section className="a-panel a-panel--flush">
        {rows.length === 0 ? (
          filtered ? (
            <Empty icon="search" title="Keine Anfragen gefunden">
              Keine Anfrage passt zu den Filtern.{" "}
              <Link href={`/admin/anfragen${qs({ status: tab.param || undefined })}`} className="a-link">
                Filter zurücksetzen
              </Link>
            </Empty>
          ) : tab.key === "new" ? (
            <Empty icon="check" title="Keine neuen Anfragen">
              Alles beantwortet. Neue Anfragen aus den Formularen der Website erscheinen hier – mit E-Mail-Hinweis an die Empfänger unter Einstellungen → E-Mail.
            </Empty>
          ) : (
            <Empty icon="inbox" title={`Keine Anfragen mit Status «${tab.label}»`}>
              {tab.key === "spam" ? "Der Spamfilter hat nichts aussortiert." : "Hier erscheinen Anfragen, sobald sie diesen Status haben."}
            </Empty>
          )
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack iq-table">
              <thead>
                <tr>
                  <th scope="col">Von</th>
                  <th scope="col">Betreff / Nachricht</th>
                  <th scope="col">Formular</th>
                  <th scope="col">Status</th>
                  <th scope="col">Eingang</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.status === "new" ? "is-new" : undefined}>
                    <td>
                      <Link href={`/admin/anfragen/${r.id}`} className="a-rowlink">
                        {r.name || r.email}
                      </Link>
                      <small>
                        {r.company ? `${r.company} · ` : ""}
                        {r.name ? r.email : r.reference}
                      </small>
                    </td>
                    <td className="iq-msg">
                      <span className="iq-msg__subject">{r.subject || <span className="a-muted">Ohne Betreff</span>}</span>
                      <small>{r.message.slice(0, 160)}</small>
                    </td>
                    <td data-label="Formular">
                      <span className="a-tag">{r.form}</span>
                    </td>
                    <td data-label="Status">
                      <span className={`a-pill a-pill--${INQUIRY_STATUS[r.status].pill}`}>{INQUIRY_STATUS[r.status].label}</span>
                    </td>
                    <td data-label="Eingang" className="a-nowrap">
                      <time dateTime={r.createdAt.toISOString()} title={dateTime(r.createdAt)}>
                        {relative(r.createdAt, now)}
                      </time>
                      <small className="a-mono-cell">{r.reference}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pages={pages} total={total} from={total ? (page - 1) * PER_PAGE + 1 : 0} to={Math.min(total, page * PER_PAGE)} href={(p) => `/admin/anfragen${qs({ ...params, seite: p > 1 ? p : undefined })}`} />
      </section>
    </>
  );
}
