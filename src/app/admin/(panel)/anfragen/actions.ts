"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type FormState } from "@/lib/form-state";
import { isModuleEnabled } from "@/modules/registry";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { inquiries, users } from "@/server/db/schema";
import { INQUIRY_STATUS } from "@/server/content/inquiries";
import { notify } from "@/server/notifications";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "open", "done", "spam"]),
  assignedTo: z.union([z.literal(""), z.string().uuid()]),
  notes: z.string().max(10_000, "Die Notiz ist zu lang (max. 10'000 Zeichen)."),
});

async function guard() {
  const user = await checkPermission("inquiries.manage");
  if (!user) return null;
  if (!(await isModuleEnabled("inquiries"))) return null;
  return user;
}

export async function updateInquiryAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung, Anfragen zu bearbeiten.");
  const parsed = updateSchema.safeParse({ id: f.get("id"), status: f.get("status"), assignedTo: f.get("assignedTo") ?? "", notes: String(f.get("notes") ?? "") });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;
  const [before] = await db.select().from(inquiries).where(eq(inquiries.id, v.id));
  if (!before) return fail("Die Anfrage wurde nicht gefunden – sie wurde vielleicht gelöscht.");
  let assignee: { id: string; name: string } | undefined;
  if (v.assignedTo) {
    [assignee] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, v.assignedTo));
    if (!assignee) return fail("Die gewählte Person gibt es nicht mehr.");
  }
  await db
    .update(inquiries)
    .set({ status: v.status, assignedTo: v.assignedTo || null, notes: v.notes.trim(), updatedAt: new Date() })
    .where(eq(inquiries.id, v.id));
  const changes: string[] = [];
  if (before.status !== v.status) changes.push(`Status ${INQUIRY_STATUS[before.status].label} → ${INQUIRY_STATUS[v.status].label}`);
  if ((before.assignedTo ?? "") !== v.assignedTo) changes.push(assignee ? `zugewiesen an ${assignee.name}` : "Zuweisung entfernt");
  if (before.notes !== v.notes.trim()) changes.push("Notiz geändert");
  if (changes.length) await audit(user, "inquiry.updated", { entityType: "inquiry", entityId: v.id, summary: `Anfrage ${before.reference}: ${changes.join(", ")}` });
  if (assignee && assignee.id !== user.id && (before.assignedTo ?? "") !== v.assignedTo)
    await notify({ type: "inquiry.assigned", userId: assignee.id, title: `Anfrage ${before.reference} wurde Ihnen zugewiesen`, body: before.subject || before.name, href: `/admin/anfragen/${v.id}` });
  revalidatePath("/admin/anfragen");
  revalidatePath(`/admin/anfragen/${v.id}`);
  return ok(changes.length ? "Änderungen gespeichert." : "Keine Änderungen.");
}

/** One-click status buttons (Erledigt, Spam, wieder öffnen). */
export async function setInquiryStatusAction(f: FormData) {
  const user = await guard();
  if (!user) return;
  const id = String(f.get("id") ?? "");
  const status = z.enum(["new", "open", "done", "spam"]).safeParse(f.get("status"));
  if (!status.success || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const [row] = await db.update(inquiries).set({ status: status.data, updatedAt: new Date() }).where(eq(inquiries.id, id)).returning();
  if (row) await audit(user, "inquiry.updated", { entityType: "inquiry", entityId: id, summary: `Anfrage ${row.reference}: Status ${INQUIRY_STATUS[status.data].label}` });
  revalidatePath("/admin/anfragen");
  revalidatePath(`/admin/anfragen/${id}`);
}

export async function deleteInquiryAction(f: FormData) {
  const user = await guard();
  if (!user) return;
  const id = String(f.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const [row] = await db.delete(inquiries).where(eq(inquiries.id, id)).returning();
  if (row) await audit(user, "inquiry.deleted", { entityType: "inquiry", entityId: id, summary: `Anfrage ${row.reference} von ${row.email} gelöscht` });
  revalidatePath("/admin/anfragen");
  redirect("/admin/anfragen?geloescht=1");
}
