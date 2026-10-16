/** Date ranges for reports (Swiss calendar days) and the comparison period before them. */
import { addDays, zurichDay, dayStart } from "@/lib/tz";

export type Bucket = "day" | "week" | "month";
export type RangeKey = "7" | "30" | "90" | "jahr" | "vorjahr" | "custom";

export const RANGE_PRESETS: { key: Exclude<RangeKey, "custom">; label: string }[] = [
  { key: "7", label: "7 Tage" },
  { key: "30", label: "30 Tage" },
  { key: "90", label: "90 Tage" },
  { key: "jahr", label: "Dieses Jahr" },
  { key: "vorjahr", label: "Letztes Jahr" },
];

export type DateRange = {
  key: RangeKey;
  /** inclusive first and last day, YYYY-MM-DD */
  fromDay: string;
  toDay: string;
  /** instants: from inclusive, to exclusive */
  from: Date;
  to: Date;
  days: number;
  bucket: Bucket;
  label: string;
  prev: { from: Date; to: Date; fromDay: string; toDay: string };
};

const isDay = (s: string | undefined) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)));

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;
}

export function bucketFor(days: number): Bucket {
  if (days <= 35) return "day";
  if (days <= 190) return "week";
  return "month";
}

const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function resolveRange(key: string | undefined, von?: string, bis?: string, now = new Date()): DateRange {
  const today = zurichDay(now);
  const year = Number(today.slice(0, 4));
  let k: RangeKey = (["7", "30", "90", "jahr", "vorjahr", "custom"].includes(key ?? "") ? key : "30") as RangeKey;
  let fromDay: string;
  let toDay = today;
  if (k === "custom" && isDay(von) && isDay(bis)) {
    [fromDay, toDay] = von! <= bis! ? [von!, bis!] : [bis!, von!];
    if (daysBetween(fromDay, toDay) > 3 * 366) fromDay = addDays(toDay, -3 * 366 + 1);
  } else if (k === "jahr") fromDay = `${year}-01-01`;
  else if (k === "vorjahr") {
    fromDay = `${year - 1}-01-01`;
    toDay = `${year - 1}-12-31`;
  } else {
    if (k === "custom") k = "30";
    fromDay = addDays(today, -(Number(k) - 1));
  }
  const days = daysBetween(fromDay, toDay);
  const prevTo = addDays(fromDay, -1);
  const prevFrom = k === "vorjahr" || k === "jahr" ? `${Number(fromDay.slice(0, 4)) - 1}-01-01` : addDays(prevTo, -(days - 1));
  const prevToDay = k === "jahr" ? addDays(`${year - 1}${today.slice(4)}`, 0) : prevTo;
  const label =
    k === "custom"
      ? `${fmt(fromDay)} – ${fmt(toDay)}`
      : k === "jahr"
        ? `1. Januar bis heute`
        : k === "vorjahr"
          ? `Jahr ${year - 1}`
          : `Letzte ${k} Tage`;
  return {
    key: k,
    fromDay,
    toDay,
    from: dayStart(fromDay),
    to: dayStart(addDays(toDay, 1)),
    days,
    bucket: bucketFor(days),
    label,
    prev: { fromDay: prevFrom, toDay: prevToDay, from: dayStart(prevFrom), to: dayStart(addDays(prevToDay, 1)) },
  };
}

/** Bucket key of a Zurich day: the day itself, the Monday of its week, or the 1st of its month. */
export function bucketKey(day: string, bucket: Bucket) {
  if (bucket === "day") return day;
  if (bucket === "month") return day.slice(0, 8) + "01";
  const dow = new Date(day + "T12:00:00Z").getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** All bucket keys covering [fromDay, toDay] so empty periods show as zero. */
export function bucketKeys(fromDay: string, toDay: string, bucket: Bucket) {
  const keys: string[] = [];
  let d = fromDay;
  while (d <= toDay) {
    const k = bucketKey(d, bucket);
    if (keys[keys.length - 1] !== k) keys.push(k);
    d = addDays(d, 1);
  }
  return keys;
}

export function bucketLabel(key: string, bucket: Bucket, short = false) {
  const d = new Date(key + "T12:00:00Z");
  if (bucket === "month") return d.toLocaleDateString("de-CH", { month: short ? "short" : "long", year: short ? "2-digit" : "numeric", timeZone: "UTC" });
  if (bucket === "week") return (short ? "" : "Woche ab ") + d.toLocaleDateString("de-CH", { day: "numeric", month: "short", timeZone: "UTC" });
  return d.toLocaleDateString("de-CH", { day: "numeric", month: short ? "numeric" : "short", ...(short ? {} : { weekday: "short" }), timeZone: "UTC" });
}
