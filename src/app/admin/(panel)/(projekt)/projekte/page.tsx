/**
 * PROJEKTCODE (Madex): portfolio projects of the website – list and editor.
 */
import Link from "next/link";
import { Drawer } from "@/components/admin/drawer";
import { ConfirmForm } from "@/components/admin/forms";
import {
  Empty,
  Icon,
  PageHeader,
  Pager,
  one,
  qs,
} from "@/components/admin/kit";
import { formatDate } from "@/content/posts";
import { media } from "@/lib/media";
import { blocksToText, getProjects } from "@/lib/server/projects";
import { requirePermission } from "@/server/auth/session";
import { deleteProjectAction } from "./actions";
import { ProjectForm, type ProjectDraft } from "./client";
import "./projekte.css";

export const metadata = { title: "Projekte" };

const PER_PAGE = 25;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("content.view");
  const sp = await searchParams;
  const canEdit = user.permissions.has("content.manage");
  const q = one(sp.q).trim().toLowerCase();
  const all = await getProjects();
  const filtered = q
    ? all.filter((p) =>
        `${p.title} ${p.client} ${p.slug}`.toLowerCase().includes(q),
      )
    : all;
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(one(sp.seite)) || 1));
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const base = {
    q: q || undefined,
    seite: page > 1 ? String(page) : undefined,
  };
  const closeHref = `/admin/projekte${qs(base)}`;

  const editSlug = one(sp.bearbeiten);
  const isNew = one(sp.neu) === "1" && canEdit;
  const editing = editSlug ? all.find((p) => p.slug === editSlug) : undefined;
  const draft: ProjectDraft | null = editing
    ? {
        slug: editing.slug,
        title: editing.title,
        client: editing.client,
        date: editing.date.slice(0, 10),
        description: editing.description,
        external: editing.external,
        cover: editing.cover,
        coverUrl: media(editing.cover),
        content: blocksToText(editing.blocks),
      }
    : null;

  return (
    <>
      <PageHeader
        title="Projekte"
        description="Die Referenzen im Website-Portfolio. Neue Projekte erscheinen sofort auf der Startseite, im Portfolio und in der Sitemap."
        actions={
          canEdit && (
            <Link
              href={`/admin/projekte${qs({ ...base, neu: "1" })}`}
              className="a-btn a-btn--primary"
              scroll={false}
            >
              <Icon name="plus" size={16} />
              Projekt hinzufügen
            </Link>
          )
        }
      />
      <div className="a-toolbar">
        <div className="a-toolbar__row">
          <form className="a-search" role="search" action="/admin/projekte">
            <Icon name="search" size={16} />
            <label htmlFor="pj-q" className="sr-only">
              Projekte suchen
            </label>
            <input
              id="pj-q"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Titel oder Kunde"
            />
          </form>
          <span className="a-muted">
            {filtered.length === all.length
              ? `${all.length} Projekte`
              : `${filtered.length} von ${all.length} Projekten`}
          </span>
        </div>
      </div>
      <section className="a-panel a-panel--flush">
        {rows.length === 0 ? (
          <Empty
            icon="file"
            title={all.length ? "Keine Treffer" : "Noch keine Projekte"}
            action={
              !all.length && canEdit ? (
                <Link
                  href="/admin/projekte?neu=1"
                  className="a-btn a-btn--primary"
                >
                  Erstes Projekt hinzufügen
                </Link>
              ) : undefined
            }
          >
            {all.length
              ? "Kein Projekt passt zur Suche. Prüfen Sie die Schreibweise oder suchen Sie nach dem Kunden."
              : "Zeigen Sie hier, welche Websites Sie umgesetzt haben."}
          </Empty>
        ) : (
          <ul className="pj-list">
            {rows.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/admin/projekte${qs({ ...base, bearbeiten: p.slug })}`}
                  className={`pj-row${editSlug === p.slug ? " is-selected" : ""}`}
                  scroll={false}
                >
                  {p.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media(p.cover)} alt="" loading="lazy" />
                  ) : (
                    <span className="pj-row__noimg" />
                  )}
                  <span className="pj-row__main">
                    <span className="pj-row__title">{p.title}</span>
                    <span className="pj-row__meta">
                      {p.client} · /{p.slug}
                    </span>
                  </span>
                  <span className="pj-row__date">{formatDate(p.date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pager
          page={page}
          pages={pages}
          total={filtered.length}
          from={(page - 1) * PER_PAGE + 1}
          to={Math.min(page * PER_PAGE, filtered.length)}
          href={(n) =>
            `/admin/projekte${qs({ ...base, seite: n > 1 ? String(n) : undefined })}`
          }
        />
      </section>
      {(isNew || editSlug) && (
        <Drawer
          closeHref={closeHref}
          title={
            isNew
              ? "Neues Projekt"
              : (editing?.title ?? "Projekt nicht gefunden")
          }
          subtitle={editing ? `/${editing.slug}` : undefined}
        >
          {isNew || editing ? (
            <>
              {editing && (
                <div className="pj-links">
                  <a
                    href={`/${editing.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="a-btn a-btn--ghost a-btn--sm"
                  >
                    <Icon name="external" size={15} />
                    Projektseite ansehen
                  </a>
                  {editing.external && (
                    <a
                      href={editing.external}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="a-btn a-btn--ghost a-btn--sm"
                    >
                      <Icon name="globe" size={15} />
                      Website des Kunden
                    </a>
                  )}
                </div>
              )}
              {canEdit ? (
                <ProjectForm
                  key={editing?.slug ?? "neu"}
                  p={draft}
                  saved={one(sp.gespeichert) === "1"}
                  canMedia={user.permissions.has("media.manage")}
                />
              ) : (
                <div className="a-stack">
                  <p className="a-muted">
                    Sie können Projekte ansehen, aber nicht ändern. Dafür
                    braucht es das Recht «Beiträge erstellen und
                    veröffentlichen».
                  </p>
                </div>
              )}
              {editing && canEdit && (
                <div className="a-danger a-danger--inset">
                  <div>
                    <h2>Projekt löschen</h2>
                    <p>
                      Die Projektseite verschwindet von der Website. Links
                      darauf führen danach auf «Seite nicht gefunden».
                    </p>
                  </div>
                  <ConfirmForm
                    action={deleteProjectAction}
                    label="Löschen"
                    question={`«${editing.title}» löschen?`}
                  >
                    <input type="hidden" name="slug" value={editing.slug} />
                  </ConfirmForm>
                </div>
              )}
            </>
          ) : (
            <div className="a-stack">
              <p className="a-muted">Dieses Projekt gibt es nicht mehr.</p>
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}
