/**
 * Staff accounts: invitations, role changes, status, 2FA reset, password reset
 * and the own-account functions behind /admin/konto.
 *
 * Every function takes the acting user explicitly and never reads request
 * headers itself (the IP is passed in), so the rules are testable without a
 * request. Rules enforced here (not only in the UI):
 * - nobody changes their own role, disables or deletes themselves
 * - at least one active owner remains
 * - only owners grant or remove the owner role and act on owner accounts
 * - non-admins may only assign roles whose permissions they hold themselves
 */
import { and, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { loginEvents, roles, sessions, tokens, users } from "@/server/db/schema";
import { audit } from "@/server/audit";
import { isPermission, type Permission } from "@/server/auth/permissions";
import { newSecret, verifyTotp } from "@/server/auth/totp";
import { revokeSessions, validatePassword } from "@/server/auth/session";
import { appUrl } from "@/server/lib/app-url";
import { decrypt, encrypt, hashPassword, randomToken, recoveryCode, sha256, verifyPassword } from "@/server/lib/crypto";
import { hit } from "@/server/lib/rate-limit";
import { sendMail } from "@/server/mail/mailer";
import { getSettings } from "@/server/settings";

export const INVITE_DAYS = 7;
export const RESET_MINUTES = 60;

/** The acting staff member (a CurrentUser satisfies this). */
export type Actor = { id: string; email: string; name?: string; role: { key: string; name?: string }; permissions: ReadonlySet<Permission> | Set<Permission> };
export type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const err = (error: string) => ({ ok: false as const, error });
export const isPrivileged = (a: { role: { key: string } }) => a.role.key === "owner" || a.role.key === "admin";
const normEmail = (e: string) => e.trim().toLowerCase();

/** Logs one-time links to the dev server console – only in development, never in production or tests. */
function devLink(label: string, url: string) {
  if (process.env.NODE_ENV === "development") console.info(`[dev] ${label}: ${url}`);
}

/* ------------------------------------------------------------------ roles */

type RoleRow = typeof roles.$inferSelect;

/** May `actor` give `role` to someone (or take it away)? Returns an error message or null. */
export function roleAssignError(actor: Actor, role: Pick<RoleRow, "key" | "permissions">): string | null {
  if (role.key === "owner") return actor.role.key === "owner" ? null : "Nur Inhaber können die Rolle Inhaber vergeben oder entziehen.";
  if (isPrivileged(actor)) return null;
  const missing = role.permissions.filter(isPermission).filter((p) => !actor.permissions.has(p));
  return missing.length ? "Sie können nur Rollen vergeben, deren Berechtigungen Sie selbst haben." : null;
}

async function roleById(id: string) {
  const [r] = await db.select().from(roles).where(eq(roles.id, id));
  return r ?? null;
}

async function activeOwnersExcept(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(roles.key, "owner"), eq(users.status, "active"), ne(users.id, userId)));
  return row?.n ?? 0;
}

async function loadTarget(userId: string) {
  const [row] = await db.select({ user: users, role: roles }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, userId));
  return row ?? null;
}

/** Shared checks before changing another account. */
async function guardTarget(actor: Actor, userId: string, what: "rolle" | "status" | "loeschen" | "2fa" | "sitzungen") {
  const t = await loadTarget(userId);
  if (!t) return { error: "Der Benutzer existiert nicht mehr." } as const;
  if (t.user.id === actor.id && what !== "sitzungen") {
    const msg = {
      rolle: "Sie können Ihre eigene Rolle nicht ändern. Bitten Sie eine andere Person mit der Rolle Inhaber oder Administrator.",
      status: "Sie können Ihr eigenes Konto nicht sperren.",
      loeschen: "Sie können Ihr eigenes Konto nicht löschen.",
      "2fa": "Ihre eigene Zwei-Faktor-Anmeldung verwalten Sie unter «Mein Konto».",
    }[what];
    return { error: msg } as const;
  }
  if (t.role.key === "owner" && actor.role.key !== "owner") return { error: "Nur Inhaber können Konten mit der Rolle Inhaber ändern." } as const;
  return { target: t } as const;
}

