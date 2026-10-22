import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ConfirmForm } from "@/components/admin/forms";
import { PageHeader } from "@/components/admin/kit";
import { dateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { media } from "@/server/db/schema";
import { appUrl } from "@/server/lib/app-url";
import { PLACEHOLDERS, getPage } from "@/server/site/pages";
import { deletePageAction } from "./actions";
import { PageEditor, type EditorPage } from "./editor";
import "../../content.css";
import "./website.css";

/** Shared server part of /admin/seiten/neu and /admin/seiten/[id]. */
export async function PageEditorPage({ id, justCreated }: { id: string | null; justCreated?: boolean }) {
  const user = await requirePermission("website.manage");
  const row = id ? await getPage(id) : null;
  if (id && !row) notFound();
  const [cover] = row?.coverId ? await db.select().from(media).where(eq(media.id, row.coverId)) : [];
  const base = appUrl("").replace(/\/$/, "");
  const page: EditorPage = {
    id: row?.id ?? null,
    title: row?.title ?? "",
    slug: row?.slug ?? "",
    body: row?.body ?? "",
    status: row?.status ?? "draft",
    cover: cover ? { id: cover.id, path: cover.path, alt: cover.alt, filename: cover.filename, mime: cover.mime } : null,
    showTitle: row?.showTitle ?? true,
    seoTitle: row?.seoTitle ?? "",
    seoDescription: row?.seoDescription ?? "",
    noindex: row?.noindex ?? false,
  };
  return (
    <>
      <PageHeader
        crumb={{ href: "/admin/seiten", label: "Seiten" }}
        title={row ? row.title : "Neue Seite"}
        meta={row ? row.status === "published" ? <span className="a-pill a-pill--ok">Veröffentlicht</span> : <span className="a-pill a-pill--muted">Entwurf</span> : undefined}
        description={row ? `Zuletzt geändert ${dateTime(row.updatedAt)}` : "Titel und Inhalt eingeben, als Entwurf speichern oder direkt veröffentlichen."}
      />
      {justCreated && (
        <p className="a-alert a-alert--ok" role="status">
          Seite erstellt.
        </p>
      )}
      <PageEditor key={row?.id ?? "new"} page={page} siteHost={base.replace(/^https?:\/\//, "")} siteBase={base} canMedia={user.permissions.has("media.manage")} placeholders={PLACEHOLDERS} />
      {row && (
        <div className="a-danger">
          <div>
            <h2>Seite löschen</h2>
            <p>Die Seite verschwindet sofort von der Website. Links darauf führen dann ins Leere – mit dem Plugin «Weiterleitungen» können Sie die Adresse umleiten.</p>
          </div>
          <ConfirmForm action={deletePageAction} label="Seite löschen" question={`«${row.title}» endgültig löschen?`}>
            <input type="hidden" name="id" value={row.id} />
          </ConfirmForm>
        </div>
      )}
    </>
  );
}
