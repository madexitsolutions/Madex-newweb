/**
 * Security area: policy validation, audit log / login event / e-mail log
 * queries and IP blocks.
 */
import { and, count, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLog, emailLog, ipBlocks, loginEvents, users } from "@/server/db/schema";
import { audit } from "@/server/audit";
import { ipMatches, isValidIpRule } from "@/server/lib/ip";
import { invalidateIpBlocks } from "@/server/lib/ip-blocks";
import type { Actor, Result } from "./users";

const err = (error: string) => ({ ok: false as const, error });

export const PER_PAGE = 50;

/** Returns an error when the allowlist is invalid or would lock out the current request. */
export function allowlistError(rules: string[], currentIp: string): string | null {
  const bad = rules.find((r) => !isValidIpRule(r));
  if (bad) return `«${bad}» ist keine gültige IP-Adresse oder IPv4-Netz (z. B. 203.0.113.7 oder 203.0.113.0/24).`;
  if (rules.length && !rules.some((r) => ipMatches(currentIp, r))) {
    return currentIp === "unknown"
      ? "Ihre aktuelle IP-Adresse ist unbekannt (kein Proxy-Header). Eine Freigabeliste würde Sie aussperren."
      : `Ihre aktuelle IP-Adresse ${currentIp} ist nicht in der Liste – Sie würden sich aussperren. Fügen Sie sie hinzu.`;
  }
  return null;
}

/* ------------------------------------------------------------- audit log */

export type AuditFilter = { user?: string; action?: string; entity?: string; from?: string; to?: string };

/** "2026-10-01" → midnight of that day in Swiss time (date filters are entered in local dates). */
export function dayStart(d: string): Date | null {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(utc)) return null;
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", timeZoneName: "shortOffset" }).formatToParts(new Date(utc)).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const off = name.match(/GMT([+-]\d+)(?::(\d+))?/);
  const minutes = off ? Number(off[1]) * 60 + Math.sign(Number(off[1])) * Number(off[2] ?? 0) : 0;
  return new Date(utc - minutes * 60_000);
}

function auditWhere(f: AuditFilter): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (f.user) parts.push(eq(auditLog.userEmail, f.user));
  if (f.action) parts.push(ilike(auditLog.action, `${f.action.replace(/[%_]/g, "")}%`));
  if (f.entity) parts.push(eq(auditLog.entityType, f.entity));
  const from = f.from ? dayStart(f.from) : null;
  const to = f.to ? dayStart(f.to) : null;
  if (from) parts.push(gte(auditLog.createdAt, from));
  if (to) parts.push(lt(auditLog.createdAt, new Date(to.getTime() + 86_400_000)));
  return parts.length ? and(...parts) : undefined;
}

export async function queryAudit(f: AuditFilter, page = 1) {
  const where = auditWhere(f);
  const [{ n }] = await db.select({ n: count() }).from(auditLog).where(where);
  const rows = await db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE);
  return { rows, total: n };
}

export async function auditEntry(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(auditLog).where(eq(auditLog.id, id));
  return row ?? null;
}

/** Values for the filter selects. */
export async function auditFilterOptions() {
  const [actors, entities, actions] = await Promise.all([
    db.selectDistinct({ email: auditLog.userEmail }).from(auditLog).where(sql`${auditLog.userEmail} <> ''`).orderBy(auditLog.userEmail),
    db.selectDistinct({ type: auditLog.entityType }).from(auditLog).where(sql`${auditLog.entityType} is not null`).orderBy(auditLog.entityType),
    db.selectDistinct({ prefix: sql<string>`split_part(${auditLog.action}, '.', 1)` }).from(auditLog),
  ]);
  return {
    users: actors.map((a) => a.email),
    entities: entities.map((e) => e.type!).filter(Boolean),
    actions: actions.map((a) => a.prefix).filter(Boolean).sort(),
  };
}

/* ---------------------------------------------------------- login events */