/* ------------------------------------------------------------------ lists */

export async function listUsers(opts: { q?: string; status?: "active" | "disabled" | "" } = {}) {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      totpEnabled: users.totpEnabled,
      lastLoginAt: users.lastLoginAt,
      lockedUntil: users.lockedUntil,
      createdAt: users.createdAt,
      roleId: roles.id,
      roleKey: roles.key,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(ne(users.status, "invited"), opts.status ? eq(users.status, opts.status) : undefined))
    .orderBy(users.name);
  const q = opts.q?.trim().toLowerCase();
  return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.includes(q)) : rows;
}

export type InvitationView = {
  userId: string;
  email: string;
  name: string;
  roleName: string;
  invitedAt: Date;
  expiresAt: Date | null;
  invitedBy: string;
  expired: boolean;
};

export async function listInvitations(): Promise<InvitationView[]> {
  const pending = await db
    .select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt, roleName: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.status, "invited"))
    .orderBy(desc(users.createdAt));
  if (!pending.length) return [];
  const toks = await db
    .select()
    .from(tokens)
    .where(and(eq(tokens.type, "invite"), inArray(tokens.userId, pending.map((p) => p.id)), isNull(tokens.usedAt)))
    .orderBy(desc(tokens.createdAt));
  const creatorIds = [...new Set(toks.map((t) => t.createdBy).filter((x): x is string => Boolean(x)))];
  const creators = creatorIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, creatorIds)) : [];
  const now = new Date();
  return pending.map((p) => {
    const tok = toks.find((t) => t.userId === p.id);
    return {
      userId: p.id,
      email: p.email,
      name: p.name,
      roleName: p.roleName,
      invitedAt: tok?.createdAt ?? p.createdAt,
      expiresAt: tok?.expiresAt ?? null,
      invitedBy: creators.find((c) => c.id === tok?.createdBy)?.name ?? "–",
      expired: !tok || tok.expiresAt < now,
    };
  });
}

/* ------------------------------------------------------------- invitations */

async function issueInvite(user: { id: string; email: string; name: string }, actor: Actor, roleName: string) {
  // only one valid link per invitation
  await db.delete(tokens).where(and(eq(tokens.userId, user.id), eq(tokens.type, "invite"), isNull(tokens.usedAt)));
  const token = randomToken();
  await db.insert(tokens).values({
    id: sha256(token),
    type: "invite",
    userId: user.id,
    email: user.email,
    data: { invitedBy: actor.name ?? actor.email, role: roleName },
    createdBy: actor.id,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
  });
  const url = appUrl(`/admin/einladung/${token}`);
  devLink(`Einladung für ${user.email}`, url);
  const general = await getSettings("general");
  const mail = await sendMail({
    to: user.email,
    subject: `Einladung zum Dashboard von ${general.siteName}`,
    template: "user.invite",
    content: {
      title: "Sie wurden eingeladen",
      intro: `${actor.name ?? actor.email} hat Sie zum Dashboard von ${general.siteName} eingeladen (Rolle: ${roleName}).`,
      paragraphs: ["Legen Sie über den Link Ihr Passwort fest. Danach richten Sie bei der ersten Anmeldung die Zwei-Faktor-Anmeldung ein."],
      cta: { label: "Einladung annehmen", url },
      footnote: `Der Link ist ${INVITE_DAYS} Tage gültig und funktioniert einmal. Falls Sie diese Einladung nicht erwartet haben, ignorieren Sie die E-Mail.`,
    },
    related: { type: "user", id: user.id },
  });
  return { token, mail };
}

