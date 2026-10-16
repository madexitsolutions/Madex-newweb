/**
 * Swiss local time helpers (Europe/Zurich) for date inputs and day/week/month
 * buckets. Work on server and client without a date library.
 */
export const TZ = "Europe/Zurich";

function parts(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(d)) if (p.type !== "literal") o[p.type] = Number(p.value);
  return o as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of Zurich time to UTC in ms at the given instant (+1 h in winter, +2 h in summer). */
export function zurichOffset(d: Date) {
  const p = parts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Wall-clock time in Zurich → instant. */
export function zurichToDate(year: number, month: number, day: number, hour = 0, minute = 0) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let t = guess - zurichOffset(new Date(guess));
  // second pass corrects the guess around DST switches
  t = guess - zurichOffset(new Date(t));
  return new Date(t);
}

/** "2026-10-20T09:30" (datetime-local, Zurich) → Date; null when invalid. */
export function parseLocalDateTime(value: string | null | undefined): Date | null {
  const m = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4] ?? "0", m[5] ?? "0"].map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  return zurichToDate(y, mo, d, h, mi);
}

/** Date → "2026-10-20T09:30" in Zurich time (value for <input type="datetime-local">). */
export function toLocalInput(d: Date | null | undefined) {
  if (!d) return "";
  const p = parts(d);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${z(p.month)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}`;
}

/** YYYY-MM-DD of the Zurich calendar day. */
export function zurichDay(d: Date) {
  const p = parts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Start of the Zurich day that contains `d`. */
export function startOfZurichDay(d: Date) {
  const p = parts(d);
  return zurichToDate(p.year, p.month, p.day);
}

/** Adds calendar days to a YYYY-MM-DD key. */
export function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Start instant of a YYYY-MM-DD Zurich day. */
export function dayStart(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return zurichToDate(y, m, d);
}
