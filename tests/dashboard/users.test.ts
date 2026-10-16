import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { auditLog, roles, sessions, tokens, users } from "@/server/db/schema";
import { ALL_PERMISSIONS, type Permission } from "@/server/auth/permissions";
import { hashPassword, sha256, verifyPassword } from "@/server/lib/crypto";
import {
  acceptInvite,
  changeOwnPassword,
  changeUserRole,
  deleteUser,
  findInvite,
  findResetToken,
  inviteUser,
  requestPasswordReset,
  resendInvitation,
  resetPassword,
  resetUserTwoFactor,
  revokeInvitation,
  setUserStatus,
  type Actor,
} from "@/server/users";
import { ADMIN_ONLY_PERMISSIONS, createRole, deleteRole, resolveRolePermissions, updateRole } from "@/server/roles";

const PW = "Sonnenblume Zürich 2026";

async function role(key: string) {
  const [r] = await db.select().from(roles).where(eq(roles.key, key));
  return r;
}

let n = 0;
async function makeUser(roleKey: string, status: "active" | "disabled" = "active") {
  const r = await role(roleKey);
  const [u] = await db
    .insert(users)
    .values({ email: `u${++n}-${roleKey}@example.ch`, name: `User ${n}`, roleId: r.id, status, passwordHash: await hashPassword(PW) })
    .returning();
  const actor: Actor & { sessionId?: string } = { id: u.id, email: u.email, name: u.name, role: { key: r.key, name: r.name }, permissions: new Set(r.permissions as Permission[]) };
  return { user: u, actor, role: r };
}

async function addSession(userId: string, id = sha256(Math.random().toString())) {
  await db.insert(sessions).values({ id, userId, stage: "active", expiresAt: new Date(Date.now() + 3_600_000) });
  return id;
}