export async function inviteUser(actor: Actor, input: { email: string; name: string; roleId: string }): Promise<Result<{ userId: string; token: string; mailed: boolean; mailError?: string }>> {
  const email = normEmail(input.email);
  const role = await roleById(input.roleId);
  if (!role) return err("Die gewählte Rolle existiert nicht mehr. Bitte laden Sie die Seite neu.");
  const roleError = roleAssignError(actor, role);
  if (roleError) return err(roleError);
  const [existing] = await db.select({ id: users.id, status: users.status }).from(users).where(eq(users.email, email));
  if (existing) {
    return err(existing.status === "invited" ? "Diese Person ist bereits eingeladen. Senden Sie die Einladung unter «Einladungen» erneut." : "Für diese E-Mail-Adresse gibt es bereits ein Konto.");
  }
  const [u] = await db.insert(users).values({ email, name: input.name.trim(), roleId: role.id, status: "invited", passwordHash: null }).returning();
  const { token, mail } = await issueInvite(u, actor, role.name);
  await audit(actor, "user.invited", { entityType: "user", entityId: u.id, summary: `${email} eingeladen (${role.name})`, data: { email, role: role.key } });
  return { ok: true, userId: u.id, token, mailed: mail.ok, mailError: mail.error };
}

export async function resendInvitation(actor: Actor, userId: string): Promise<Result<{ token: string; mailed: boolean; mailError?: string }>> {
  const t = await loadTarget(userId);
  if (!t || t.user.status !== "invited") return err("Diese Einladung gibt es nicht mehr.");
  const roleError = roleAssignError(actor, t.role);
  if (roleError) return err(roleError);
  const { token, mail } = await issueInvite(t.user, actor, t.role.name);
  await audit(actor, "user.invite_resent", { entityType: "user", entityId: userId, summary: `Einladung an ${t.user.email} erneut gesendet` });
  return { ok: true, token, mailed: mail.ok, mailError: mail.error };
}

export async function revokeInvitation(actor: Actor, userId: string): Promise<Result> {
  const t = await loadTarget(userId);
  if (!t || t.user.status !== "invited") return err("Diese Einladung gibt es nicht mehr.");
  if (t.role.key === "owner" && actor.role.key !== "owner") return err("Nur Inhaber können diese Einladung zurückziehen.");
  await db.delete(users).where(and(eq(users.id, userId), eq(users.status, "invited")));
  await audit(actor, "user.invite_revoked", { entityType: "user", entityId: userId, summary: `Einladung an ${t.user.email} zurückgezogen` });
  return { ok: true };
}

export type TokenState = "valid" | "expired" | "used" | "invalid";

async function readToken(raw: string, type: "invite" | "password_reset") {
  if (!raw || raw.length < 20 || raw.length > 100) return { state: "invalid" as TokenState, row: null };
  const [row] = await db.select().from(tokens).where(and(eq(tokens.id, sha256(raw)), eq(tokens.type, type)));
  if (!row) return { state: "invalid" as TokenState, row: null };
  if (row.usedAt) return { state: "used" as TokenState, row };
  if (row.expiresAt < new Date()) return { state: "expired" as TokenState, row };
  return { state: "valid" as TokenState, row };
}

/** For the invitation page: who invited, for which address and role. */
export async function findInvite(raw: string) {
  const { state, row } = await readToken(raw, "invite");
  if (state !== "valid" || !row?.userId) return { state: state === "valid" ? ("invalid" as TokenState) : state };
  const t = await loadTarget(row.userId);
  if (!t || t.user.status !== "invited") return { state: "used" as TokenState };
  return {
    state,
    invite: { email: t.user.email, name: t.user.name, roleName: t.role.name, invitedBy: String(row.data.invitedBy ?? ""), expiresAt: row.expiresAt },
  };
}

