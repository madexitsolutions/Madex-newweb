import { checkPermission } from "@/server/auth/session";
import { isModuleEnabled } from "@/modules/registry";
import { audit } from "@/server/audit";
import { exportCustomerData } from "@/server/shop/customers";

/** All stored data of one customer as JSON (data subject access request, revDSG/DSGVO). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkPermission("customers.manage");
  if (!user) return new Response("Keine Berechtigung", { status: 403 });
  if (!(await isModuleEnabled("shop"))) return new Response("Nicht gefunden", { status: 404 });
  const { id } = await params;
  const data = await exportCustomerData(id);
  if (!data) return new Response("Nicht gefunden", { status: 404 });
  await audit(user, "customer.data_exported", { entityType: "customer", entityId: id, summary: "Kundendaten exportiert (Auskunft)" });
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="kundendaten-${id}.json"`, "cache-control": "no-store" },
  });
}
