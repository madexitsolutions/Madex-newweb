"use server";

import { revalidatePath } from "next/cache";
import { checkPermission } from "@/server/auth/session";
import { markNotificationsRead } from "@/server/analytics/overview";

/** Marks one notification (field "id") or all visible ones as read for the current user. */
export async function markReadAction(f: FormData) {
  const user = await checkPermission("dashboard.view");
  if (!user) return;
  const id = String(f.get("id") ?? "");
  await markNotificationsRead(user, /^[0-9a-f-]{36}$/i.test(id) ? id : undefined);
  revalidatePath("/admin");
}