export async function acceptInvite(raw: string, input: { name: string; password: string }): Promise<Result<{ email: string }>> {
  const { state, row } = await readToken(raw, "invite");
  if (state === "expired") return err("Die Einladung ist abgelaufen. Bitten Sie die Person, die Sie eingeladen hat, um eine neue Einladung.");
  if (state !== "valid" || !row?.userId) return err("Die Einladung ist ungültig oder wurde bereits verwendet.");
  const weak = await validatePassword(input.password);
  if (weak) return err(weak);
  // mark the token used first (single use even under concurrent submits)
  const claimed = await db.update(tokens).set({ usedAt: new Date() }).where(and(eq(tokens.id, row.id), isNull(tokens.usedAt))).returning({ id: tokens.id });
  if (!claimed.length) return err("Die Einladung wurde bereits verwendet.");
  const [u] = await db
    .update(users)
    .set({ name: input.name.trim(), passwordHash: await hashPassword(input.password), status: "active", passwordChangedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(users.id, row.userId), eq(users.status, "invited")))
    .returning();
  if (!u) return err("Die Einladung ist ungültig oder wurde bereits verwendet.");
  await audit({ id: u.id, email: u.email }, "user.invite_accepted", { entityType: "user", entityId: u.id, summary: "Einladung angenommen und Konto aktiviert" });
  return { ok: true, email: u.email };
}

/* ------------------------------------------------------- account changes */

export async function changeUserRole(actor: Actor, userId: string, roleId: string): Promise<Result> {
  const g = await guardTarget(actor, userId, "rolle");
  if ("error" in g) return err(g.error!);
  const { target } = g;
  const role = await roleById(roleId);
  if (!role) return err("Die gewählte Rolle existiert nicht mehr.");
  if (role.id === target.role.id) return { ok: true };
  const roleError = roleAssignError(actor, role) ?? roleAssignError(actor, target.role);
  if (roleError) return err(roleError);
  if (target.role.key === "owner" && (await activeOwnersExcept(userId)) < 1) return err("Es muss mindestens ein aktiver Inhaber bleiben. Geben Sie zuerst einer anderen Person die Rolle Inhaber.");
  await db.update(users).set({ roleId: role.id, updatedAt: new Date() }).where(eq(users.id, userId));
  await audit(actor, "user.role_changed", {
    entityType: "user",
    entityId: userId,
    summary: `Rolle von ${target.user.email}: ${target.role.name} → ${role.name}`,
    data: { from: target.role.key, to: role.key },
  });
  return { ok: true };
}

