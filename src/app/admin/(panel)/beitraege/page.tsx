import Link from "next/link";
import { Empty, Icon, PageHeader, Pager, Tabs, one, qs } from "@/components/admin/kit";
import { date } from "@/lib/format";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { effectiveStatus, listPosts, postCategories, postTabCounts } from "@/server/content/posts";
import { mediaPath } from "@/server/media/store";
import { PostStatusPill } from "./status";
import "../../content.css";

export const metadata = { title: "Beiträge" };

const PER_PAGE = 25;
const TABS = [
  { key: "all", param: "", label: "Alle" },
  { key: "live", param: "veroeffentlicht", label: "Veröffentlicht" },
  { key: "scheduled", param: "geplant", label: "Geplant" },
  { key: "draft", param: "entwuerfe", label: "Entwürfe" },
];

export default async function PostsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("content.view");
  await requireModule("blog");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.param === one(sp.status)) ?? TABS[0];
  const q = one(sp.q).trim().slice(0, 100);
  const category = one(sp.kategorie).slice(0, 80);
  const page = Math.max(1, Number(one(sp.seite)) || 1);
  const canEdit = user.permissions.has("content.manage");

  const [{ rows, total }, counts, categories] = await Promise.all([listPosts({ tab: tab.key, q, category }, page, PER_PAGE), postTabCounts({ q, category }), postCategories()]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const base = { status: tab.param || undefined, q, kategorie: category };
  const filtered = Boolean(q || category);

  return (
    <>
      <PageHeader
        title="Beiträge"
        description="News und Blog-Beiträge für die Website. Geplante Beiträge erscheinen automatisch zum gewählten Zeitpunkt."
        actions={
          canEdit && (
            <Link href="/admin/beitraege/neu" className="a-btn a-btn--primary">
              <Icon name="plus" size={16} />
              Neuer Beitrag
            </Link>
          )
        }
      />
      {one(sp.geloescht) === "1" && (
        <p className="a-alert a-alert--ok" role="status">
          Beitrag gelöscht.
        </p>
      )}
      <div className="a-toolbar">
        <Tabs label="Status" active={tab.key} items={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key], href: `/admin/beitraege${qs({ ...base, status: t.param || undefined })}` }))} />
        <form className="a-toolbar__row" role="search" action="/admin/beitraege">
          {tab.param && <input type="hidden" name="status" value={tab.param} />}
          <label className="a-search">
            <Icon name="search" size={16} />
            <span className="sr-only">Beiträge suchen</span>
            <input type="search" name="q" defaultValue={q} placeholder="Titel, Adresse oder Kurztext" />
          </label>
          <div className="a-filters">
            <label className="a-field">
              <span className="sr-only">Kategorie</span>
              <select name="kategorie" defaultValue={category}>
                <option value="">Alle Kategorien</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="a-btn a-btn--ghost">
              Filtern
            </button>
            {filtered && (
              <Link href={`/admin/beitraege${qs({ status: tab.param || undefined })}`} className="a-btn a-btn--quiet">
                Zurücksetzen
              </Link>
            )}
          </div>
        </form>
      </div>
      <section className="a-panel a-panel--flush">
        {rows.length === 0 ? (
          filtered || tab.key !== "all" ? (
            <Empty icon="search" title="Keine Beiträge gefunden">
              Kein Beitrag passt zu Suche, Kategorie oder Status.{" "}
              <Link href="/admin/beitraege" className="a-link">
                Alle Beiträge anzeigen
              </Link>
            </Empty>
          ) : (
            <Empty
              icon="file"
              title="Noch keine Beiträge"
              action={
                canEdit && (
                  <Link href="/admin/beitraege/neu" className="a-btn a-btn--primary">
                    Ersten Beitrag schreiben
                  </Link>
                )
              }
            >
              Beiträge erscheinen über die API auf der Website, z. B. als News oder Blog.
            </Empty>
          )
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th scope="col">Titel</th>
                  <th scope="col">Status</th>
                  <th scope="col">Kategorie</th>
                  <th scope="col">Autor/in</th>
                  <th scope="col">Datum</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, coverPath, author }) => {
                  const st = effectiveStatus(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="a-cellmain">
                          {coverPath ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaPath(coverPath)} alt="" className="a-thumb" loading="lazy" />
                          ) : (
                            <span className="a-thumb px-nothumb" aria-hidden="true">
                              <Icon name="file" size={18} />
                            </span>
                          )}
                          <div>
                            {canEdit ? (
                              <Link href={`/admin/beitraege/${p.id}`} className="a-rowlink">
                                {p.title}
                              </Link>
                            ) : (
                              <strong>{p.title}</strong>
                            )}
                            <small className="a-mono-cell">/{p.slug}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Status">
                        <PostStatusPill status={st} />
                      </td>
                      <td data-label="Kategorie">{p.category || <span className="a-muted">–</span>}</td>
                      <td data-label="Autor/in">{author ?? <span className="a-muted">–</span>}</td>
                      <td data-label={st === "draft" ? "Geändert" : st === "scheduled" ? "Erscheint" : "Veröffentlicht"} className="a-nowrap">
                        {st === "draft" ? date(p.updatedAt) : date(p.publishedAt)}
                        <small>{st === "draft" ? "geändert" : st === "scheduled" ? "geplant" : "veröffentlicht"}</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pages={pages} total={total} from={total ? (page - 1) * PER_PAGE + 1 : 0} to={Math.min(total, page * PER_PAGE)} href={(p) => `/admin/beitraege${qs({ ...base, seite: p > 1 ? p : undefined })}`} />
      </section>
    </>
  );
}
