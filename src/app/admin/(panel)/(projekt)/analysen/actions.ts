"use server";

import { revalidatePath } from "next/cache";
import { fail, formString, ok, type FormState } from "@/lib/form-state";
import { allowRescan, deleteAnalysis } from "@/lib/server/analysis/admin";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";

export async function allowRescanAction(
  _: FormState,
  f: FormData,
): Promise<FormState> {
  const user = await checkPermission("inquiries.manage");
  if (!user)
    return fail(
      "Keine Berechtigung. Dafür braucht es das Recht «Anfragen bearbeiten und löschen».",
    );
  const id = formString(f, "id");
  const domain = formString(f, "domain");
  await allowRescan(id);
  await audit(user, "analysis.rescan_allowed", {
    entityType: "analysis",
    entityId: id,
    summary: `Neue Analyse für ${domain} erlaubt`,
  });
  revalidatePath("/admin/analysen");
  return ok(`${domain} kann wieder analysiert werden.`);
}

export async function deleteAnalysisAction(
  _: FormState,
  f: FormData,
): Promise<FormState> {
  const user = await checkPermission("inquiries.manage");
  if (!user)
    return fail(
      "Keine Berechtigung. Dafür braucht es das Recht «Anfragen bearbeiten und löschen».",
    );
  const id = formString(f, "id");
  const domain = formString(f, "domain");
  await deleteAnalysis(id);
  await audit(user, "analysis.deleted", {
    entityType: "analysis",
    entityId: id,
    summary: `Website-Analyse für ${domain} gelöscht`,
  });
  revalidatePath("/admin/analysen");
  return ok("Analyse gelöscht.");
}
