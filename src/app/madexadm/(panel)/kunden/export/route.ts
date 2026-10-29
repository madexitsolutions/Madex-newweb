import { checkPermission } from "@/server/auth/session";
import { isModuleEnabled } from "@/modules/registry";
import { audit } from "@/server/audit";
import { customersCsv } from "@/server/shop/customers";
import { customerParams } from "../params";

/** Filtered customer list as CSV (Excel-friendly). */
export async function GET(req: Request) {
  const user = await checkPermission("customers.view");
  if (!user) return new Response("Keine Berechtigung", { status: 403 });
  if (!(await isModuleEnabled("shop"))) return new Response("Nicht gefunden", { status: 404 });
  const csv = await customersCsv(customerParams(new URL(req.url).searchParams));
  await audit(user, "customer.exported", { entityType: "customer", summary: "Kundenliste als CSV exportiert" });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kunden-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
