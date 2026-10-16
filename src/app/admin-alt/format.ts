export const dateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" }) : "–");
export const dateOnly = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("de-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" }) : "–");

/** Counts per day for the last `days` days (Europe/Zurich). */
export function perDay(isoDates: string[], days = 30) {
  const key = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) map.set(key(new Date(Date.now() - i * 86400000)), 0);
  for (const iso of isoDates) {
    const k = key(new Date(iso));
    if (map.has(k)) map.set(k, map.get(k)! + 1);
  }
  return [...map.entries()].map(([date, count]) => ({ date, count }));
}
