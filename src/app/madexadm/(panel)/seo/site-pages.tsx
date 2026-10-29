/**
 * SEO page when the project lists its pages (src/site/project.ts → seoPages):
 * every page of the website with its rating; a click opens the editor.
 */
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Drawer } from "@/components/admin/drawer";
import { ConfirmForm } from "@/components/admin/forms";
import { Empty, Icon, PageHeader, Pager, qs } from "@/components/admin/kit";
import { number } from "@/lib/format";
import { db } from "@/server/db";
import { media } from "@/server/db/schema";
import { GSC_DAYS, searchConsolePages, searchConsoleQueries, type GscStats } from "@/server/analytics/search-console";
import { getSeo, ratedPages, seoGrade, type RatedPage, type SitePage } from "@/server/content/seo";
import { deleteSeoAction } from "./actions";
import { SeoEntryForm, type SeoFormEntry } from "./client";
import "./seo.css";

const PER_PAGE = 25;
const VIEWS = [
  { param: "", label: "Alle" },
  { param: "verbessern", label: "Verbesserungsbedarf" },
  { param: "angepasst", label: "Angepasst" },
] as const;

function Rating({ page }: { page: RatedPage }) {
  const g = seoGrade(page.score);
  const open = page.checks.find((c) => !c.ok);
  return (
    <div className={`sx-rate sx-rate--${g.tone}`}>
      <div className="sx-rate__top">
        <span className="sx-rate__label">{g.label}</span>
        <strong className="sx-rate__n">{page.score}</strong>
      </div>
      <span className="sx-rate__bar" aria-hidden="true">
        <i style={{ width: `${page.score}%` }} />
      </span>
      <small className="sx-rate__hint">{open ? open.issue : "Alles erfüllt"}</small>
    </div>
  );
}

