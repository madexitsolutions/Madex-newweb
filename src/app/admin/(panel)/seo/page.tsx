import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { allSeoPages, type SeoPage } from "@/lib/seo-pages";
import { getSettings } from "@/lib/server/settings";
import { site } from "@/content/site";
import { Drawer } from "../../drawer";
import { Empty, Icon, PageHeader, Pager, Tabs, one, qs } from "../../kit";
import { SeoEditor } from "./editor";
import { DESC_MAX, DESC_MIN, TITLE_MAX, evaluate } from "./rules";

export const metadata = { title: "SEO" };

const PER_PAGE = 20;

const GROUPS: { key: string; label: string; group?: SeoPage["group"] }[] = [
  { key: "", label: "Alle" },
  { key: "seiten", label: "Seiten", group: "Seiten" },
  { key: "leistungen", label: "Leistungen", group: "Leistungen" },
  { key: "projekte", label: "Projekte", group: "Beiträge" },
];

const FILTERS = [
  { key: "", label: "Alle" },
  { key: "probleme", label: "Nur Probleme" },
  { key: "angepasst", label: "Angepasst" },
  { key: "noindex", label: "Noindex" },
];

/** Filters reachable from the summary tiles. */
const DETAIL: Record<string, string> = { titel: "Titel zu lang", lang: "Beschreibung zu lang", kurz: "Beschreibung fehlt/kurz" };

/** Display name of a group from allSeoPages() (the "Beiträge" group only holds portfolio projects). */
const groupLabel = (g: SeoPage["group"]) => (g === "Beiträge" ? "Projekte" : g);

function Length({ n, max, min, label }: { n: number; max: number; min?: number; label: string }) {
  const state = n > max ? "bad" : min !== undefined && n < min ? "warn" : "ok";
  const hint = state === "bad" ? "zu lang" : state === "warn" ? "zu kurz" : "gut";
  return (
    <span className={`a-len a-len--${state}`} title={`${label}: ${n} von ${max} Zeichen (${hint})`}>
      <span className="a-len__bar" aria-hidden="true">
        <i style={{ width: `${Math.min(100, (n / max) * 100)}%` }} />
      </span>
      <span className="a-len__num">{n}</span>
      <span className="sr-only">
        {" "}
        Zeichen, {hint}
      </span>
    </span>
  );
}