describe("Einladungen", () => {
  it("lädt ein, Token ist nur einmal verwendbar und aktiviert das Konto", async () => {
    const owner = await makeUser("owner");
    const editor = await role("editor");
    const r = await inviteUser(owner.actor, { email: "Neu@Example.ch", name: "Neue Person", roleId: editor.id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // only the hash is stored
    const [tok] = await db.select().from(tokens).where(eq(tokens.userId, r.userId));
    expect(tok.id).toBe(sha256(r.token));
    expect(tok.type).toBe("invite");
    expect(tok.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6.9 * 86_400_000);

    const view = await findInvite(r.token);
    expect(view.state).toBe("valid");
    expect(view.invite?.email).toBe("neu@example.ch");

    expect((await acceptInvite(r.token, { name: "Neue Person", password: "kurz" })).ok).toBe(false);
    const ok = await acceptInvite(r.token, { name: "Nora Neu", password: PW });
    expect(ok.ok).toBe(true);
    const [u] = await db.select().from(users).where(eq(users.id, r.userId));
    expect(u.status).toBe("active");
    expect(u.name).toBe("Nora Neu");
    expect(await verifyPassword(PW, u.passwordHash)).toBe(true);

    // second use fails
    expect((await acceptInvite(r.token, { name: "X", password: PW })).ok).toBe(false);
    expect((await findInvite(r.token)).state).toBe("used");
  });

  it("weist abgelaufene Einladungen ab und ersetzt den Link beim erneuten Senden", async () => {
    const owner = await makeUser("owner");
    const viewer = await role("viewer");
    const r = await inviteUser(owner.actor, { email: "alt@example.ch", name: "Alt", roleId: viewer.id });
    if (!r.ok) throw new Error(r.error);
    await db.update(tokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(tokens.id, sha256(r.token)));
    expect((await findInvite(r.token)).state).toBe("expired");
    expect((await acceptInvite(r.token, { name: "Alt", password: PW })).ok).toBe(false);

    const again = await resendInvitation(owner.actor, r.userId);
    if (!again.ok) throw new Error(again.error);
    expect((await findInvite(r.token)).state).toBe("invalid"); // old link removed
    expect((await findInvite(again.token)).state).toBe("valid");

    expect((await revokeInvitation(owner.actor, r.userId)).ok).toBe(true);
    expect((await findInvite(again.token)).state).toBe("invalid");
  });

  it("verhindert doppelte Konten und Inhaber-Einladungen durch Nicht-Inhaber", async () => {
    const admin = await makeUser("admin");
    const owner = await role("owner");
    const r = await inviteUser(admin.actor, { email: "boss@example.ch", name: "Boss", roleId: owner.id });
    expect(r.ok).toBe(false);
    const dup = await inviteUser(admin.actor, { email: admin.user.email, name: "Dup", roleId: (await role("viewer")).id });
    expect(dup.ok).toBe(false);
  });

  it("lässt Nicht-Admins nur Rollen vergeben, deren Rechte sie haben", async () => {
    const custom = await db.insert(roles).values({ key: "custom_hr", name: "HR", permissions: ["users.view", "users.manage", "dashboard.view"] }).returning();
    const hr = await makeUser("custom_hr");
    expect(custom.length).toBe(1);
    const viewer = await role("viewer");
    expect((await inviteUser(hr.actor, { email: "v@example.ch", name: "V", roleId: viewer.id })).ok).toBe(false);
    const admin = await role("admin");
    expect((await inviteUser(hr.actor, { email: "a@example.ch", name: "A", roleId: admin.id })).ok).toBe(false);
  });
});

describe("Passwort zurücksetzen", () => {
  it("erstellt einen 1-Stunden-Link, setzt das Passwort und beendet alle Sitzungen", async () => {
    const { user } = await makeUser("editor");
    await addSession(user.id);
    await requestPasswordReset(user.email.toUpperCase(), "198.51.100.1");
    const [tok] = await db.select().from(tokens).where(eq(tokens.userId, user.id));
    expect(tok.type).toBe("password_reset");
    expect(tok.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 3_600_000);
    // the raw token is not recoverable – simulate the e-mail link with a known token
    const raw = "reset-token-for-tests-0123456789";
    await db.update(tokens).set({ id: sha256(raw) }).where(eq(tokens.id, tok.id));
    expect((await findResetToken(raw)).state).toBe("valid");
    expect((await resetPassword(raw, "123")).ok).toBe(false);
    const res = await resetPassword(raw, "Neues Passwort fuer Tests 42");
    expect(res.ok).toBe(true);
    const [u] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword("Neues Passwort fuer Tests 42", u.passwordHash)).toBe(true);
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
    expect((await resetPassword(raw, "Noch ein Passwort 4242")).ok).toBe(false);
    const logs = await db.select().from(auditLog).where(eq(auditLog.action, "user.password_reset"));
    expect(logs.length).toBeGreaterThan(0);
  });

  it("verrät nicht, ob eine Adresse existiert, und begrenzt die Anfragen", async () => {
    await expect(requestPasswordReset("niemand@example.ch", "198.51.100.2")).resolves.toBeUndefined();
    const { user } = await makeUser("viewer");
    for (let i = 0; i < 5; i++) await requestPasswordReset(user.email, "198.51.100.3");
    // per-address limit (3/h): no more than 3 tokens were ever issued, only the newest is kept
    const toks = await db.select().from(tokens).where(eq(tokens.userId, user.id));
    expect(toks).toHaveLength(1);
    const audits = await db.select().from(auditLog).where(eq(auditLog.entityId, user.id));
    expect(audits.filter((a) => a.action === "user.password_reset_requested")).toHaveLength(3);
  });

  it("ändert das eigene Passwort und beendet die anderen Sitzungen", async () => {
    const { user, actor } = await makeUser("viewer");
    const keep = await addSession(user.id);
    await addSession(user.id);
    expect((await changeOwnPassword({ ...actor, sessionId: keep }, "falsch", "Ganz neues Passwort 77")).ok).toBe(false);
    expect((await changeOwnPassword({ ...actor, sessionId: keep }, PW, "Ganz neues Passwort 77")).ok).toBe(true);
    const left = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(left.map((s) => s.id)).toEqual([keep]);
  });
});

describe("Schutzregeln", () => {
  it("niemand ändert, sperrt oder löscht sich selbst", async () => {
    const { actor } = await makeUser("admin");
    const viewer = await role("viewer");
    expect((await changeUserRole(actor, actor.id, viewer.id)).ok).toBe(false);
    expect((await setUserStatus(actor, actor.id, "disabled")).ok).toBe(false);
    expect((await deleteUser(actor, actor.id)).ok).toBe(false);
    expect((await resetUserTwoFactor(actor, actor.id)).ok).toBe(false);
  });

  it("schützt Inhaber vor Nicht-Inhabern und hält einen aktiven Inhaber", async () => {
    // fresh perspective: disable all other owners so there is exactly one
    const ownerRole = await role("owner");
    await db.update(users).set({ status: "disabled" }).where(eq(users.roleId, ownerRole.id));
    const solo = await makeUser("owner");
    const admin = await makeUser("admin");
    const viewer = await role("viewer");
    expect((await changeUserRole(admin.actor, solo.user.id, viewer.id)).ok).toBe(false);
    expect((await setUserStatus(admin.actor, solo.user.id, "disabled")).ok).toBe(false);
    expect((await deleteUser(admin.actor, solo.user.id)).ok).toBe(false);
    // admin can't make someone an owner either
    expect((await changeUserRole(admin.actor, (await makeUser("viewer")).user.id, ownerRole.id)).ok).toBe(false);

    // a second owner may demote the first, but the last active owner can't be removed
    const second = await makeUser("owner");
    expect((await changeUserRole(second.actor, solo.user.id, viewer.id)).ok).toBe(true);
    // second is now the only active owner and can't demote/disable/delete themselves
    expect((await changeUserRole(second.actor, second.user.id, viewer.id)).ok).toBe(false);
    expect((await setUserStatus(second.actor, second.user.id, "disabled")).ok).toBe(false);
  });

  it("sperrt Konten und beendet deren Sitzungen", async () => {
    const admin = await makeUser("admin");
    const target = await makeUser("support");
    await addSession(target.user.id);
    expect((await setUserStatus(admin.actor, target.user.id, "disabled")).ok).toBe(true);
    expect(await db.select().from(sessions).where(eq(sessions.userId, target.user.id))).toHaveLength(0);
    expect((await resetUserTwoFactor(admin.actor, target.user.id)).ok).toBe(true);
    expect((await deleteUser(admin.actor, target.user.id)).ok).toBe(true);
  });
});

describe("Eigene Rollen", () => {
  it("bereinigt Berechtigungen: Admin-Rechte nur durch Inhaber/Admins", async () => {
    const owner = await makeUser("owner");
    const r = await createRole(owner.actor, { name: "Buchhaltung", description: "", permissions: ["orders.view", "security.manage", "nicht.vorhanden"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [row] = await db.select().from(roles).where(eq(roles.id, r.id));
    expect(row.permissions).toEqual(["orders.view", "security.manage"]);

    // a role manager without admin role can't grant admin-only or foreign permissions
    await db.insert(roles).values({ key: "custom_rm", name: "Rollenpflege", permissions: ["roles.manage", "orders.view", "users.view"] });
    const rm = await makeUser("custom_rm");
    const perms = resolveRolePermissions(rm.actor, ["orders.view", "security.manage", "products.manage"], null);
    expect(perms).toEqual(["orders.view"]);
    // and keeps admin-only permissions that are already there
    expect((await updateRole(rm.actor, r.id, { name: "Buchhaltung", description: "", permissions: ["orders.view"] })).ok).toBe(true);
    const [after] = await db.select().from(roles).where(eq(roles.id, r.id));
    expect(after.permissions).toContain("security.manage");
    expect(ADMIN_ONLY_PERMISSIONS).toEqual(["roles.manage", "security.manage"]);
    expect(ALL_PERMISSIONS.length).toBeGreaterThan(ADMIN_ONLY_PERMISSIONS.length);
  });

  it("schützt eingebaute und verwendete Rollen", async () => {
    const owner = await makeUser("owner");
    const sys = await role("editor");
    expect((await updateRole(owner.actor, sys.id, { name: "X", description: "", permissions: ["orders.view"] })).ok).toBe(false);
    expect((await deleteRole(owner.actor, sys.id)).ok).toBe(false);
    const r = await createRole(owner.actor, { name: "Lager", description: "", permissions: ["products.view"] });
    if (!r.ok) throw new Error(r.error);
    expect((await createRole(owner.actor, { name: "lager", description: "", permissions: ["products.view"] })).ok).toBe(false);
    const [u] = await db.insert(users).values({ email: "lager@example.ch", name: "Lager", roleId: r.id }).returning();
    expect((await deleteRole(owner.actor, r.id)).ok).toBe(false);
    await db.delete(users).where(eq(users.id, u.id));
    expect((await deleteRole(owner.actor, r.id)).ok).toBe(true);
  });
});
