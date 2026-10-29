import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ConfirmForm } from "@/components/admin/forms";
import { PageHeader } from "@/components/admin/kit";
import { toLocalInput } from "@/lib/tz";
import { dateTime } from "@/lib/format";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { media, posts, users } from "@/server/db/schema";
import { effectiveStatus, postCategories, postTags } from "@/server/content/posts";
import { getSettings } from "@/server/settings";
import { deletePostAction } from "./actions";
import { PostEditor, type EditorPost } from "./editor";
import { PostStatusPill } from "./status";
import "../../content.css";

/** Shared server part of /madexadm/beitraege/neu and /madexadm/beitraege/[id]. */
export async function EditorPage({ id, justCreated }: { id: string | null; justCreated?: boolean }) {
  const user = await requirePermission("content.manage");
  await requireModule("blog");
  const [row] = id && /^[0-9a-f-]{36}$/i.test(id) ? await db.select().from(posts).where(eq(posts.id, id)) : [];
  if (id && !row) notFound();
  const [cover] = row?.coverId ? await db.select().from(media).where(eq(media.id, row.coverId)) : [];
  const [authors, categories, tags, general] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.status, "active")).orderBy(users.name),
    postCategories(),
    postTags(),
    getSettings("general"),
  ]);
  let siteHost = "ihre-website.ch";
  try {
    if (general.siteUrl) siteHost = new URL(general.siteUrl).host;
  } catch {
    /* keep placeholder */
  }
  const post: EditorPost = {
    id: row?.id ?? null,
    title: row?.title ?? "",
    slug: row?.slug ?? "",
    excerpt: row?.excerpt ?? "",
    body: row?.body ?? "",
    cover: cover ? { id: cover.id, path: cover.path, alt: cover.alt, filename: cover.filename, mime: cover.mime } : null,
    category: row?.category ?? "",
    tags: row?.tags ?? [],
    authorId: row ? (row.authorId ?? "") : user.id,
    seoTitle: row?.seoTitle ?? "",
    seoDescription: row?.seoDescription ?? "",
    status: row?.status ?? "draft",
    publishedAt: toLocalInput(row?.publishedAt),
  };
  return (
    <>
      <PageHeader
        crumb={{ href: "/madexadm/beitraege", label: "Beiträge" }}
        title={row ? row.title : "Neuer Beitrag"}
        meta={row ? <PostStatusPill status={effectiveStatus(row)} /> : undefined}
        description={row ? `Zuletzt geändert ${dateTime(row.updatedAt)}` : "Entwurf speichern und später veröffentlichen – oder direkt planen."}
      />
      {justCreated && (
        <p className="a-alert a-alert--ok" role="status">
          Beitrag erstellt.
        </p>
      )}
      <PostEditor key={row?.id ?? "new"} post={post} authors={authors} categories={categories} tags={tags} siteHost={siteHost} canMedia={user.permissions.has("media.manage")} />
      {row && (
        <div className="a-danger">
          <div>
            <h2>Beitrag löschen</h2>
            <p>Der Beitrag verschwindet sofort von der Website. Das kann nicht rückgängig gemacht werden.</p>
          </div>
          <ConfirmForm action={deletePostAction} label="Beitrag löschen" question={`«${row.title}» endgültig löschen?`}>
            <input type="hidden" name="id" value={row.id} />
          </ConfirmForm>
        </div>
      )}
    </>
  );
}
