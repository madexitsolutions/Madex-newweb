/**
 * Media library storage on disk (UPLOADS_DIR, default .data/uploads – mount it
 * as a persistent volume). Files are served by /uploads/[...path].
 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { media } from "@/server/db/schema";
import { slugify } from "@/lib/format";
import { appUrl } from "@/server/lib/app-url";
import { dataDir } from "@/server/lib/data-dir";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

export function uploadsDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOADS_DIR || path.join(dataDir(), "uploads"));
}

/** URL path of a stored file, e.g. /uploads/2026/10/ab12-bild.webp */
export const mediaPath = (p: string) => `/uploads/${p}`;
/** Absolute URL (for the API and e-mails) */
export const mediaUrl = (p: string) => appUrl(mediaPath(p));

/** Reads width/height from PNG, GIF, JPEG and WebP headers (no image library needed). */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  if (buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.toString("ascii", 0, 3) === "GIF") return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const kind = buf.toString("ascii", 12, 16);
    if (kind === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (kind === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

/** Checks magic bytes so a renamed file can't pose as an image. */
function sniff(buf: Buffer, mime: string) {
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === "image/png") return buf.readUInt32BE(0) === 0x89504e47;
  if (mime === "image/gif") return buf.toString("ascii", 0, 3) === "GIF";
  if (mime === "image/webp") return buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
  if (mime === "image/avif") return buf.toString("ascii", 4, 12).includes("ftyp");
  if (mime === "application/pdf") return buf.toString("ascii", 0, 4) === "%PDF";
  if (mime === "image/svg+xml") return /<svg[\s>]/i.test(buf.toString("utf8", 0, Math.min(buf.length, 2048)));
  return false;
}

export async function saveUpload(file: File, opts: { userId?: string; folder?: string; alt?: string } = {}) {
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error(`Dateityp ${file.type || "unbekannt"} ist nicht erlaubt.`);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Die Datei ist grösser als 10 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniff(buf, file.type)) throw new Error("Der Inhalt der Datei passt nicht zum Dateityp.");
  if (file.type === "image/svg+xml" && /<script|on\w+\s*=|javascript:/i.test(buf.toString("utf8"))) throw new Error("SVG-Dateien mit Skripten sind nicht erlaubt.");
  const now = new Date();
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "datei";
  const rel = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${randomBytes(4).toString("hex")}-${base.slice(0, 60)}.${ext}`;
  const abs = path.join(uploadsDir(), rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buf);
  const size = file.type.startsWith("image/") && file.type !== "image/svg+xml" ? imageSize(buf) : null;
  const [row] = await db
    .insert(media)
    .values({ path: rel, filename: file.name.slice(0, 200), mime: file.type, size: file.size, width: size?.width ?? null, height: size?.height ?? null, alt: opts.alt ?? "", folder: opts.folder ?? "", uploadedBy: opts.userId ?? null })
    .returning();
  return row;
}

export async function deleteMedia(id: string) {
  const [row] = await db.delete(media).where(eq(media.id, id)).returning();
  if (row) await rm(path.join(uploadsDir(), row.path), { force: true });
  return row;
}

export async function readStored(rel: string) {
  const clean = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
  const abs = path.join(uploadsDir(), clean);
  if (!abs.startsWith(uploadsDir() + path.sep)) throw new Error("Ungültiger Pfad");
  return readFile(abs);
}
