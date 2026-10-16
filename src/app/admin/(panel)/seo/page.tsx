import Link from "next/link";
import { eq } from "drizzle-orm";
import { Drawer } from "@/components/admin/drawer";
import { ConfirmForm } from "@/components/admin/forms";
import { Empty, Icon, PageHeader, Pager, one, qs } from "@/components/admin/kit";
import { number } from "@/lib/format";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { media } from "@/server/db/schema";
import { SEO_LIMITS, descState, getSeo, listSeo, seoSummary, titleState, type SeoFilter } from "@/server/content/seo";
import { getSettings } from "@/server/settings";
import { deleteSeoAction } from "./actions";
import { SeoEntryForm, SitemapImport, type SeoFormEntry } from "./client";
import "../../content.css";

export const metadata = { title: "SEO" };

const PER_PAGE = 25;
const FILTERS: { key: SeoFilter; param: string; label: string }[] = [
  { key: "all", param: "", label: "Alle" },
  { key: "title_long", param: "titel-zu-lang", label: "Titel zu lang" },
  { key: "title_missing", param: "titel-fehlt", label: "Titel fehlt" },
  { key: "desc_missing", param: "beschreibung-fehlt", label: "Beschreibung fehlt" },
  { key: "desc_range", param: "beschreibung-laenge", label: "Beschreibung zu kurz/lang" },
  { key: "noindex", param: "noindex", label: "noindex" },
];

function Len({ value, state, max }: { value: string | null; state: "ok" | "warn" | "bad"; max: number }) {
  const n = (value ?? "").trim().length;
  const label = n === 0 ? "fehlt" : `${n} Zeichen`;
  return (
    <span className={`a-len a-len--${state}`} title={state === "ok" ? "Länge passt" : n === 0 ? "Fehlt" : "Ausserhalb der empfohlenen Länge"}>
      <span className="a-len__bar" aria-hidden="true">
        <i style={{ width: `${Math.min(100, (n / max) * 100)}%` }} />
      </span>
      <span className="a-len__num">{label}</span>
    </span>
  );
}