const pos = (n: number) => n.toLocaleString("de-CH", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const pct = (n: number) => `${(n * 100).toLocaleString("de-CH", { maximumFractionDigits: 1 })} %`;

function Google({ g }: { g?: GscStats }) {
  if (!g) return <span className="sx-gsc sx-gsc--none">Keine Klicks</span>;
  return (
    <span className="sx-gsc">
      <span>
        <strong>{number(g.clicks)}</strong> Klicks
      </span>
      <small>
        {number(g.impressions)}× gezeigt, Pos. {pos(g.position)}
      </small>
    </span>
  );
}

export async function SitePagesView({
  defaults,
  sp,
  siteHost,
  canMedia,
}: {
  defaults: SitePage[];
  sp: { view: string; group: string; q: string; page: number; edit: string; saved: boolean; sort: string };
  siteHost: string;
  canMedia: boolean;
}) {
  const [all, gsc] = await Promise.all([ratedPages(defaults), searchConsolePages(siteHost)]);
  const google = gsc.configured && "report" in gsc ? gsc.report : null;
  const groups = [...new Set(all.map((p) => p.group))];
  const ql = sp.q.toLowerCase();
  let list = all.filter(
    (p) =>
      (!sp.group || p.group === sp.group) &&
      (sp.view !== "verbessern" || p.score < 70) &&
      (sp.view !== "angepasst" || p.custom) &&
      (!ql || p.path.toLowerCase().includes(ql) || p.title.toLowerCase().includes(ql) || p.description.toLowerCase().includes(ql)),
  );
  if (sp.sort === "bewertung") list = [...list].sort((a, b) => a.score - b.score);
  if (sp.sort === "klicks" && google) list = [...list].sort((a, b) => (google.pages[b.path]?.clicks ?? -1) - (google.pages[a.path]?.clicks ?? -1) || (google.pages[b.path]?.impressions ?? 0) - (google.pages[a.path]?.impressions ?? 0));
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const rows = list.slice((sp.page - 1) * PER_PAGE, sp.page * PER_PAGE);
  const avg = all.length ? Math.round(all.reduce((n, p) => n + p.score, 0) / all.length) : 0;
  const weak = all.filter((p) => p.score < 70).length;
  const custom = all.filter((p) => p.custom).length;

  const base = { ansicht: sp.view || undefined, gruppe: sp.group || undefined, q: sp.q || undefined, sort: sp.sort || undefined, seite: sp.page > 1 ? sp.page : undefined };
  const closeHref = `/madexadm/seo${qs(base)}`;
  const editing = sp.edit ? all.find((p) => p.path === sp.edit) : undefined;

  const queries = editing && google ? await searchConsoleQueries(siteHost, editing.path) : [];
  let entry: SeoFormEntry | null = null;
  if (editing) {
    const saved = await getSeo(editing.path);
    let ogMedia: SeoFormEntry["ogMedia"] = null;
    const m = saved?.ogImage?.match(/\/uploads\/(.+)$/);
    if (m) {
      const [row] = await db.select().from(media).where(eq(media.path, decodeURI(m[1])));
      if (row) ogMedia = { id: row.id, path: row.path, alt: row.alt, filename: row.filename, mime: row.mime };
    }
    entry = { path: editing.path, title: editing.title, description: editing.description, canonical: saved?.canonical ?? "", ogImage: saved?.ogImage ?? "", noindex: editing.noindex, ogMedia };
  }

  return (
    <>
      <PageHeader title="SEO" description="Titel, Beschreibung und Vorschaubild jeder Seite der Website – so erscheint sie bei Google. Klicken Sie auf eine Seite, um ihre Angaben zu ändern." />
      <div className="a-stats sx-stats">
        <Link href="/madexadm/seo" className={`a-stat${!sp.view ? " is-active" : ""}`}>
          <strong>{number(all.length)}</strong>
          <span>Seiten</span>
        </Link>
        <div className="a-stat">
          <strong>{avg}</strong>
          <span>Ø SEO-Bewertung</span>
        </div>
        <Link href="/madexadm/seo?ansicht=verbessern&sort=bewertung" className={`a-stat${weak ? " a-stat--warn" : ""}${sp.view === "verbessern" ? " is-active" : ""}`}>
          <strong>{number(weak)}</strong>
          <span>mit Verbesserungsbedarf</span>
        </Link>
        <Link href="/madexadm/seo?ansicht=angepasst" className={`a-stat${sp.view === "angepasst" ? " is-active" : ""}`}>
          <strong>{number(custom)}</strong>
          <span>im Dashboard angepasst</span>
        </Link>
        {google && (
          <Link href={`/madexadm/seo${qs({ ...base, sort: "klicks", seite: undefined })}`} className={`a-stat${sp.sort === "klicks" ? " is-active" : ""}`}>
            <strong>{number(google.totals.clicks)}</strong>
            <span>Klicks von Google ({GSC_DAYS} Tage)</span>
          </Link>
        )}
      </div>
      {!gsc.configured && (
        <p className="sx-note">
          <Icon name="search" size={15} />
          <span>
            Klicks und Position bei Google erscheinen hier, sobald die Search Console verbunden ist: das Dienstkonto von Google Analytics in .env eintragen (<code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code>, <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code>) und seine E-Mail-Adresse in der Search Console als Nutzer hinzufügen.
          </span>
        </p>
      )}
      {gsc.configured && "error" in gsc && (
        <p className="sx-note sx-note--warn" role="status">
          <Icon name="alert" size={15} />
          <span>Search Console: {gsc.error}</span>
        </p>
      )}
      <div className="a-toolbar">
        <div className="a-toolbar__row">
          <form className="a-search" role="search" action="/madexadm/seo">
            <Icon name="search" size={16} />
            <label htmlFor="sx-q" className="sr-only">
              Seiten suchen
            </label>
            <input id="sx-q" type="search" name="q" defaultValue={sp.q} placeholder="Seite, Titel oder Beschreibung" />
            {sp.view && <input type="hidden" name="ansicht" value={sp.view} />}
            {sp.group && <input type="hidden" name="gruppe" value={sp.group} />}
          </form>
          <div className="a-chips" role="group" aria-label="Bereich">
            <Link href={`/madexadm/seo${qs({ ...base, gruppe: undefined, seite: undefined })}`} className={`a-chip${!sp.group ? " is-active" : ""}`} scroll={false}>
              Alle Bereiche
            </Link>
            {groups.map((g) => (
              <Link key={g} href={`/madexadm/seo${qs({ ...base, gruppe: g, seite: undefined })}`} className={`a-chip${sp.group === g ? " is-active" : ""}`} scroll={false}>
                {g}
              </Link>
            ))}
          </div>
        </div>
        <div className="a-toolbar__row sx-views">
          <div className="a-chips" role="group" aria-label="Ansicht">
            {VIEWS.map((v) => (
              <Link key={v.param} href={`/madexadm/seo${qs({ ...base, ansicht: v.param || undefined, seite: undefined })}`} className={`a-chip${sp.view === v.param ? " is-active" : ""}`} scroll={false}>
                {v.label}
              </Link>
            ))}
          </div>
          <div className="a-chips" role="group" aria-label="Sortierung">
            {[
              { key: "", label: "Seitenreihenfolge" },
              { key: "bewertung", label: "Schwächste zuerst" },
              ...(google ? [{ key: "klicks", label: "Meiste Klicks" }] : []),
            ].map((o) => (
              <Link key={o.key} href={`/madexadm/seo${qs({ ...base, sort: o.key || undefined, seite: undefined })}`} className={`a-chip${sp.sort === o.key ? " is-active" : ""}`} scroll={false}>
                {o.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <section className="a-panel a-panel--flush">
        {rows.length === 0 ? (
          <Empty icon="check" title={sp.view === "verbessern" ? "Nichts zu verbessern" : "Keine Treffer"}>
            {sp.view === "verbessern" ? "Alle Seiten haben eine gute SEO-Bewertung." : "Keine Seite passt zur Suche."}{" "}
            <Link href="/madexadm/seo" className="a-link">
              Alle Seiten anzeigen
            </Link>
          </Empty>
        ) : (
          <ul className="sx-list">
            {rows.map((p) => (
              <li key={p.path}>
                <Link href={`/madexadm/seo${qs({ ...base, bearbeiten: p.path })}`} className={`sx-row${google ? " sx-row--gsc" : ""}${p.path === sp.edit ? " is-selected" : ""}`} scroll={false}>
                  <span className="sx-row__main">
                    <span className="sx-row__title">{p.title || <em className="a-muted">Ohne Titel</em>}</span>
                    <span className="sx-row__meta">
                      <span className="a-mono-path">{p.path}</span>
                      <span className="sx-row__group">{p.group}</span>
                      {p.custom && <span className="a-pill a-pill--info">angepasst</span>}
                      {p.noindex && <span className="a-pill a-pill--warn">noindex</span>}
                    </span>
                  </span>
                  {google && <Google g={google.pages[p.path]} />}
                  <Rating page={p} />
                  <Icon name="arrow" size={16} className="sx-row__go" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pager page={sp.page} pages={pages} total={total} from={total ? (sp.page - 1) * PER_PAGE + 1 : 0} to={Math.min(total, sp.page * PER_PAGE)} href={(n) => `/madexadm/seo${qs({ ...base, seite: n > 1 ? n : undefined })}`} />
      </section>

      {sp.edit && (
        <Drawer closeHref={closeHref} title={editing ? editing.title || editing.path : "Seite nicht gefunden"} subtitle={editing ? `${siteHost}${editing.path}` : undefined}>
          {editing && entry ? (
            <>
              <div className={`sx-score sx-score--${seoGrade(editing.score).tone}`}>
                <div className="sx-score__head">
                  <strong>{editing.score}</strong>
                  <span>
                    SEO-Bewertung: {seoGrade(editing.score).label}
                    <small>{editing.custom ? "Im Dashboard angepasst" : "Standardangaben der Website"}</small>
                  </span>
                </div>
                <ul className="sx-score__list">
                  {editing.checks.map((c) => (
                    <li key={c.label} className={c.ok ? "is-ok" : "is-open"}>
                      <Icon name={c.ok ? "check" : "alert"} size={14} />
                      <span>
                        {c.ok ? c.label : c.issue}
                        {!c.ok && <small>{c.hint}</small>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {google && (
                <div className="sx-google">
                  <h3>
                    Bei Google <small>letzte {GSC_DAYS} Tage</small>
                  </h3>
                  {google.pages[editing.path] ? (
                    <>
                      <dl className="sx-google__kpis">
                        <div>
                          <dt>Klicks</dt>
                          <dd>{number(google.pages[editing.path].clicks)}</dd>
                        </div>
                        <div>
                          <dt>Gezeigt</dt>
                          <dd>{number(google.pages[editing.path].impressions)}</dd>
                        </div>
                        <div>
                          <dt>Klickrate</dt>
                          <dd>{pct(google.pages[editing.path].ctr)}</dd>
                        </div>
                        <div>
                          <dt>Ø Position</dt>
                          <dd>{pos(google.pages[editing.path].position)}</dd>
                        </div>
                      </dl>
                      {queries.length > 0 && (
                        <table className="a-table sx-google__q">
                          <caption className="sr-only">Suchbegriffe</caption>
                          <thead>
                            <tr>
                              <th scope="col">Gesucht nach</th>
                              <th scope="col" className="a-num">
                                Klicks
                              </th>
                              <th scope="col" className="a-num">
                                Pos.
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {queries.map((q) => (
                              <tr key={q.query}>
                                <td>{q.query}</td>
                                <td className="a-num">{number(q.clicks)}</td>
                                <td className="a-num">{pos(q.position)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {google.pages[editing.path].impressions > 50 && google.pages[editing.path].ctr < 0.02 && <p className="sx-google__tip">Die Seite wird oft gezeigt, aber selten angeklickt. Ein klarerer Titel und eine Beschreibung mit Nutzen für den Leser erhöhen die Klickrate.</p>}
                    </>
                  ) : (
                    <p className="a-muted">In diesem Zeitraum hat Google die Seite in keiner Suche gezeigt. Gute Titel, Beschreibungen und Links von anderen Seiten helfen.</p>
                  )}
                </div>
              )}
              <SeoEntryForm key={editing.path} fixedPath siteHost={siteHost} canMedia={canMedia} saved={sp.saved} entry={entry} imageHint={editing.defaults?.image ? "Leer lassen = Bild der Seite" : undefined} />
              {editing.custom && (
                <div className="a-danger a-danger--inset">
                  <div>
                    <h2>Auf Standard zurücksetzen</h2>
                    <p>Die Seite verwendet danach wieder die Angaben aus der Website.</p>
                  </div>
                  <ConfirmForm action={deleteSeoAction} label="Zurücksetzen" question={`Änderungen für ${editing.path} verwerfen?`}>
                    <input type="hidden" name="path" value={editing.path} />
                  </ConfirmForm>
                </div>
              )}
            </>
          ) : (
            <div className="mx-detail">
              <p className="a-muted">Diese Seite gibt es nicht (mehr).</p>
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}
