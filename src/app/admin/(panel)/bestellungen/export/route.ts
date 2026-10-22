import { isModuleEnabled } from "@/modules/registry";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { exportOrdersCsv } from "@/server/shop/orders";
import { orderParams } from "../params";

export async function GET(req: Request) {
  const user = await checkPermission("orders.view");
  if (!user) return new Response("Keine Berechtigung", { status: 403 });
  if (!(await isModuleEnabled("shop"))) return new Response("Nicht gefunden", { status: 404 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const csv = await exportOrdersCsv({ ...orderParams(sp), page: undefined });
  await audit(user, "order.exported", { entityType: "order", summary: "Bestellungen als CSV exportiert" });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bestellungen-${day}.csv"` } });
}
