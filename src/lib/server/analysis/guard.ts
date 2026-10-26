/**
 * Protection of the website analysis against abuse and runaway API costs.
 *
 * - every domain is analysed only once (permanent list, failed runs excepted)
 * - limits per visitor IP, per network (/24 or /64) and per e-mail address
 * - a global hourly and daily budget (ANALYSE_HOURLY_LIMIT, ANALYSE_DAILY_LIMIT)
 * - only requests from our own website (Origin/Referer) and a minimum time
 *   to fill in the form
 * Counters are stored in the database (survive restarts and deploys).
 */
import { read, update } from "@/lib/server/store";
import { hit } from "@/server/lib/rate-limit";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

/** Budget for the whole scanner – the real cost limit (OpenAI and Google per analysis). */
export const budget = () => ({ hourly: num(process.env.ANALYSE_HOURLY_LIMIT, 12), daily: num(process.env.ANALYSE_DAILY_LIMIT, 40) });

/**
 * Visitor IP. Behind Coolify's proxy (Traefik) X-Real-Ip and the last
 * X-Forwarded-For entry are set by the proxy; the first entry can be faked.
 */
export function clientIp(req: Request) {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const chain = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return chain.at(-1) ?? "unknown";
}

/** /24 for IPv4, /64 for IPv6 – one attacker rarely has more than one network. */
export function networkOf(ip: string) {
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":");
  return ip.split(".").slice(0, 3).join(".");
}

/** Only our own pages may start an analysis (blocks scripts and other sites using the endpoint). */
export function fromOwnSite(req: Request) {
  const src = req.headers.get("origin") || req.headers.get("referer");
  if (!src) return false;
  try {
    const host = new URL(src).host;
    const own = [req.headers.get("x-forwarded-host"), req.headers.get("host"), ...[process.env.NEXT_PUBLIC_SITE_URL, process.env.APP_URL].map((u) => (u ? new URL(u).host : null))];
    return own.some((h) => h && h.toLowerCase() === host.toLowerCase());
  } catch {
    return false;
  }
}

export type Admission = { ok: true } | { ok: false; reason: "visitor" | "email" | "budget"; message: string };

/** Per-visitor limits first, the global budget last (so blocked visitors don't use it up). */
export async function admit(ip: string, email: string): Promise<Admission> {
  const visitor = [
    await hit(`analyse:ip-h:${ip}`, 3, HOUR),
    await hit(`analyse:ip-d:${ip}`, 6, DAY),
    await hit(`analyse:net-d:${networkOf(ip)}`, 12, DAY),
  ];
  if (visitor.some((r) => !r.allowed)) return { ok: false, reason: "visitor", message: "Sie haben in kurzer Zeit mehrere Analysen gestartet. Bitte versuchen Sie es später erneut oder rufen Sie uns an: 052 589 67 59." };
  if (!(await hit(`analyse:mail-d:${email.toLowerCase()}`, 3, DAY)).allowed) return { ok: false, reason: "email", message: "Für diese E-Mail-Adresse wurden heute bereits mehrere Analysen erstellt. Bitte versuchen Sie es morgen erneut." };
  const b = budget();
  const [h, d] = [await hit("analyse:global-h", b.hourly, HOUR), await hit("analyse:global-d", b.daily, DAY)];
  if (!h.allowed || !d.allowed)
    return { ok: false, reason: "budget", message: "Gerade sind sehr viele Analysen in Arbeit. Wir haben Ihre Anfrage erhalten und senden Ihnen die Analyse innerhalb von 24 Stunden persönlich zu." };
  return { ok: true };
}

/* ------------------------------------------------- once per website */

type DomainEntry = { id: string; email: string; createdAt: string };
const INDEX = "analyse-domains";

/** "www.Firma.ch" and "firma.ch" are the same website. */
export const domainKey = (host: string) => host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");

export async function analysedBefore(host: string): Promise<DomainEntry | null> {
  const all = await read<Record<string, DomainEntry>>(INDEX, {});
  return all[domainKey(host)] ?? null;
}

/** Reserve the domain right away (two quick requests can't both start a run). Returns false when it was taken. */
export async function claimDomain(host: string, entry: DomainEntry): Promise<boolean> {
  return update<Record<string, DomainEntry>, boolean>(INDEX, {}, (all) => {
    const k = domainKey(host);
    if (all[k]) return false;
    all[k] = entry;
    return true;
  });
}

/** A failed run frees the domain again. */
export async function releaseDomain(host: string, id: string) {
  await update<Record<string, DomainEntry>>(INDEX, {}, (all) => {
    const k = domainKey(host);
    if (all[k]?.id === id) delete all[k];
  });
}
