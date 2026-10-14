/** Map an upload path (e.g. "2026/04/autopozzo.png") to its optimised derivative. */
export function media(path: string): string {
  if (!path) return "";
  if (path.startsWith("/")) return path;
  if (path.endsWith(".svg")) return `/media/${path}`;
  if (path.endsWith(".mp4")) return `/media/${path}`;
  return `/media/${path.replace(/\.(png|jpe?g|gif|webp)$/i, "")}.webp`;
}

export function poster(path: string): string {
  return `/media/${path.replace(/\.\w+$/, "")}.webp`;
}
