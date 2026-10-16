/**
 * Roles: built-in system roles (read-only, kept in sync by the bootstrap) and
 * custom roles with a free permission set.
 *
 * Granting rules:
 * - admin-only permissions (roles.manage, security.manage) only by owners/admins
 * - everybody else may only grant permissions they hold themselves, and keeps
 *   admin-only permissions a role already has untouched
 */
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { roles, users } from "@/server/db/schema";
import { audit } from "@/server/audit";
import { ALL_PERMISSIONS, PERMISSIONS, sanitizePermissions, type Permission } from "@/server/auth/permissions";
import { slugify } from "@/lib/format";
import { isPrivileged, type Actor, type Result } from "./users";

const err = (error: string) => ({ ok: false as const, error });

/** Permissions only owners/admins may grant. */
export const ADMIN_ONLY_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter((p) => !sanitizePermissions([p], false).length);

/** Permissions grouped for the matrix (order as in the catalogue). */
export function permissionGroups() {
  const groups: { group: string; items: { key: Permission; label: string; adminOnly: boolean }[] }[] = [];
  for (const key of ALL_PERMISSIONS) {
    const { group, label } = PERMISSIONS[key];
    let g = groups.find((x) => x.group === group);
    if (!g) groups.push((g = { group, items: [] }));
    g.items.push({ key, label, adminOnly: ADMIN_ONLY_PERMISSIONS.includes(key) });
  }
  return groups;
}

/**
 * Final permission list for a custom role edited by `actor`.
 * `previous` = what the role had before (null for a new role).
 */
export function resolveRolePermissions(actor: Actor, requested: string[], previous: string[] | null): Permission[] {
  const privileged = isPrivileged(actor);
  let next = sanitizePermissions(requested, privileged);
  if (!privileged) {
    const prev = sanitizePermissions(previous ?? [], true);
    // grant only what the actor holds; keep what the actor can't see/hold unchanged
    next = next.filter((p) => actor.permissions.has(p));
    const untouchable = prev.filter((p) => ADMIN_ONLY_PERMISSIONS.includes(p) || !actor.permissions.has(p));
    next = [...new Set([...next, ...untouchable])];
  }
  return ALL_PERMISSIONS.filter((p) => next.includes(p));
}

export async function listRoles() {
  const rows = await db
    .select({
      id: roles.id,
      key: roles.key,
      name: roles.name,
      description: roles.description,
      permissions: roles.permissions,
      isSystem: roles.isSystem,
      createdAt: roles.createdAt,
      userCount: sql<number>`(select count(*)::int from ${users} where ${users.roleId} = ${roles.id})`,
    })
    .from(roles);
  const order = ["owner", "admin", "shop_manager", "editor", "support", "viewer"];
  return rows.sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    if (a.isSystem) return order.indexOf(a.key) - order.indexOf(b.key);
    return a.name.localeCompare(b.name, "de");
  });
}

async function nameTaken(name: string, exceptId?: string) {
  const [row] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(sql`lower(${roles.name}) = ${name.trim().toLowerCase()}`, exceptId ? ne(roles.id, exceptId) : undefined));
  return Boolean(row);
}

export async function createRole(actor: Actor, input: { name: string; description: string; permissions: string[] }): Promise<Result<{ id: string }>> {
  const name = input.name.trim();
  if (await nameTaken(name)) return err("Es gibt bereits eine Rolle mit diesem Namen.");
  const permissions = resolveRolePermissions(actor, input.permissions, null);
  if (!permissions.length) return err("Wählen Sie mindestens eine Berechtigung.");
  let key = `custom_${slugify(name).replace(/-/g, "_") || "rolle"}`;
  const [clash] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, key));
  if (clash) key = `${key}_${Date.now().toString(36)}`;
  const [row] = await db.insert(roles).values({ key, name, description: input.description.trim(), permissions, isSystem: false }).returning();
  await audit(actor, "role.created", { entityType: "role", entityId: row.id, summary: `Rolle «${name}» erstellt`, data: { permissions } });
  return { ok: true, id: row.id };
}

export async function updateRole(actor: Actor, id: string, input: { name: string; description: string; permissions: string[] }): Promise<Result> {
  const [role] = await db.select().from(roles).where(eq(roles.id, id));
  if (!role) return err("Die Rolle existiert nicht mehr.");
  if (role.isSystem) return err("Eingebaute Rollen können nicht geändert werden. Kopieren Sie die Rolle als Vorlage für eine eigene.");
  const name = input.name.trim();
  if (await nameTaken(name, id)) return err("Es gibt bereits eine Rolle mit diesem Namen.");
  const permissions = resolveRolePermissions(actor, input.permissions, role.permissions);
  if (!permissions.length) return err("Wählen Sie mindestens eine Berechtigung.");
  await db.update(roles).set({ name, description: input.description.trim(), permissions, updatedAt: new Date() }).where(eq(roles.id, id));
  const added = permissions.filter((p) => !role.permissions.includes(p));
  const removed = role.permissions.filter((p) => !(permissions as string[]).includes(p));
  await audit(actor, "role.updated", { entityType: "role", entityId: id, summary: `Rolle «${name}» geändert`, data: { added, removed } });
  return { ok: true };
}

export async function deleteRole(actor: Actor, id: string): Promise<Result> {
  const [role] = await db.select().from(roles).where(eq(roles.id, id));
  if (!role) return err("Die Rolle existiert nicht mehr.");
  if (role.isSystem) return err("Eingebaute Rollen können nicht gelöscht werden.");
  const [inUse] = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.roleId, id));
  if (inUse && inUse.n > 0) return err(`Die Rolle ist ${inUse.n === 1 ? "einer Person" : `${inUse.n} Personen`} zugewiesen. Weisen Sie diesen zuerst eine andere Rolle zu.`);
  await db.delete(roles).where(eq(roles.id, id));
  await audit(actor, "role.deleted", { entityType: "role", entityId: id, summary: `Rolle «${role.name}» gelöscht`, data: { permissions: role.permissions } });
  return { ok: true };
}
