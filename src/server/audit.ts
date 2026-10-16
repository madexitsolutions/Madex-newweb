/** Audit trail: who changed what, when, from where. */
import { db } from "@/server/db";
import { auditLog } from "@/server/db/schema";
import { requestInfo } from "@/server/lib/request";

export type Actor = { id: string; email: string } | null;

export async function audit(actor: Actor, action: string, opts: { entityType?: string; entityId?: string; summary?: string; data?: Record<string, unknown>; ip?: string } = {}) {
  let ip = opts.ip;
  if (ip === undefined) {
    try {
      ip = (await requestInfo()).ip;
    } catch {
      ip = "";
    }
  }
  await db.insert(auditLog).values({
    userId: actor?.id ?? null,
    userEmail: actor?.email ?? "",
    action,
    entityType: opts.entityType ?? null,
    entityId: opts.entityId ?? null,
    summary: opts.summary ?? "",
    data: opts.data ?? {},
    ip,
  });
}
