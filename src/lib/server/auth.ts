/**
 * Admin authentication (port of the plugin's management portal security):
 * - username + password from the environment (ADMIN_USERNAME / ADMIN_PASSWORD)
 * - mandatory TOTP 2FA with 8 one-time recovery codes
 * - server-side sessions, HttpOnly + SameSite=Strict cookie, idle + absolute timeout
 * - progressive lockout per account and network (5 → 1 min, 10 → 15 min, 20 → 60 min)
 * - audit log of sign-ins and security changes
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { nowIso, read, update } from "./store";
import { newSecret, verifyTotp } from "./totp";

export const SESSION_COOKIE = "mdx_admin";
const PENDING_COOKIE = "mdx_admin_pending";
const IDLE_MS = Number(process.env.ADMIN_IDLE_MINUTES || 30) * 60_000;
const ABSOLUTE_MS = 12 * 3_600_000;

type Session = { tokenHash: string; createdAt: string; lastSeen: string; ipHint: string; ua: string };
type Pending = { tokenHash: string; createdAt: string; stage: "totp" | "enroll"; secret?: string };
type Lock = { key: string; fails: number; until: number; last: number };
export type AuditEntry = { at: string; event: string; ipHint: string; detail?: string };

type AdminData = {
  totpSecret?: string;
  recovery?: string[]; // sha256 hashes
  freshCodes?: { tokenHash: string; codes: string[]; until: number }; // shown once right after enrollment
  sessions: Session[];
  pending: Pending[];
  locks: Lock[];
  audit: AuditEntry[];
};
const EMPTY: AdminData = { sessions: [], pending: [], locks: [], audit: [] };

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const eq = (a: string, b: string) => {
  const x = Buffer.from(sha(a));
  const y = Buffer.from(sha(b));
  return timingSafeEqual(x, y);
};

export function adminConfigured() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 10);
}

async function requestInfo() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return { ip, ipHint: ip.replace(/(\d+)$/, "x"), ua: (h.get("user-agent") || "").slice(0, 120), https: (h.get("x-forwarded-proto") || "").includes("https") };
}

function audit(d: AdminData, event: string, ipHint: string, detail?: string) {
  d.audit.unshift({ at: nowIso(), event, ipHint, detail });
  if (d.audit.length > 500) d.audit.length = 500;
}

function lockDelay(fails: number) {
  if (fails >= 20) return 60 * 60_000;
  if (fails >= 10) return 15 * 60_000;
  if (fails >= 5) return 60_000;
  return 0;
}

async function cookieOpts() {
  const { https } = await requestInfo();
  const secure = process.env.NODE_ENV === "production" ? https || process.env.ADMIN_COOKIE_SECURE !== "false" : false;
  return { httpOnly: true, sameSite: "strict" as const, secure, path: "/" };
}

export type LoginResult = { ok: true; next: "totp" | "enroll" } | { ok: false; error: string };

/** Step 1: username + password. */
export async function passwordStep(username: string, password: string): Promise<LoginResult> {
  if (!adminConfigured()) return { ok: false, error: "Der Admin-Zugang ist nicht eingerichtet (ADMIN_USERNAME / ADMIN_PASSWORD in der .env, Passwort mind. 10 Zeichen)." };
  const { ip, ipHint } = await requestInfo();
  const keys = ["acct:" + sha(username.toLowerCase()).slice(0, 16), "net:" + sha(ip).slice(0, 16)];
  const now = Date.now();
  const result = await update<AdminData, LoginResult & { token?: string }>("admin", EMPTY, (d) => {
    const locked = d.locks.find((l) => keys.includes(l.key) && l.until > now);
    if (locked) {
      audit(d, "login_locked", ipHint);
      return { ok: false, error: "Zu viele Fehlversuche. Bitte warten Sie einige Minuten und versuchen Sie es erneut." };
    }
    const good = eq(username, process.env.ADMIN_USERNAME!) && eq(password, process.env.ADMIN_PASSWORD!);
    if (!good) {
      for (const k of keys) {
        let l = d.locks.find((x) => x.key === k);
        if (!l) d.locks.push((l = { key: k, fails: 0, until: 0, last: now }));
        if (now - l.last > 24 * 3_600_000) l.fails = 0;
        l.fails++;
        l.last = now;
        l.until = now + lockDelay(l.fails);
      }
      audit(d, "login_failed", ipHint);
      return { ok: false, error: "Benutzername oder Passwort ist falsch." };
    }
    d.locks = d.locks.filter((l) => !keys.includes(l.key));
    const token = randomBytes(32).toString("base64url");
    const stage = d.totpSecret ? "totp" : "enroll";
    d.pending = d.pending.filter((p) => now - new Date(p.createdAt).getTime() < 10 * 60_000);
    d.pending.push({ tokenHash: sha(token), createdAt: nowIso(), stage, secret: stage === "enroll" ? newSecret() : undefined });
    audit(d, "password_ok", ipHint);
    return { ok: true, next: stage, token };
  });
  if (result.ok && "token" in result && result.token) {
    (await cookies()).set(PENDING_COOKIE, result.token, { ...(await cookieOpts()), maxAge: 600 });
    return { ok: true, next: result.next };
  }
  return result;
}

export async function pendingState() {
  const token = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!token) return null;
  const d = await read<AdminData>("admin", EMPTY);
  const p = d.pending.find((x) => x.tokenHash === sha(token));
  if (!p || Date.now() - new Date(p.createdAt).getTime() > 10 * 60_000) return null;
  return { stage: p.stage, secret: p.secret };
}

