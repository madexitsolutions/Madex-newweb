/**
 * PROJEKTCODE (Madex): every website analysis from the hero form – who asked,
 * how the site scored, whether the report was opened and the e-mail sent.
 */
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import {
  Empty,
  Icon,
  PageHeader,
  Pager,
  one,
  qs,
} from "@/components/admin/kit";
import { dateTime, number } from "@/lib/format";
import {
  blockedDomains,
  budgetUsage,
  domainKey,
  listAnalyses,
  type AnalysisRow,
} from "@/lib/server/analysis/admin";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { allowRescanAction, deleteAnalysisAction } from "./actions";
import "./analysen.css";

export const metadata = { title: "Website-Analysen" };

const PER_PAGE = 25;
const VIEWS = [
  { param: "", label: "Alle" },
  { param: "ungeoeffnet", label: "Bericht nicht geöffnet" },
  { param: "schwach", label: "Unter 60 Punkten" },
  { param: "kunden", label: "Madex-Kunden" },
  { param: "fehler", label: "Fehlgeschlagen" },
] as const;

const tone = (n?: number) =>
  n === undefined
    ? "muted"
    : n >= 85
      ? "ok"
      : n >= 60
        ? "info"
        : n >= 40
          ? "warn"
          : "bad";

function Score({ row }: { row: AnalysisRow }) {
  if (row.status === "running")
    return <span className="a-pill a-pill--info">läuft</span>;
  if (row.status === "failed")
    return (
      <span className="a-pill a-pill--bad" title={row.error}>
        fehlgeschlagen
      </span>
    );
  return (
    <span className={`an-score an-score--${tone(row.score)}`}>
      {row.score ?? "–"}
    </span>
  );
}