export default async function Seo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const groupKey = GROUPS.some((g) => g.key === one(sp.group)) ? one(sp.group) : "";
  const filter = FILTERS.some((f) => f.key === one(sp.f)) || Object.hasOwn(DETAIL, one(sp.f)) ? one(sp.f) : "";
  const q = one(sp.q).toLowerCase().trim();
  const editPath = one(sp.edit);
  const { seo } = await getSettings();

  const rows = allSeoPages().map((p) => ({ page: p, o: seo[p.path], ...evaluate(p, seo[p.path]) }));
  const group = GROUPS.find((g) => g.key === groupKey)?.group;
  const inGroup = rows.filter((r) => !group || r.page.group === group);
  const searched = inGroup.filter((r) => !q || r.page.path.toLowerCase().includes(q) || r.title.toLowerCase().includes(q));
  const items = searched.filter((r) => (filter === "probleme" ? r.problems > 0 : filter === "angepasst" ? r.custom : filter === "noindex" ? r.noindex : filter === "titel" ? r.titleLong : filter === "lang" ? r.descLong : filter === "kurz" ? r.descShort : true));

  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(one(sp.p)) || 1));
  const shown = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const state = { group: groupKey, f: filter, q: q || undefined, p: page > 1 ? page : undefined };
  const href = (patch: Partial<Record<keyof typeof state | "edit", string | number | undefined>>) => `/admin/seo${qs({ ...state, ...patch })}`;
  const editing = editPath ? rows.find((r) => r.page.path === editPath) : undefined;

  const total = {
    pages: rows.length,
    custom: rows.filter((r) => r.custom).length,
    noindex: rows.filter((r) => r.noindex).length,
    titleLong: rows.filter((r) => r.titleLong).length,
    descLong: rows.filter((r) => r.descLong).length,
    descShort: rows.filter((r) => r.descShort).length,
  };
  const problems = rows.filter((r) => r.problems > 0).length;

  return (
    <>
      <PageHeader
        title="SEO"
        description="Titel und Beschreibung jeder Seite, wie sie bei Google erscheinen. Leere Felder verwenden den Standardtext."
        actions={
          <a className="a-btn a-btn--ghost" href="/sitemap.xml" target="_blank" rel="noopener">
            <Icon name="external" size={16} />
            Sitemap ansehen
          </a>
        }
      />

      <section className="a-stats" aria-label="Zusammenfassung">
        <Link href={href({ f: undefined, p: undefined })} className={`a-stat${!filter ? " is-active" : ""}`} scroll={false}>
          <strong>{total.pages}</strong>
          <span>Seiten gesamt</span>
        </Link>
        <Link href={href({ f: "angepasst", p: undefined })} className={`a-stat${filter === "angepasst" ? " is-active" : ""}`} scroll={false}>
          <strong>{total.custom}</strong>
          <span>Angepasst</span>
        </Link>
        <Link href={href({ f: "noindex", p: undefined })} className={`a-stat${filter === "noindex" ? " is-active" : ""}`} scroll={false}>
          <strong>{total.noindex}</strong>
          <span>Nicht indexiert</span>
        </Link>
        <Link href={href({ f: "titel", p: undefined })} className={`a-stat${total.titleLong ? " a-stat--warn" : ""}${filter === "titel" ? " is-active" : ""}`} scroll={false}>
          <strong>{total.titleLong}</strong>
          <span>Titel zu lang</span>
        </Link>
        <Link href={href({ f: "lang", p: undefined })} className={`a-stat${total.descLong ? " a-stat--warn" : ""}${filter === "lang" ? " is-active" : ""}`} scroll={false}>
          <strong>{total.descLong}</strong>
          <span>Beschreibung zu lang</span>
        </Link>
        <Link href={href({ f: "kurz", p: undefined })} className={`a-stat${total.descShort ? " a-stat--warn" : ""}${filter === "kurz" ? " is-active" : ""}`} scroll={false}>
          <strong>{total.descShort}</strong>
          <span>Beschreibung fehlt/kurz</span>
        </Link>
      </section>

      <div className="a-toolbar">
        <Tabs
          label="Bereich"
          active={groupKey}
          items={GROUPS.map((g) => ({ key: g.key, label: g.label, count: g.group ? rows.filter((r) => r.page.group === g.group).length : rows.length, href: href({ group: g.key, p: undefined }) }))}
        />
        <div className="a-toolbar__row">
          <form className="a-filters" role="search">
            {groupKey && <input type="hidden" name="group" value={groupKey} />}
            {filter && <input type="hidden" name="f" value={filter} />}
            <label className="a-search">
              <Icon name="search" size={16} />
              <span className="sr-only">Seite suchen</span>
              <input name="q" type="search" defaultValue={q} placeholder="Pfad oder Titel suchen …" />
            </label>
            <button className="a-btn a-btn--ghost" type="submit">
              Suchen
            </button>
          </form>
          <div className="a-chips" role="group" aria-label="Filter">
            {FILTERS.map((f) => (
              <Link key={f.key} href={href({ f: f.key, p: undefined })} scroll={false} className={`a-chip${filter === f.key ? " is-active" : ""}`} aria-current={filter === f.key ? "true" : undefined}>
                {f.key === "probleme" && <span className={`a-dot a-dot--${problems ? "warn" : "ok"}`} aria-hidden="true" />}
                {f.label}
                {f.key === "probleme" && <span className="a-chip__count">{problems}</span>}
              </Link>
            ))}
            {Object.hasOwn(DETAIL, filter) && (
              <Link href={href({ f: undefined, p: undefined })} scroll={false} className="a-chip is-active" aria-label={`Filter «${DETAIL[filter]}» entfernen`}>
                {DETAIL[filter]}
                <Icon name="close" size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>

      <section className="a-panel a-panel--flush">
        {items.length === 0 ? (
          <Empty icon="search" title="Keine Seite gefunden" action={<Link href="/admin/seo" className="a-btn a-btn--ghost">Filter zurücksetzen</Link>}>
            {filter === "probleme" ? "In diesem Bereich gibt es keine Probleme – Titel und Beschreibungen haben eine gute Länge." : "Passen Sie die Suche an oder wählen Sie einen anderen Bereich."}
          </Empty>
        ) : (
          <>
            <div className="a-tablewrap">
              <table className="a-table a-table--seo a-table--stack">
                <thead>
                  <tr>
                    <th>Seite</th>
                    <th>
                      Titel <span className="a-th-hint">max. {TITLE_MAX}</span>
                    </th>
                    <th>
                      Beschreibung <span className="a-th-hint">{DESC_MIN}–{DESC_MAX}</span>
                    </th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Aktion</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const sel = editing?.page.path === r.page.path;
                    return (
                      <tr key={r.page.path} className={sel ? "is-selected" : undefined}>
                        <td className="a-seo-page">
                          <Link href={href({ edit: r.page.path })} scroll={false} className="a-rowlink">
                            {r.title}
                          </Link>
                          <small>
                            {r.page.path}
                            {!group && <span className="a-tag">{groupLabel(r.page.group)}</span>}
                          </small>
                        </td>
                        <td data-label="Titel">
                          <Length n={r.title.length} max={TITLE_MAX} label="Titel" />
                        </td>
                        <td data-label="Beschreibung">
                          <Length n={r.description.length} max={DESC_MAX} min={DESC_MIN} label="Beschreibung" />
                        </td>
                        <td>
                          <span className="a-tags">
                            {r.custom && <span className="a-pill a-pill--confirmed">Angepasst</span>}
                            {r.noindex && <span className="a-pill a-pill--cancelled">Noindex</span>}
                            {!r.custom && !r.noindex && <span className="a-muted a-small0">Standard</span>}
                          </span>
                        </td>
                        <td className="a-actions">
                          <Link href={href({ edit: r.page.path })} scroll={false} className="a-btn a-btn--ghost a-btn--sm">
                            <Icon name="edit" size={15} />
                            Bearbeiten
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={page} pages={pages} total={items.length} from={(page - 1) * PER_PAGE + 1} to={Math.min(page * PER_PAGE, items.length)} href={(p) => href({ p: p > 1 ? p : undefined })} />
          </>
        )}
      </section>

      {editing && (
        <Drawer
          closeHref={href({})}
          title={editing.page.path === "/" ? "Startseite" : editing.page.title}
          subtitle={
            <>
              {editing.page.path} · {groupLabel(editing.page.group)}
            </>
          }
        >
          <SeoEditor key={editing.page.path} page={editing.page} override={editing.o} origin={site.url} />
        </Drawer>
      )}
    </>
  );
}