async function startSession(d: AdminData, ipHint: string, ua: string) {
  const token = randomBytes(32).toString("base64url");
  d.sessions = d.sessions.filter((s) => Date.now() - new Date(s.lastSeen).getTime() < IDLE_MS);
  d.sessions.push({ tokenHash: sha(token), createdAt: nowIso(), lastSeen: nowIso(), ipHint, ua });
  return token;
}

/** Step 2: 6-digit code (or a recovery code) – or confirm enrollment. */
export async function codeStep(code: string): Promise<{ ok: true; recovery?: string[] } | { ok: false; error: string }> {
  const pendingToken = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!pendingToken) return { ok: false, error: "Die Anmeldung ist abgelaufen. Bitte melden Sie sich erneut an." };
  const { ipHint, ua } = await requestInfo();
  const out = await update<AdminData, { ok: true; token: string; recovery?: string[] } | { ok: false; error: string }>("admin", EMPTY, async (d) => {
    const p = d.pending.find((x) => x.tokenHash === sha(pendingToken));
    if (!p) return { ok: false, error: "Die Anmeldung ist abgelaufen. Bitte melden Sie sich erneut an." };
    const clean = code.trim().replace(/\s/g, "");
    if (p.stage === "enroll") {
      if (!p.secret || !verifyTotp(p.secret, clean)) {
        audit(d, "enroll_failed", ipHint);
        return { ok: false, error: "Der Code stimmt nicht. Prüfen Sie die Uhrzeit Ihres Geräts und versuchen Sie es erneut." };
      }
      d.totpSecret = p.secret;
      const recovery = Array.from({ length: 8 }, () => randomBytes(5).toString("hex").toUpperCase().replace(/(.{5})/, "$1-"));
      d.recovery = recovery.map((r) => sha(r));
      d.pending = d.pending.filter((x) => x !== p);
      audit(d, "2fa_enrolled", ipHint);
      const token = await startSession(d, ipHint, ua);
      d.freshCodes = { tokenHash: sha(token), codes: recovery, until: Date.now() + 15 * 60_000 };
      return { ok: true, token, recovery };
    }
    let ok = Boolean(d.totpSecret && verifyTotp(d.totpSecret, clean));
    if (!ok && /^[A-F0-9-]{10,12}$/i.test(clean)) {
      const h = sha(clean.toUpperCase().replace(/^(.{5})-?/, "$1-"));
      if (d.recovery?.includes(h)) {
        d.recovery = d.recovery.filter((x) => x !== h);
        ok = true;
        audit(d, "recovery_code_used", ipHint, `${d.recovery.length} übrig`);
      }
    }
    if (!ok) {
      audit(d, "2fa_failed", ipHint);
      return { ok: false, error: "Der Code ist ungültig." };
    }
    d.pending = d.pending.filter((x) => x !== p);
    audit(d, "login_ok", ipHint);
    return { ok: true, token: await startSession(d, ipHint, ua) };
  });
  if (!out.ok) return out;
  const jar = await cookies();
  jar.delete(PENDING_COOKIE);
  jar.set(SESSION_COOKIE, out.token, { ...(await cookieOpts()), maxAge: ABSOLUTE_MS / 1000 });
  return { ok: true, recovery: out.recovery };
}

/** Returns the session or null (and refreshes the idle timer). */
export async function currentAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const d = await read<AdminData>("admin", EMPTY);
  const s = d.sessions.find((x) => x.tokenHash === sha(token));
  if (!s) return null;
  const now = Date.now();
  if (now - new Date(s.lastSeen).getTime() > IDLE_MS || now - new Date(s.createdAt).getTime() > ABSOLUTE_MS) return null;
  if (now - new Date(s.lastSeen).getTime() > 60_000) {
    await update<AdminData>("admin", EMPTY, (x) => {
      const t = x.sessions.find((y) => y.tokenHash === s.tokenHash);
      if (t) t.lastSeen = nowIso();
    });
  }
  return { username: process.env.ADMIN_USERNAME ?? "admin", since: s.createdAt };
}

/** Use at the top of every admin page and server action. */
export async function requireAdmin() {
  const a = await currentAdmin();
  if (!a) redirect("/admin/login");
  return a;
}

/** Recovery codes of a fresh enrollment – only for the session that created them. */
export async function freshRecoveryCodes() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const d = await read<AdminData>("admin", EMPTY);
  const f = d.freshCodes;
  if (!token || !f || f.tokenHash !== sha(token) || f.until < Date.now()) return null;
  return f.codes;
}

export async function clearRecoveryCodes() {
  await update<AdminData>("admin", EMPTY, (d) => {
    d.freshCodes = undefined;
  });
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const { ipHint } = await requestInfo();
  if (token) {
    await update<AdminData>("admin", EMPTY, (d) => {
      d.sessions = d.sessions.filter((s) => s.tokenHash !== sha(token));
      audit(d, "logout", ipHint);
    });
  }
  jar.delete(SESSION_COOKIE);
}

export async function revokeAllSessions() {
  const { ipHint } = await requestInfo();
  await update<AdminData>("admin", EMPTY, (d) => {
    d.sessions = [];
    audit(d, "sessions_revoked", ipHint);
  });
}

export async function reset2fa() {
  const { ipHint } = await requestInfo();
  await update<AdminData>("admin", EMPTY, (d) => {
    d.totpSecret = undefined;
    d.recovery = [];
    d.sessions = [];
    audit(d, "2fa_reset", ipHint);
  });
}

export async function adminInfo() {
  const d = await read<AdminData>("admin", EMPTY);
  return { has2fa: Boolean(d.totpSecret), recoveryLeft: d.recovery?.length ?? 0, sessions: d.sessions, audit: d.audit.slice(0, 100) };
}
