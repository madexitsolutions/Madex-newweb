/**
 * Upload of one file into the media library (multipart field "file", optional "alt").
 * Used by the media library and the media picker via XMLHttpRequest so the
 * browser can show per-file progress. Requires a signed-in user with media.manage.
 */
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { saveUpload, MAX_UPLOAD_BYTES } from "@/server/media/store";
import { toRef } from "@/server/media/library";

const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  // same-origin only (cookies are SameSite=Lax already; this also stops cross-site fetch with credentials)
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return reply(403, { error: "Ungültige Herkunft der Anfrage." });
  const user = await checkPermission("media.manage");
  if (!user) return reply(403, { error: "Keine Berechtigung für die Mediathek. Bitte neu anmelden." });
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) return reply(413, { error: "Die Datei ist grösser als 10 MB. Bitte verkleinern und erneut hochladen." });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return reply(400, { error: "Die Datei konnte nicht gelesen werden." });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return reply(400, { error: "Keine Datei erhalten." });
  try {
    const row = await saveUpload(file, { userId: user.id, alt: String(form.get("alt") ?? "").slice(0, 300) });
    await audit(user, "media.uploaded", { entityType: "media", entityId: row.id, summary: `Datei «${row.filename}» hochgeladen` });
    revalidatePath("/admin/medien");
    return reply(201, { media: toRef(row) });
  } catch (e) {
    return reply(422, { error: e instanceof Error ? e.message : "Die Datei konnte nicht gespeichert werden." });
  }
}
