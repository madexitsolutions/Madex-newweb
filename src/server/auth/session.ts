/**
 * Staff authentication:
 * - e-mail + password (scrypt), then a TOTP code (or a one-time recovery code)
 * - 2FA enrollment is enforced when the security policy requires it
 * - server-side sessions (only a hash of the cookie token is stored), idle and
 *   absolute timeouts from the security settings
 * - account lockout after repeated failures, per-IP rate limit, optional IP allowlist
 * - every sign-in attempt lands in login_events, security changes in the audit log
 */
import { and, eq, gt, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { loginEvents, roles, sessions, users } from "@/server/db/schema";
import { decrypt, encrypt, hashPassword, randomToken, recoveryCode, sha256, verifyPassword } from "@/server/lib/crypto";
import { ipMatches } from "@/server/lib/ip";
import { isIpBlocked } from "@/server/lib/ip-blocks";
import { hit } from "@/server/lib/rate-limit";
import { requestInfo } from "@/server/lib/request";
import { getSettings } from "@/server/settings";
import { audit } from "@/server/audit";
import { isPermission, type Permission } from "./permissions";
import { newSecret, verifyTotp } from "./totp";

export const SESSION_COOKIE = "pd_session";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: { id: string; key: string; name: string };
  permissions: Set<Permission>;
  totpEnabled: boolean;
  sessionId: string;
};

async function cookieOptions(maxAgeSeconds: number) {
  const { https } = await requestInfo();
  const secure = process.env.NODE_ENV === "production" ? https || process.env.COOKIE_SECURE !== "false" : false;
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: maxAgeSeconds };
}

async function logEvent(email: string, success: boolean, reason: string, userId?: string | null) {
  const { ip, userAgent } = await requestInfo();
  await db.insert(loginEvents).values({ email: email.toLowerCase(), success, reason, userId: userId ?? null, ip, userAgent });
}

async function createSession(userId: string, stage: "password" | "enroll" | "active", pendingSecret?: string | null) {
  const sec = await getSettings("security");
  const { ip, userAgent } = await requestInfo();
  const token = randomToken();
  const ttlMs = stage === "active" ? sec.sessionMaxHours * 3_600_000 : 10 * 60_000;
  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    stage,
    pendingSecret: pendingSecret ?? null,
    ip,
    userAgent,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  (await cookies()).set(SESSION_COOKIE, token, await cookieOptions(Math.round(ttlMs / 1000)));
}

async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [s] = await db.select().from(sessions).where(eq(sessions.id, sha256(token)));
  if (!s || s.expiresAt < new Date()) return null;
  return s;
}

export async function ipAllowed(ip: string) {
  const { adminIpAllowlist } = await getSettings("security");
  return adminIpAllowlist.length === 0 || adminIpAllowlist.some((r) => ipMatches(ip, r));
}

/** The signed-in staff member (fully authenticated), cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const s = await readSession();
  if (!s || s.stage !== "active") return null;
  const sec = await getSettings("security");
  const now = Date.now();
  if (now - s.lastSeenAt.getTime() > sec.sessionIdleMinutes * 60_000) {
    await db.delete(sessions).where(eq(sessions.id, s.id));
    return null;
  }
  const [row] = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, s.userId));
  if (!row || row.user.status !== "active") return null;
  const { ip } = await requestInfo();
  if (!(await ipAllowed(ip))) return null;
  // IP blocks (Sicherheit → Sperren): a blocked address loses dashboard access immediately
  if (await isIpBlocked(ip)) return null;
  if (now - s.lastSeenAt.getTime() > 60_000) await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, s.id));
  return {
    id: row.user.id,
    email: row.user.email,
    name: row.user.name,
    role: { id: row.role.id, key: row.role.key, name: row.role.name },
    permissions: new Set(row.role.permissions.filter(isPermission)),
    totpEnabled: row.user.totpEnabled,
    sessionId: s.id,
  };
});

/** Top of every admin page / server action. Redirects to the login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/admin/login");
  return u;
}

export function can(user: CurrentUser | null, permission: Permission) {
  return Boolean(user?.permissions.has(permission));
}

/** Like requireUser, but also checks a permission (shows the "no access" page otherwise). */
export async function requirePermission(...needed: Permission[]): Promise<CurrentUser> {
  const u = await requireUser();
  if (!needed.every((p) => u.permissions.has(p))) redirect("/admin/kein-zugriff");
  return u;
}

/** For server actions that return an error instead of redirecting. */
export async function checkPermission(...needed: Permission[]): Promise<CurrentUser | null> {
  const u = await getCurrentUser();
  if (!u || !needed.every((p) => u.permissions.has(p))) return null;
  return u;
}