export async function setUserStatus(actor: Actor, userId: string, status: "active" | "disabled"): Promise<Result> {
  const g = await guardTarget(actor, userId, "status");
  if ("error" in g) return err(g.error!);
  const { target } = g;
  if (target.user.status === "invited") return err("Eingeladene Personen können nicht gesperrt werden. Ziehen Sie die Einladung zurück.");
  if (status === "disabled" && target.role.key === "owner" && (await activeOwnersExcept(userId)) < 1) return err("Der letzte aktive Inhaber kann nicht gesperrt werden.");
  await db.update(users).set({ status, failedLogins: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(users.id, userId));
  if (status === "disabled") await revokeSessions(userId);
  await audit(actor, status === "disabled" ? "user.disabled" : "user.enabled", {
    entityType: "user",
    entityId: userId,
    summary: `${target.user.email} ${status === "disabled" ? "gesperrt" : "entsperrt"}`,
  });
  return { ok: true };
}

/** Removes the 2FA secret and recovery codes; the user enrols again at the next sign-in. */
export async function resetUserTwoFactor(actor: Actor, userId: string): Promise<Result> {
  const g = await guardTarget(actor, userId, "2fa");
  if ("error" in g) return err(g.error!);
  await db.update(users).set({ totpEnabled: false, totpSecret: null, recoveryCodes: [], updatedAt: new Date() }).where(eq(users.id, userId));
  await revokeSessions(userId);
  await audit(actor, "user.2fa_reset", { entityType: "user", entityId: userId, summary: `Zwei-Faktor-Anmeldung von ${g.target.user.email} zurückgesetzt` });
  return { ok: true };
}

export async function signOutUser(actor: Actor, userId: string): Promise<Result> {
  const g = await guardTarget(actor, userId, "sitzungen");
  if ("error" in g) return err(g.error!);
  await revokeSessions(userId);
  await audit(actor, "user.sessions_revoked", { entityType: "user", entityId: userId, summary: `Alle Sitzungen von ${g.target.user.email} beendet` });
  return { ok: true };
}

export async function deleteUser(actor: Actor, userId: string): Promise<Result> {
  const g = await guardTarget(actor, userId, "loeschen");
  if ("error" in g) return err(g.error!);
  const { target } = g;
  if (target.role.key === "owner" && (await activeOwnersExcept(userId)) < 1) return err("Der letzte aktive Inhaber kann nicht gelöscht werden.");
  await db.delete(users).where(eq(users.id, userId));
  await audit(actor, "user.deleted", { entityType: "user", entityId: userId, summary: `${target.user.email} gelöscht`, data: { email: target.user.email, name: target.user.name, role: target.role.key } });
  return { ok: true };
}

export async function getUser(userId: string) {
  return loadTarget(userId);
}

/* --------------------------------------------------------- password reset */

/**
 * Starts a password reset. Always behaves the same for the caller (no hint
 * whether the address exists); limited per IP and per address.
 */
export async function requestPasswordReset(emailRaw: string, ip: string): Promise<void> {
  const email = normEmail(emailRaw);
  const perIp = await hit(`pwreset:ip:${ip}`, 10, 60 * 60_000);
  const perEmail = await hit(`pwreset:email:${sha256(email)}`, 3, 60 * 60_000);
  if (!perIp.allowed || !perEmail.allowed) return;
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u || u.status !== "active") return;
  await db.delete(tokens).where(and(eq(tokens.userId, u.id), eq(tokens.type, "password_reset"), isNull(tokens.usedAt)));
  const token = randomToken();
  await db.insert(tokens).values({ id: sha256(token), type: "password_reset", userId: u.id, email: u.email, data: { ip }, expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) });
  const url = appUrl(`/admin/passwort-zuruecksetzen/${token}`);
  devLink(`Passwort zurücksetzen für ${u.email}`, url);
  const general = await getSettings("general");
  await sendMail({
    to: u.email,
    subject: `Passwort zurücksetzen – ${general.siteName} Dashboard`,
    template: "user.password_reset",
    content: {
      title: "Passwort zurücksetzen",
      intro: `Für Ihr Konto im Dashboard von ${general.siteName} wurde ein neues Passwort angefordert.`,
      cta: { label: "Neues Passwort festlegen", url },
      footnote: `Der Link ist ${RESET_MINUTES} Minuten gültig und funktioniert einmal. Haben Sie nichts angefordert, ignorieren Sie diese E-Mail – Ihr Passwort bleibt unverändert.`,
    },
    related: { type: "user", id: u.id },
  });
  await audit({ id: u.id, email: u.email }, "user.password_reset_requested", { entityType: "user", entityId: u.id, summary: "Link zum Zurücksetzen des Passworts angefordert", ip });
}

export async function findResetToken(raw: string) {
  const { state, row } = await readToken(raw, "password_reset");
  return { state, email: state === "valid" ? row?.email : undefined };
}

export async function resetPassword(raw: string, password: string, ip = ""): Promise<Result<{ email: string }>> {
  const { state, row } = await readToken(raw, "password_reset");
  if (state === "expired") return err("Der Link ist abgelaufen. Fordern Sie einen neuen an.");
  if (state !== "valid" || !row?.userId) return err("Der Link ist ungültig oder wurde bereits verwendet. Fordern Sie einen neuen an.");
  const weak = await validatePassword(password);
  if (weak) return err(weak);
  const claimed = await db.update(tokens).set({ usedAt: new Date() }).where(and(eq(tokens.id, row.id), isNull(tokens.usedAt))).returning({ id: tokens.id });
  if (!claimed.length) return err("Der Link wurde bereits verwendet.");
  const [u] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null, updatedAt: new Date() })
    .where(and(eq(users.id, row.userId), eq(users.status, "active")))
    .returning();
  if (!u) return err("Das Konto ist nicht aktiv. Wenden Sie sich an eine Person mit der Rolle Inhaber oder Administrator.");
  await revokeSessions(u.id);
  await audit({ id: u.id, email: u.email }, "user.password_reset", { entityType: "user", entityId: u.id, summary: "Passwort über den E-Mail-Link zurückgesetzt, alle Sitzungen beendet", ip });
  return { ok: true, email: u.email };
}

