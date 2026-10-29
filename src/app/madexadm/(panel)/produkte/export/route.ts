import { checkPermission } from "@/server/auth/session";
import { isModuleEnabled } from "@/modules/registry";
import { audit } from "@/server/audit";
import { exportProductsCsv } from "@/server/shop/import-export";

/** Product CSV in our own import format (one row per variant). */
export async function GET() {
  const user = await checkPermission("products.view");
  if (!user) return new Response("Keine Berechtigung", { status: 403 });
  if (!(await isModuleEnabled("shop"))) return new Response("Nicht gefunden", { status: 404 });
  const csv = await exportProductsCsv();
  await audit(user, "product.exported", { entityType: "product", summary: "Produkte als CSV exportiert" });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="produkte-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