export async function queryLoginEvents(f: { result?: "ok" | "failed" | ""; q?: string }, page = 1) {
  const parts: (SQL | undefined)[] = [];
  if (f.result === "ok") parts.push(eq(loginEvents.success, true));
  if (f.result === "failed") parts.push(eq(loginEvents.success, false));
  const q = f.q?.trim().replace(/[%_]/g, "");
  if (q) parts.push(or(ilike(loginEvents.email, `%${q}%`), ilike(loginEvents.ip, `%${q}%`)));
  const where = parts.length ? and(...parts) : undefined;
  const [{ n }] = await db.select({ n: count() }).from(loginEvents).where(where);
  const rows = await db
    .select()
    .from(loginEvents)
    .where(where)
    .orderBy(desc(loginEvents.createdAt))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE);
  const [{ failed24 }] = await db
    .select({ failed24: count() })
    .from(loginEvents)
    .where(and(eq(loginEvents.success, false), gte(loginEvents.createdAt, new Date(Date.now() - 86_400_000))));
  return { rows, total: n, failed24 };
}

export const LOGIN_REASONS: Record<string, string> = {
  ok: "Erfolgreich",
  bad_password: "Falsches Passwort",
  unknown_user: "Unbekannte E-Mail",
  disabled: "Konto gesperrt oder nicht aktiv",
  locked: "Vorübergehend gesperrt",
  rate_limited: "Zu viele Versuche (IP)",
  ip_not_allowed: "IP nicht freigegeben",
  ip_blocked: "IP blockiert",
  bad_2fa: "Falscher 2FA-Code",
};

/* -------------------------------------------------------------- e-mails */

export async function queryEmailLog(f: { status?: string; q?: string }, page = 1) {
  const parts: (SQL | undefined)[] = [];
  if (f.status === "sent" || f.status === "failed" || f.status === "skipped") parts.push(eq(emailLog.status, f.status));
  const q = f.q?.trim().replace(/[%_]/g, "");
  if (q) parts.push(or(ilike(emailLog.to, `%${q}%`), ilike(emailLog.subject, `%${q}%`)));
  const where = parts.length ? and(...parts) : undefined;
  const [{ n }] = await db.select({ n: count() }).from(emailLog).where(where);
  const rows = await db
    .select()
    .from(emailLog)
    .where(where)
    .orderBy(desc(emailLog.createdAt))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE);
  return { rows, total: n };
}

export async function emailStatusCounts() {
  const rows = await db.select({ status: emailLog.status, n: count() }).from(emailLog).groupBy(emailLog.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<"sent" | "failed" | "skipped", number>>;
}

/* ------------------------------------------------------------- IP blocks */

export async function listIpBlocks() {
  return db
    .select({ id: ipBlocks.id, cidr: ipBlocks.cidr, reason: ipBlocks.reason, expiresAt: ipBlocks.expiresAt, createdAt: ipBlocks.createdAt, createdBy: users.name })
    .from(ipBlocks)
    .leftJoin(users, eq(ipBlocks.createdBy, users.id))
    .orderBy(desc(ipBlocks.createdAt));
}

export async function createIpBlock(actor: Actor, input: { cidr: string; reason: string; expiresAt: Date | null }, currentIp: string): Promise<Result<{ id: string }>> {
  const cidr = input.cidr.trim();
  if (!isValidIpRule(cidr)) return err("Bitte eine IP-Adresse (203.0.113.7) oder ein IPv4-Netz (203.0.113.0/24) eingeben.");
  if (ipMatches(currentIp, cidr)) return err(`Diese Sperre würde Ihre eigene IP-Adresse ${currentIp} betreffen.`);
  if (/\/([0-7])$/.test(cidr)) return err("Netze grösser als /8 können nicht gesperrt werden.");
  if (input.expiresAt && input.expiresAt <= new Date()) return err("Das Ablaufdatum liegt in der Vergangenheit.");
  const [row] = await db.insert(ipBlocks).values({ cidr, reason: input.reason.trim(), expiresAt: input.expiresAt, createdBy: actor.id }).returning();
  invalidateIpBlocks();
  await audit(actor, "ip_block.created", { entityType: "ip_block", entityId: row.id, summary: `${cidr} gesperrt${input.reason ? ` (${input.reason.trim()})` : ""}`, data: { expiresAt: input.expiresAt?.toISOString() ?? null } });
  return { ok: true, id: row.id };
}

export async function deleteIpBlock(actor: Actor, id: string): Promise<Result> {
  const [row] = await db.delete(ipBlocks).where(eq(ipBlocks.id, id)).returning();
  if (!row) return err("Die Sperre existiert nicht mehr.");
  invalidateIpBlocks();
  await audit(actor, "ip_block.deleted", { entityType: "ip_block", entityId: id, summary: `Sperre für ${row.cidr} aufgehoben` });
  return { ok: true };
}