/* ------------------------------------------------------------ own account */

async function checkOwnPassword(userId: string, password: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return { error: "Konto nicht gefunden." } as const;
  const limit = await hit(`account:pw:${userId}`, 10, 15 * 60_000);
  if (!limit.allowed) return { error: "Zu viele Versuche. Bitte warten Sie 15 Minuten." } as const;
  if (!(await verifyPassword(password, u.passwordHash))) return { error: "Das aktuelle Passwort ist falsch." } as const;
  return { user: u } as const;
}

export async function updateProfile(actor: Actor, input: { name: string; email: string; currentPassword?: string }): Promise<Result<{ emailChanged: boolean }>> {
  const email = normEmail(input.email);
  const [me] = await db.select().from(users).where(eq(users.id, actor.id));
  if (!me) return err("Konto nicht gefunden.");
  const emailChanged = email !== me.email;
  if (emailChanged) {
    if (!input.currentPassword) return err("Bitte bestätigen Sie die neue E-Mail-Adresse mit Ihrem aktuellen Passwort.");
    const check = await checkOwnPassword(actor.id, input.currentPassword);
    if ("error" in check) return err(check.error!);
    const [taken] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), ne(users.id, actor.id)));
    if (taken) return err("Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.");
  }
  await db.update(users).set({ name: input.name.trim(), email, updatedAt: new Date() }).where(eq(users.id, actor.id));
  if (emailChanged) {
    const general = await getSettings("general");
    await sendMail({
      to: me.email,
      subject: `Ihre E-Mail-Adresse wurde geändert – ${general.siteName} Dashboard`,
      template: "user.email_changed",
      content: {
        title: "E-Mail-Adresse geändert",
        intro: `Die Anmelde-Adresse Ihres Dashboard-Kontos wurde von ${me.email} auf ${email} geändert.`,
        footnote: "Waren Sie das nicht? Wenden Sie sich sofort an eine Person mit der Rolle Inhaber oder Administrator.",
      },
      related: { type: "user", id: me.id },
    });
  }
  await audit(actor, emailChanged ? "user.email_changed" : "user.profile_updated", {
    entityType: "user",
    entityId: actor.id,
    summary: emailChanged ? `E-Mail geändert: ${me.email} → ${email}` : "Profil aktualisiert",
  });
  return { ok: true, emailChanged };
}

/** Changes the own password and signs out all other sessions. */
export async function changeOwnPassword(actor: Actor & { sessionId?: string }, current: string, next: string): Promise<Result> {
  const check = await checkOwnPassword(actor.id, current);
  if ("error" in check) return err(check.error!);
  const weak = await validatePassword(next);
  if (weak) return err(weak);
  if (await verifyPassword(next, check.user.passwordHash)) return err("Das neue Passwort muss sich vom bisherigen unterscheiden.");
  await db.update(users).set({ passwordHash: await hashPassword(next), passwordChangedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, actor.id));
  await revokeSessions(actor.id, actor.sessionId);
  await audit(actor, "user.password_changed", { entityType: "user", entityId: actor.id, summary: "Passwort geändert, andere Sitzungen beendet" });
  return { ok: true };
}

