"use server";

import { revalidatePath } from "next/cache";
import { fail, formString, ok, type FormState } from "@/lib/form-state";
import { allowRescan } from "@/lib/server/analysis/admin";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";

/** PROJEKTCODE (Madex): lets a domain be analysed again (each domain is analysed only once). */
export async function allowRescanAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await checkPermission("inquiries.manage");
  if (!user) return fail("Keine Berechtigung. Dafür braucht es das Recht «Anfragen bearbeiten und löschen».");
  const id = formString(f, "id");
  const domain = formString(f, "domain");
  await allowRescan(id);
  await audit(user, "analysis.rescan_allowed", { entityType: "analysis", entityId: id, summary: `Neue Analyse für ${domain} erlaubt` });
  revalidatePath("/admin/anfragen", "layout");
  return ok(`${domain} kann auf der Startseite wieder analysiert werden.`);
}
