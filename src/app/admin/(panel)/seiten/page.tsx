import Link from "next/link";
import { Empty, Icon, PageHeader, Tabs, one, qs } from "@/components/admin/kit";
import { dateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { appUrl } from "@/server/lib/app-url";
import { listPages, pageCounts } from "@/server/site/pages";
import "../../content.css";
import "./website.css";

export const metadata = { title: "Seiten" };

const TABS = [
  { key: "all", param: "", label: "Alle" },
  { key: "published", param: "veroeffentlicht", label: "Veröffentlicht" },
  { key: "draft", param: "entwuerfe", label: "Entwürfe" },
] as const;

export default async function PagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("website.manage");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.param === one(sp.status)) ?? TABS[0];
  const q = one(sp.q).trim().slice(0, 100);
  const [rows, counts] = await Promise.all([listPages({ q, status: tab.key === "all" ? undefined : tab.key }), pageCounts()]);
  const base = appUrl("").replace(/\/$/, "");

  return (
    <>
      <PageHeader
        title="Seiten"
        description="Eigene Seiten der Website wie «Über uns», «Team», Impressum oder Datenschutz – ohne Programmieren. Veröffentlichte Seiten erscheinen unter ihrer Adresse und lassen sich im Menü verlinken."
        actions={
          <Link href="/admin/seiten/neu" className="a-btn a-btn--primary">
            <Icon name="plus" size={16} />
            Neue Seite
          </Link>
        }
      />
      {one(sp.geloescht) === "1" && (
        <p className="a-alert a-alert--ok" role="status">
          Seite gelöscht.
        </p>
      )}
      <div className="a-toolbar">
        <Tabs label="Status" active={tab.key} items={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key], href: `/admin/seiten${qs({ status: t.param || undefined, q })}` }))} />
        <form className="a-toolbar__row" role="search" action="/admin/seiten">
          {tab.param && <input type="hidden" name="status" value={tab.param} />}
          <label className="a-search">
            <Icon name="search" size={16} />
            <span className="sr-only">Seiten suchen</span>
            <input type="search" name="q" defaultValue={q} placeholder="Titel oder Adresse" />
          </label>
        </form>
      </div>
      <section className="a-panel a-panel--flush">
        {rows.length === 0 ? (
          q || tab.key !== "all" ? (
            <Empty icon="search" title="Keine Seiten gefunden">
              Keine Seite passt zu Suche oder Status.{" "}
              <Link href="/admin/seiten" className="a-link">
                Alle Seiten anzeigen
              </Link>
            </Empty>
          ) : (
            <Empty
              icon="pages"
              title="Noch keine Seiten"
              action={
                <Link href="/admin/seiten/neu" className="a-btn a-btn--primary">
                  Erste Seite erstellen
                </Link>
              }
            >
              Erstellen Sie Seiten wie «Über uns» oder «Team» und verlinken Sie sie unter Website → Menüs.
            </Empty>
          )
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th scope="col">Titel</th>
                  <th scope="col">Status</th>
                  <th scope="col">Geändert</th>
                  <th scope="col">
                    <span className="sr-only">Ansehen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/seiten/${p.id}`} className="a-rowlink">
                        {p.title}
                      </Link>
                      <small className="a-mono-cell">/{p.slug}</small>
                    </td>
                    <td data-label="Status">{p.status === "published" ? <span className="a-pill a-pill--ok">Veröffentlicht</span> : <span className="a-pill a-pill--muted">Entwurf</span>}</td>
                    <td data-label="Geändert" className="a-nowrap">
                      {dateTime(p.updatedAt)}
                    </td>
                    <td className="a-num">
                      {p.status === "published" && (
                        <a href={`${base}/${p.slug}`} target="_blank" rel="noopener" className="a-btn a-btn--quiet a-btn--sm">
                          <Icon name="external" size={14} />
                          Ansehen
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
