/**
 * Serves files of the media library from UPLOADS_DIR. Paths contain a random
 * part, so responses are cached long. Every response is sandboxed (CSP) so an
 * uploaded SVG or PDF can never run script in the dashboard's origin.
 */
import path from "node:path";
import { readStored } from "@/server/media/store";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  const ext = path.extname(rel).slice(1).toLowerCase();
  const type = TYPES[ext];
  if (!type || parts.some((p) => p === ".." || p.startsWith("."))) return new Response("Nicht gefunden", { status: 404 });
  let buf: Buffer;
  try {
    buf = await readStored(rel);
  } catch {
    return new Response("Nicht gefunden", { status: 404 });
  }
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": type,
      "content-length": String(buf.length),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": type === "application/pdf" ? "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'self'" : "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "cross-origin-resource-policy": "cross-origin",
      ...(type === "application/pdf" ? { "content-disposition": `inline; filename="${path.basename(rel)}"` } : {}),
    },
  });
}
