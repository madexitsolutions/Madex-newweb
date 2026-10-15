import { readFileSync } from "node:fs";
import path from "node:path";
import type { Post } from "@/content/posts";
import { media } from "@/lib/media";

/** Width/height of a WebP in /public (reads the header only). */
function webpSize(url: string): { w: number; h: number } | null {
  try {
    const buf = readFileSync(path.join(process.cwd(), "public", url));
    if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  } catch {
    /* missing file – fall through */
  }
  return null;
}

/**
 * The image to put on the device screens: the first plain desktop screenshot
 * of the project (wide, ~2:1). Many covers are already photographed mockups,
 * which must not end up inside another device.
 */
export function screenImage(post: Post): string {
  const candidates = [post.cover, ...post.blocks.flatMap((b) => (b.type === "img" ? [b.src] : []))].map(media).filter((u) => u.endsWith(".webp"));
  for (const url of candidates) {
    const s = webpSize(url);
    if (s && s.w / s.h >= 1.6 && s.w / s.h <= 2.7) return url;
  }
  return media(post.cover);
}