export default async function SeoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("seo.manage");
  await requireModule("seo");
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.param === one(sp.filter)) ?? FILTERS[0];
  const q = one(sp.q).trim().slice(0, 100);
  const page = Math.max(1, Number(one(sp.seite)) || 1);
  const editPath = one(sp.bearbeiten);
  const isNew = one(sp.neu) === "1";

  const [{ rows, total }, sum, general, editing] = await Promise.all([listSeo({ q, filter: filter.key }, page, PER_PAGE), seoSummary(), getSettings("general"), editPath ? getSeo(editPath) : null]);
  let siteHost = "ihre-website.ch";
  try {
    if (general.siteUrl) siteHost = new URL(general.siteUrl).host;
  } catch {
    /* placeholder */
  }
  let ogMedia: SeoFormEntry["ogMedia"] = null;
  const m = editing?.ogImage?.match(/\/uploads\/(.+)$/);
  if (m) {
    const [row] = await db.select().from(media).where(eq(media.path, decodeURI(m[1])));
    if (row) ogMedia = { id: row.id, path: row.path, alt: row.alt, filename: row.filename, mime: row.mime };
  }
  const base = { filter: filter.param || undefined, q, seite: page > 1 ? page : undefined };
  const closeHref = `/admin/seo${qs(base)}`;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const descProblems = sum.descMissing + sum.descRange;

  return (
    <>
      <PageHeader
        title="SEO"
        description="Titel, Beschreibungen und Indexierung je Seite der verbundenen Website. Die Website liest die Angaben über die API."
        actions={
          <>
            <SitemapImport siteUrl={general.siteUrl} />
            <Link href={`/admin/seo${qs({ ...base, neu: 1 })}`} className="a-btn a-btn--primary" scroll={false}>
              <Icon name="plus" size={16} />
              Pfad hinzufügen
            </Link>
          </>
        }
      />
      <div className="a-stats sx-stats">
        <Link href="/admin/seo" className={`a-stat${filter.key === "all" ? " is-active" : ""}`}>
          <strong>{number(sum.total)}</strong>
          <span>Seiten erfasst</span>
        </Link>
        <Link href="/admin/seo?filter=titel-zu-lang" className={`a-stat${sum.titleLong ? " a-stat--warn" : ""}${filter.key === "title_long" ? " is-active" : ""}`}>
          <strong>{number(sum.titleLong)}</strong>
          <span>Titel über {SEO_LIMITS.titleMax} Zeichen</span>
        </Link>
        <Link href="/admin/seo?filter=titel-fehlt" className={`a-stat${sum.titleMissing ? " a-stat--warn" : ""}${filter.key === "title_missing" ? " is-active" : ""}`}>
          <strong>{number(sum.titleMissing)}</strong>
          <span>ohne Titel</span>
        </Link>
        <Link href="/admin/seo?filter=beschreibung-fehlt" className={`a-stat${sum.descMissing ? " a-stat--warn" : ""}${filter.key === "desc_missing" ? " is-active" : ""}`}>
          <strong>{number(sum.descMissing)}</strong>
          <span>ohne Beschreibung</span>
        </Link>
        <Link href="/admin/seo?filter=beschreibung-laenge" className={`a-stat${sum.descRange ? " a-stat--warn" : ""}${filter.key === "desc_range" ? " is-active" : ""}`}>
          <strong>{number(sum.descRange)}</strong>
          <span>
            Beschreibung nicht {SEO_LIMITS.descMin}–{SEO_LIMITS.descMax}
          </span>
        </Link>
        <Link href="/admin/seo?filter=noindex" className={`a-stat${filter.key === "noindex" ? " is-active" : ""}`}>
          <strong>{number(sum.noindex)}</strong>
          <span>auf noindex</span>
        </Link>
      </div>
      <div className="a-toolbar">
        <div className="a-toolbar__row">
          <form className="a-search" role="search" action="/admin/seo">
            <Icon name="search" size={16} />
            <label htmlFor="sx-q" className="sr-only">
              Seiten suchen
            </label>
            <input id="sx-q" type="search" name="q" defaultValue={q} placeholder="Pfad, Titel oder Beschreibung" />
            {filter.param && <input type="hidden" name="filter" value={filter.param} />}
          </form>
          <div className="a-chips" role="group" aria-label="Filter">
            {FILTERS.map((f) => (
              <Link key={f.key} href={`/admin/seo${qs({ q, filter: f.param || undefined })}`} className={`a-chip${f.key === filter.key ? " is-active" : ""}`} aria-current={f.key === filter.key ? "true" : undefined} scroll={false}>
                {f.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <section className="a-panel a-panel--flush">
        {rows.length === 0 ? (
          sum.total === 0 ? (
            <Empty
              icon="search"
              title="Noch keine Seiten erfasst"
              action={
                <Link href="/admin/seo?neu=1" className="a-btn a-btn--primary" scroll={false}>
                  Ersten Pfad hinzufügen
                </Link>
              }
            >
              Übernehmen Sie alle Seiten mit «Pfade aus Sitemap übernehmen» oder fügen Sie einzelne Pfade hinzu.
            </Empty>
          ) : (
            <Empty icon="check" title={filter.key === "all" ? "Keine Treffer" : "Nichts zu beanstanden"}>
              {filter.key === "all" ? "Kein Pfad passt zur Suche." : "Keine Seite fällt unter diesen Filter."}{" "}
              <Link href="/admin/seo" className="a-link">
                Alle Seiten anzeigen
              </Link>
            </Empty>
          )
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack a-table--seo">
              <thead>
                <tr>
                  <th scope="col">Seite</th>
                  <th scope="col">
                    Titel <span className="a-th-hint">bis {SEO_LIMITS.titleMax}</span>
                  </th>
                  <th scope="col">
                    Beschreibung <span className="a-th-hint">
                      {SEO_LIMITS.descMin}–{SEO_LIMITS.descMax}
                    </span>
                  </th>
                  <th scope="col">Index</th>
                  <th scope="col" className="a-actions">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.path} className={r.path === editPath ? "is-selected" : undefined}>
                    <td className="a-seo-page">
                      <Link href={`/admin/seo${qs({ ...base, bearbeiten: r.path })}`} className="a-rowlink a-mono-path" scroll={false}>
                        {r.path}
                      </Link>
                      <small>{r.title || <span className="a-muted">Kein eigener Titel</span>}</small>
                    </td>
                    <td data-label="Titel">
                      <Len value={r.title} state={titleState(r.title)} max={SEO_LIMITS.titleMax} />
                    </td>
                    <td data-label="Beschreibung">
                      <Len value={r.description} state={descState(r.description)} max={SEO_LIMITS.descMax} />
                    </td>
                    <td data-label="Index">{r.noindex ? <span className="a-pill a-pill--warn">noindex</span> : <span className="a-state a-state--ok">indexiert</span>}</td>
                    <td className="a-actions">
                      <Link href={`/admin/seo${qs({ ...base, bearbeiten: r.path })}`} className="a-btn a-btn--quiet a-btn--sm" scroll={false} aria-label={`${r.path} bearbeiten`}>
                        <Icon name="edit" size={15} />
                        Bearbeiten
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pages={pages} total={total} from={total ? (page - 1) * PER_PAGE + 1 : 0} to={Math.min(total, page * PER_PAGE)} href={(p) => `/admin/seo${qs({ ...base, seite: p > 1 ? p : undefined })}`} />
      </section>
      {(isNew || editPath) && (
        <Drawer closeHref={closeHref} title={isNew ? "Pfad hinzufügen" : editing ? editing.path : "Eintrag nicht gefunden"} subtitle={isNew ? "SEO-Angaben für eine Seite der Website" : editing ? `${siteHost}${editing.path}` : undefined}>
          {isNew || editing ? (
            <>
              <SeoEntryForm
                key={editing?.path ?? "neu"}
                siteHost={siteHost}
                canMedia={user.permissions.has("media.manage")}
                saved={one(sp.gespeichert) === "1"}
                entry={editing ? { path: editing.path, title: editing.title ?? "", description: editing.description ?? "", canonical: editing.canonical ?? "", ogImage: editing.ogImage ?? "", noindex: editing.noindex, ogMedia } : null}
              />
              {editing && (
                <div className="a-danger a-danger--inset">
                  <div>
                    <h2>Eintrag löschen</h2>
                    <p>Die Website verwendet danach wieder ihre eigenen Standardangaben.</p>
                  </div>
                  <ConfirmForm action={deleteSeoAction} label="Löschen" question={`SEO-Eintrag für ${editing.path} löschen?`}>
                    <input type="hidden" name="path" value={editing.path} />
                  </ConfirmForm>
                </div>
              )}
            </>
          ) : (
            <div className="mx-detail">
              <p className="a-muted">Für diesen Pfad gibt es keinen Eintrag mehr.</p>
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}