/** Turns 2FA off for the own account – only when the policy does not require it. */
export async function disableOwnTwoFactor(actor: Actor, password: string): Promise<Result> {
  if ((await getSettings("security")).require2fa) return err("Die Sicherheitsrichtlinie verlangt die Zwei-Faktor-Anmeldung für alle Konten.");
  const check = await checkOwnPassword(actor.id, password);
  if ("error" in check) return err(check.error!);
  await db.update(users).set({ totpEnabled: false, totpSecret: null, recoveryCodes: [], updatedAt: new Date() }).where(eq(users.id, actor.id));
  await audit(actor, "user.2fa_disabled", { entityType: "user", entityId: actor.id, summary: "Zwei-Faktor-Anmeldung ausgeschaltet" });
  return { ok: true };
}

/**
 * Starts 2FA setup from the account page. The secret travels to the browser
 * only inside an encrypted, user-bound, 10-minute envelope (no server state).
 */
export function beginTwoFactorSetup(actor: Actor) {
  const secret = newSecret();
  const sealed = encrypt(JSON.stringify({ u: actor.id, s: secret, t: Date.now() }));
  return { secret, sealed };
}

function makeRecoveryCodes() {
  const codes = Array.from({ length: 10 }, recoveryCode);
  return { codes, hashes: codes.map((c) => sha256(c)) };
}

export async function confirmTwoFactorSetup(actor: Actor & { sessionId?: string }, sealed: string, code: string): Promise<Result> {
  let payload: { u: string; s: string; t: number };
  try {
    payload = JSON.parse(decrypt(sealed));
  } catch {
    return err("Die Einrichtung ist ungültig. Bitte laden Sie die Seite neu.");
  }
  if (payload.u !== actor.id || Date.now() - payload.t > 10 * 60_000) return err("Die Einrichtung ist abgelaufen. Bitte laden Sie die Seite neu und scannen Sie den neuen QR-Code.");
  const limit = await hit(`account:2fa:${actor.id}`, 10, 15 * 60_000);
  if (!limit.allowed) return err("Zu viele Versuche. Bitte warten Sie 15 Minuten.");
  if (!verifyTotp(payload.s, code)) return err("Der Code stimmt nicht. Prüfen Sie die Uhrzeit Ihres Geräts und versuchen Sie es erneut.");
  const { codes, hashes } = makeRecoveryCodes();
  await db.update(users).set({ totpSecret: encrypt(payload.s), totpEnabled: true, recoveryCodes: hashes, updatedAt: new Date() }).where(eq(users.id, actor.id));
  // codes are shown once on /admin/wiederherstellungscodes (same mechanism as at sign-in)
  if (actor.sessionId) await db.update(sessions).set({ pendingSecret: encrypt(JSON.stringify(codes)) }).where(eq(sessions.id, actor.sessionId));
  await audit(actor, "user.2fa_enabled", { entityType: "user", entityId: actor.id, summary: "Zwei-Faktor-Anmeldung eingerichtet" });
  return { ok: true };
}

export async function verifyOwnPassword(actor: Actor, password: string): Promise<Result> {
  const check = await checkOwnPassword(actor.id, password);
  return "error" in check ? err(check.error!) : { ok: true };
}

export async function revokeOwnSession(actor: Actor, sessionId: string): Promise<Result> {
  const res = await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, actor.id))).returning({ id: sessions.id });
  if (!res.length) return err("Diese Sitzung ist bereits beendet.");
  await audit(actor, "user.session_revoked", { entityType: "user", entityId: actor.id, summary: "Eine eigene Sitzung beendet" });
  return { ok: true };
}

export async function recentLoginEvents(userId: string, limit = 15) {
  return db.select().from(loginEvents).where(eq(loginEvents.userId, userId)).orderBy(desc(loginEvents.createdAt)).limit(limit);
}

export async function recoveryCodesLeft(userId: string) {
  const [u] = await db.select({ codes: users.recoveryCodes }).from(users).where(eq(users.id, userId));
  return u?.codes.length ?? 0;
}

/** Active sessions of a user (for the user drawer). */
export async function sessionCount(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.stage, "active"), gt(sessions.expiresAt, new Date())));
  return row?.n ?? 0;
}
