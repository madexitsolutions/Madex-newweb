/** CSV export of the daily sales report for the selected range. */
import { csvResponse, toCsv } from "@/lib/csv";
import { isModuleEnabled } from "@/modules/registry";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";
import { resolveRange } from "@/server/analytics/range";
import { dailyReport, loadSales } from "@/server/analytics/sales";

const chf = (c: number) => (c / 100).toFixed(2);

export async function GET(req: Request) {
  const user = await checkPermission("analytics.view");
  if (!user) return new Response("Keine Berechtigung", { status: 403 });
  if (!(await isModuleEnabled("analytics"))) return new Response("Nicht gefunden", { status: 404 });
  const sp = new URL(req.url).searchParams;
  const range = resolveRange(sp.get("zeitraum") ?? undefined, sp.get("von") ?? undefined, sp.get("bis") ?? undefined);
  const rows = dailyReport(await loadSales(range.from, range.to), range.fromDay, range.toDay);
  const head = ["Datum", "Bestellungen (alle)", "Bezahlte Bestellungen", "Umsatz netto CHF", "Ø Bestellwert CHF", "Rabatte CHF", "Versand CHF", "MWST CHF", "Rückerstattungen CHF"];
  const body = rows.map((r) => [r.day, r.ordersAll, r.orders, chf(r.revenue), chf(r.aov), chf(r.discounts), chf(r.shipping), chf(r.tax), chf(r.refunds)]);
  const sum = rows.reduce((a, r) => ({ all: a.all + r.ordersAll, orders: a.orders + r.orders, revenue: a.revenue + r.revenue, discounts: a.discounts + r.discounts, shipping: a.shipping + r.shipping, tax: a.tax + r.tax, refunds: a.refunds + r.refunds }), { all: 0, orders: 0, revenue: 0, discounts: 0, shipping: 0, tax: 0, refunds: 0 });
  body.push(["Total", sum.all, sum.orders, chf(sum.revenue), chf(sum.orders ? Math.round(sum.revenue / sum.orders) : 0), chf(sum.discounts), chf(sum.shipping), chf(sum.tax), chf(sum.refunds)]);
  await audit(user, "report.exported", { entityType: "report", summary: `Tagesbericht ${range.fromDay} bis ${range.toDay} exportiert` });
  return csvResponse(`umsatz-${range.fromDay}-bis-${range.toDay}.csv`, toCsv([head, ...body]));
}