export type LoginResult = { ok: true; next: "code" | "enroll" | "done" } | { ok: false; error: string };

export async function passwordLogin(emailRaw: string, password: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const { ip } = await requestInfo();
  const sec = await getSettings("security");
  if (!(await ipAllowed(ip))) {
    await logEvent(email, false, "ip_not_allowed");
    return { ok: false, error: "Von diesem Netzwerk ist keine Anmeldung erlaubt." };
  }
  // IP blocks (Sicherheit → Sperren)
  if (await isIpBlocked(ip)) {
    await logEvent(email, false, "ip_blocked");
    return { ok: false, error: "Von dieser IP-Adresse ist keine Anmeldung möglich." };
  }
  const ipLimit = await hit(`login:ip:${ip}`, 30, 15 * 60_000);
  if (!ipLimit.allowed) {
    await logEvent(email, false, "rate_limited");
    return { ok: false, error: "Zu viele Anmeldeversuche von diesem Netzwerk. Bitte warten Sie einige Minuten." };
  }
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await logEvent(email, false, "locked", user.id);
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return { ok: false, error: `Das Konto ist nach mehreren Fehlversuchen vorübergehend gesperrt. Versuchen Sie es in ${minutes} Minute${minutes === 1 ? "" : "n"} erneut.` };
  }
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid || user.status !== "active") {
    if (user && !valid) {
      const fails = user.failedLogins + 1;
      const lock = fails >= sec.loginMaxAttempts ? new Date(Date.now() + sec.lockoutMinutes * 60_000) : null;
      await db.update(users).set({ failedLogins: lock ? 0 : fails, lockedUntil: lock }).where(eq(users.id, user.id));
      if (lock) await audit({ id: user.id, email: user.email }, "user.locked", { entityType: "user", entityId: user.id, summary: "Konto nach Fehlversuchen gesperrt" });
    }
    await logEvent(email, false, !user ? "unknown_user" : user.status !== "active" ? "disabled" : "bad_password", user?.id);
    return { ok: false, error: "E-Mail oder Passwort ist falsch." };
  }
  await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, user.id));
  if (user.totpEnabled) {
    await createSession(user.id, "password");
    return { ok: true, next: "code" };
  }
  if (sec.require2fa) {
    await createSession(user.id, "enroll", encrypt(newSecret()));
    return { ok: true, next: "enroll" };
  }
  await finishLogin(user.id, user.email);
  return { ok: true, next: "done" };
}

async function finishLogin(userId: string, email: string, freshCodes?: string[]) {
  const old = (await cookies()).get(SESSION_COOKIE)?.value;
  if (old) await db.delete(sessions).where(eq(sessions.id, sha256(old)));
  await createSession(userId, "active", freshCodes ? encrypt(JSON.stringify(freshCodes)) : null);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  await logEvent(email, true, "ok", userId);
}

/** State of a sign-in in progress (between password and code). */
export async function pendingLogin() {
  const s = await readSession();
  if (!s || s.stage === "active") return null;
  const [u] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, s.userId));
  if (!u) return null;
  return { stage: s.stage, email: u.email, secret: s.stage === "enroll" && s.pendingSecret ? decrypt(s.pendingSecret) : null };
}

export async function verifySecondFactor(codeRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await readSession();
  if (!s || s.stage !== "password") return { ok: false, error: "Die Anmeldung ist abgelaufen. Bitte melden Sie sich erneut an." };
  const { ip } = await requestInfo();
  const limit = await hit(`2fa:${s.userId}`, 10, 15 * 60_000);
  const [user] = await db.select().from(users).where(eq(users.id, s.userId));
  if (!user || !limit.allowed) return { ok: false, error: "Zu viele Versuche. Bitte melden Sie sich erneut an." };
  const code = codeRaw.trim().replace(/\s/g, "").toUpperCase();
  let ok = Boolean(user.totpSecret && /^\d{6}$/.test(code) && verifyTotp(decrypt(user.totpSecret), code));
  if (!ok && /^[A-Z0-9]{5}-?[A-Z0-9]{5}$/.test(code)) {
    const h = sha256(code.replace(/^(.{5})-?/, "$1-"));
    if (user.recoveryCodes.includes(h)) {
      ok = true;
      await db.update(users).set({ recoveryCodes: user.recoveryCodes.filter((x) => x !== h) }).where(eq(users.id, user.id));
      await audit({ id: user.id, email: user.email }, "user.recovery_code_used", { entityType: "user", entityId: user.id, summary: `Wiederherstellungscode verwendet (${user.recoveryCodes.length - 1} übrig)`, ip });
    }
  }
  if (!ok) {
    await logEvent(user.email, false, "bad_2fa", user.id);
    return { ok: false, error: "Der Code ist ungültig." };
  }
  await finishLogin(user.id, user.email);
  return { ok: true };
}