export default async function AnalysesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("inquiries.view");
  await requireModule("inquiries");
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.param === one(sp.ansicht)) ?? VIEWS[0];
  const q = one(sp.q).trim().toLowerCase().slice(0, 100);
  const page = Math.max(1, Number(one(sp.seite)) || 1);

  const [all, usage, blocked] = await Promise.all([
    listAnalyses(),
    budgetUsage(),
    blockedDomains(),
  ]);
  const list = all.filter(
    (r) =>
      (!q || r.domain.includes(q) || r.email.toLowerCase().includes(q)) &&
      (view.param !== "ungeoeffnet" ||
        (r.status === "done" && r.views === 0)) &&
      (view.param !== "schwach" || (r.score !== undefined && r.score < 60)) &&
      (view.param !== "kunden" || r.madex) &&
      (view.param !== "fehler" || r.status === "failed"),
  );
  const rows = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Zurich",
  });
  const week = Date.now() - 7 * 86_400_000;
  const done = all.filter((r) => r.score !== undefined);
  const avg = done.length
    ? Math.round(done.reduce((n, r) => n + (r.score ?? 0), 0) / done.length)
    : 0;
  const leads = new Set(
    all
      .filter((r) => Date.parse(r.createdAt) > week)
      .map((r) => r.email.toLowerCase()),
  ).size;
  const base = { ansicht: view.param || undefined, q: q || undefined };
  const canManage = user.permissions.has("inquiries.manage");

  return (
    <>
      <PageHeader
        title="Website-Analysen"
        description="Jede Gratis-Analyse aus der Startseite: wer sie angefordert hat, wie die Website abschneidet und ob der Bericht geöffnet wurde."
      />
      <div className="a-stats">
        <div className="a-stat">
          <strong>
            {number(
              all.filter(
                (r) =>
                  new Date(r.createdAt).toLocaleDateString("en-CA", {
                    timeZone: "Europe/Zurich",
                  }) === today,
              ).length,
            )}
          </strong>
          <span>heute</span>
        </div>
        <div
          className={`a-stat${usage.day >= usage.daily ? " a-stat--warn" : ""}`}
        >
          <strong>
            {usage.day} / {usage.daily}
          </strong>
          <span>
            Kontingent heute · {usage.hour} / {usage.hourly} diese Stunde
          </span>
        </div>
        <div className="a-stat">
          <strong>{number(leads)}</strong>
          <span>Interessenten in 7 Tagen</span>
        </div>
        <div className="a-stat">
          <strong>{avg}</strong>
          <span>Ø Punkte</span>
        </div>
      </div>
      <div className="a-toolbar">
        <div className="a-toolbar__row">
          <form className="a-search" role="search" action="/admin/analysen">
            <Icon name="search" size={16} />
            <label htmlFor="an-q" className="sr-only">
              Analysen suchen
            </label>
            <input
              id="an-q"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Domain oder E-Mail"
            />
            {view.param && (
              <input type="hidden" name="ansicht" value={view.param} />
            )}
          </form>
          <div className="a-chips" role="group" aria-label="Ansicht">
            {VIEWS.map((v) => (
              <Link
                key={v.param}
                href={`/admin/analysen${qs({ ...base, ansicht: v.param || undefined })}`}
                className={`a-chip${v.param === view.param ? " is-active" : ""}`}
                scroll={false}
              >
                {v.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <section className="a-panel a-panel--flush">
        {rows.length === 0 ? (
          <Empty
            icon="sparkle"
            title={all.length ? "Keine Treffer" : "Noch keine Analysen"}
          >
            {all.length
              ? "Keine Analyse passt zur Suche oder zum Filter."
              : "Sobald jemand auf der Startseite eine Gratis-Analyse startet, erscheint sie hier."}
          </Empty>
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack an-table">
              <thead>
                <tr>
                  <th scope="col">Website</th>
                  <th scope="col">Ergebnis</th>
                  <th scope="col">Angefordert</th>
                  <th scope="col">Bericht</th>
                  <th scope="col" className="a-actions">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isBlocked =
                    blocked.get(domainKey(new URL(r.url).hostname)) === r.id;
                  return (
                    <tr key={r.id}>
                      <td className="an-site">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="a-rowlink"
                        >
                          {r.domain}
                        </a>
                        <small>
                          {r.email}
                          {r.madex && (
                            <span className="a-pill a-pill--info">
                              Madex-Kunde
                            </span>
                          )}
                        </small>
                      </td>
                      <td data-label="Ergebnis">
                        <Score row={r} />
                        {r.top && r.top.length > 0 && (
                          <small className="an-top">{r.top[0]}</small>
                        )}
                      </td>
                      <td data-label="Angefordert">
                        {dateTime(r.createdAt)}
                        {r.inquiryRef && (
                          <small>
                            <Link
                              href={`/admin/anfragen?q=${encodeURIComponent(r.inquiryRef)}`}
                              className="a-link"
                            >
                              {r.inquiryRef}
                            </Link>
                          </small>
                        )}
                      </td>
                      <td data-label="Bericht">
                        <span className={`an-flag${r.views ? " is-on" : ""}`}>
                          {r.views ? `${r.views}× geöffnet` : "nicht geöffnet"}
                        </span>
                        <span
                          className={`an-flag${r.emailSentAt ? " is-on" : ""}`}
                        >
                          {r.emailSentAt
                            ? "per E-Mail gesendet"
                            : "keine E-Mail"}
                        </span>
                      </td>
                      <td className="a-actions an-actions">
                        {r.status === "done" && (
                          <>
                            <a
                              href={`/admin/analysen/${r.id}/bericht`}
                              target="_blank"
                              rel="noopener"
                              className="a-btn a-btn--quiet a-btn--sm"
                            >
                              <Icon name="eye" size={15} />
                              Bericht
                            </a>
                            <a
                              href={`/admin/analysen/${r.id}/bericht?pdf=1`}
                              className="a-btn a-btn--quiet a-btn--sm"
                            >
                              <Icon name="download" size={15} />
                              PDF
                            </a>
                          </>
                        )}
                        {canManage && isBlocked && (
                          <ActionButton
                            action={allowRescanAction}
                            fields={{ id: r.id, domain: r.domain }}
                            label="Neu erlauben"
                            variant="quiet"
                            pending="…"
                            question={`${r.domain} wieder für eine neue Analyse freigeben? Der bisherige Bericht bleibt erhalten.`}
                          />
                        )}
                        {canManage && (
                          <ActionButton
                            action={deleteAnalysisAction}
                            fields={{ id: r.id, domain: r.domain }}
                            label="Löschen"
                            variant="quiet"
                            pending="…"
                            question={`Analyse für ${r.domain} mit Bericht und Bildern löschen?`}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          page={page}
          pages={pages}
          total={list.length}
          from={list.length ? (page - 1) * PER_PAGE + 1 : 0}
          to={Math.min(list.length, page * PER_PAGE)}
          href={(p) =>
            `/admin/analysen${qs({ ...base, seite: p > 1 ? p : undefined })}`
          }
        />
      </section>
    </>
  );
}
