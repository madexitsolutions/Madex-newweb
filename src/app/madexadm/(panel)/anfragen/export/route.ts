/** CSV export of the inquiry inbox with the filters of the list (max. 10'000 rows). */
import { desc } from "drizzle-orm";
import { csvResponse, toCsv } from "@/lib/csv";
import { isModuleEnabled } from "@/modules/registry";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { inquiries } from "@/server/db/schema";
import { inquiryCsvRows, listWhere } from "@/server/content/inquiries";
import { readFilters } from "../filters";

export async function GET(req: Request) {
  const user = await checkPermission("inquiries.view");
  if (!user) return new Response("Keine Berechtigung", { status: 403 });
  if (!(await isModuleEnabled("inquiries"))) return new Response("Nicht gefunden", { status: 404 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { filter } = readFilters(sp);
  const rows = await db.select().from(inquiries).where(listWhere(filter)).orderBy(desc(inquiries.createdAt)).limit(10_000);
  await audit(user, "inquiry.exported", { entityType: "inquiry", summary: `${rows.length} Anfragen als CSV exportiert` });
  const stamp = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
  return csvResponse(`anfragen-${stamp}.csv`, toCsv(inquiryCsvRows(rows)));
}
