/** In-app notifications for staff (shown in the dashboard), optionally mirrored by e-mail elsewhere. */
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import type { Permission } from "@/server/auth/permissions";

export async function notify(n: { type: string; title: string; body?: string; href?: string; permission?: Permission; userId?: string }) {
  await db.insert(notifications).values({ type: n.type, title: n.title, body: n.body ?? "", href: n.href ?? null, permission: n.permission ?? null, userId: n.userId ?? null });
}