function makeRecoveryCodes() {
  const codes = Array.from({ length: 10 }, recoveryCode);
  return { codes, hashes: codes.map((c) => sha256(c)) };
}

export async function confirmEnrollment(codeRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await readSession();
  if (!s || s.stage !== "enroll" || !s.pendingSecret) return { ok: false, error: "Die Anmeldung ist abgelaufen. Bitte melden Sie sich erneut an." };
  const secret = decrypt(s.pendingSecret);
  if (!verifyTotp(secret, codeRaw)) return { ok: false, error: "Der Code stimmt nicht. Prüfen Sie die Uhrzeit Ihres Geräts und versuchen Sie es erneut." };
  const [user] = await db.select().from(users).where(eq(users.id, s.userId));
  if (!user) return { ok: false, error: "Benutzer nicht gefunden." };
  const { codes, hashes } = makeRecoveryCodes();
  await db.update(users).set({ totpSecret: encrypt(secret), totpEnabled: true, recoveryCodes: hashes, updatedAt: new Date() }).where(eq(users.id, user.id));
  await audit({ id: user.id, email: user.email }, "user.2fa_enabled", { entityType: "user", entityId: user.id, summary: "Zwei-Faktor-Anmeldung eingerichtet" });
  await finishLogin(user.id, user.email, codes);
  return { ok: true };
}

/** Recovery codes generated in this session, shown exactly once. */
export async function takeFreshRecoveryCodes(): Promise<string[] | null> {
  const s = await readSession();
  if (!s || s.stage !== "active" || !s.pendingSecret) return null;
  try {
    return JSON.parse(decrypt(s.pendingSecret)) as string[];
  } catch {
    return null;
  }
}

export async function dismissFreshRecoveryCodes() {
  const s = await readSession();
  if (s) await db.update(sessions).set({ pendingSecret: null }).where(eq(sessions.id, s.id));
}

/** Creates new recovery codes for the signed-in user (invalidates the old ones). */
export async function regenerateRecoveryCodes(user: CurrentUser) {
  const { codes, hashes } = makeRecoveryCodes();
  await db.update(users).set({ recoveryCodes: hashes }).where(eq(users.id, user.id));
  await db.update(sessions).set({ pendingSecret: encrypt(JSON.stringify(codes)) }).where(eq(sessions.id, user.sessionId));
  await audit(user, "user.recovery_codes_regenerated", { entityType: "user", entityId: user.id, summary: "Neue Wiederherstellungscodes erstellt" });
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export async function revokeSessions(userId: string, exceptSessionId?: string) {
  await db.delete(sessions).where(exceptSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId)) : eq(sessions.userId, userId));
}

export async function activeSessions(userId: string) {
  return db
    .select({ id: sessions.id, ip: sessions.ip, userAgent: sessions.userAgent, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.stage, "active"), gt(sessions.expiresAt, new Date())));
}

export async function hasAnyUser() {
  const [u] = await db.select({ id: users.id }).from(users).limit(1);
  return Boolean(u);
}

/** First-run setup: creates the owner account (only while no user exists). */
export async function createOwner(input: { name: string; email: string; password: string }) {
  if (await hasAnyUser()) return { ok: false as const, error: "Die Einrichtung ist bereits abgeschlossen." };
  const [owner] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, "owner"));
  if (!owner) return { ok: false as const, error: "Die Datenbank ist nicht initialisiert." };
  const [u] = await db
    .insert(users)
    .values({ name: input.name.trim(), email: input.email.trim().toLowerCase(), passwordHash: await hashPassword(input.password), roleId: owner.id, passwordChangedAt: new Date() })
    .returning();
  await audit({ id: u.id, email: u.email }, "setup.owner_created", { entityType: "user", entityId: u.id, summary: "Inhaber-Konto bei der Einrichtung erstellt" });
  return { ok: true as const };
}

export async function validatePassword(password: string): Promise<string | null> {
  const { passwordMinLength } = await getSettings("security");
  if (password.length < passwordMinLength) return `Das Passwort muss mindestens ${passwordMinLength} Zeichen lang sein.`;
  if (password.length > 200) return "Das Passwort ist zu lang.";
  if (/^(.)\1+$/.test(password)) return "Das Passwort ist zu einfach.";
  const common = ["passwort", "password", "123456789", "qwertz", "qwerty", "admin", "willkommen"];
  if (common.some((c) => password.toLowerCase().includes(c) && password.length < c.length + 6)) return "Das Passwort ist zu leicht zu erraten.";
  return null;
}
