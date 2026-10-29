import { one } from "@/components/admin/kit";
import { isOrderTab, type OrderFilter, type OrderSort } from "@/server/shop/orders";

type SP = Record<string, string | string[] | undefined>;

/** searchParams → OrderFilter (shared by the list and the CSV export). */
export function orderParams(sp: SP): OrderFilter & { tab: NonNullable<OrderFilter["tab"]> } {
  const tab = one(sp.tab);
  const sort = one(sp.sort);
  return {
    tab: isOrderTab(tab) ? tab : "offen",
    q: one(sp.q).trim().slice(0, 100) || undefined,
    paymentStatus: one(sp.zahlung) || undefined,
    paymentMethod: one(sp.zahlart) || undefined,
    from: one(sp.von) || undefined,
    to: one(sp.bis) || undefined,
    sort: (["datum", "nummer", "betrag", "kunde"].includes(sort) ? sort : "datum") as OrderSort,
    dir: one(sp.dir) === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(one(sp.seite)) || 1),
  };
}
