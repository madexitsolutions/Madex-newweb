import { currentAdmin } from "@/lib/server/auth";
import { listRequests, toCsv } from "@/lib/server/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await currentAdmin())) return new Response("Nicht angemeldet", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").toLowerCase();
  const items = (await listRequests()).filter(
    (r) =>
      (!sp.get("status") || r.status === sp.get("status")) &&
      (!sp.get("type") || r.type === sp.get("type")) &&
      (!q || [r.name, r.company, r.email, r.reference, r.message].some((v) => v?.toLowerCase().includes(q))),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(items), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="madex-anfragen-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
