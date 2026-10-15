/** Chat protection: rate limits, cooldown, length & spam checks, IP blocking, security log. */
import { createHash } from "node:crypto";
import { nowIso, read, update } from "./store";
import type { SecuritySettings } from "./settings";

type Bucket = number[];
const hits = new Map<string, Bucket>();

function take(key: string, limit: number, windowMs: number) {
  if (!limit) return true;
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  return true;
}

export function clientIp(req: Request) {
  // Behind Coolify/Traefik the proxy sets X-Forwarded-For; trust only when configured.
  if (process.env.TRUST_PROXY !== "false") {
    const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd;
    const real = req.headers.get("x-real-ip");
    if (real) return real;
  }
  return "unknown";
}

export const ipKey = (ip: string) => createHash("sha256").update((process.env.ADMIN_SESSION_SECRET || "madex") + ip).digest("hex").slice(0, 16);

function ipToInt(ip: string) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

export function ipBlocked(ip: string, list: string[]) {
  return list.some((rule) => {
    const r = rule.trim();
    if (!r) return false;
    if (!r.includes("/")) return r === ip;
    const [base, bitsStr] = r.split("/");
    const bits = Number(bitsStr);
    const a = ipToInt(ip);
    const b = ipToInt(base);
    if (a === null || b === null || isNaN(bits)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (a & mask) === (b & mask);
  });
}

export function looksLikeSpam(msg: string) {
  const urls = (msg.match(/https?:\/\//gi) ?? []).length;
  if (urls >= 3) return true;
  const letters = msg.replace(/[^a-zäöü]/gi, "");
  if (letters.length > 20 && letters === letters.toUpperCase()) return true;
  if (/(.{4,})\1{4,}/i.test(msg)) return true;
  if (/(viagra|casino|crypto\s*invest|bitcoin\s*profit|seo\s*backlinks\s*cheap|loan\s*offer)/i.test(msg)) return true;
  return false;
}

export type Check = { ok: true } | { ok: false; reason: string; message: string };

export function checkMessage(ip: string, msg: string, s: SecuritySettings): Check {
  if (ipBlocked(ip, s.blockedIps)) return { ok: false, reason: "ip_blocked", message: "Der Chat ist für Ihre Verbindung nicht verfügbar. Bitte kontaktieren Sie uns per E-Mail oder Telefon." };
  if (msg.trim().length < s.minLength) return { ok: false, reason: "too_short", message: "Bitte geben Sie eine Nachricht ein." };
  if (msg.length > s.maxLength) return { ok: false, reason: "too_long", message: `Bitte kürzen Sie Ihre Nachricht auf höchstens ${s.maxLength} Zeichen.` };
  if (s.blockSpam && looksLikeSpam(msg)) return { ok: false, reason: "spam", message: "Diese Nachricht wurde als Spam erkannt." };
  const k = ipKey(ip);
  if (!take("cd:" + k, 1, s.cooldownSeconds * 1000)) return { ok: false, reason: "cooldown", message: "Bitte warten Sie einen Moment vor der nächsten Nachricht." };
  if (!take("min:" + k, s.perMinute, 60_000)) return { ok: false, reason: "rate_minute", message: "Zu viele Nachrichten in kurzer Zeit. Bitte warten Sie eine Minute." };
  if (!take("day:" + k, s.perDay, 86_400_000)) return { ok: false, reason: "rate_day", message: "Das Tageslimit ist erreicht. Bitte kontaktieren Sie uns direkt per E-Mail oder Telefon." };
  return { ok: true };
}

export function checkNewSession(ip: string, s: SecuritySettings): Check {
  if (ipBlocked(ip, s.blockedIps)) return { ok: false, reason: "ip_blocked", message: "Der Chat ist für Ihre Verbindung nicht verfügbar." };
  if (!take("sess:" + ipKey(ip), s.sessionsPerHour, 3_600_000)) return { ok: false, reason: "rate_sessions", message: "Zu viele neue Gespräche. Bitte versuchen Sie es später erneut." };
  return { ok: true };
}

export type SecurityEvent = { at: string; type: string; ip: string; detail?: string };

export async function logSecurity(type: string, ip: string, detail?: string) {
  await update<{ items: SecurityEvent[] }>("security-log", { items: [] }, (d) => {
    d.items.unshift({ at: nowIso(), type, ip: ip === "unknown" ? ip : ip.replace(/\.\d+$/, ".x"), detail });
    if (d.items.length > 1000) d.items.length = 1000;
  });
}

export async function securityLog() {
  return (await read<{ items: SecurityEvent[] }>("security-log", { items: [] })).items;
}
