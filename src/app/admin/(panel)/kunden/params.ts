import { one } from "@/components/admin/kit";
import { CUSTOMER_SORTS, type CustomerListParams, type CustomerSort } from "@/server/shop/customers";

type Raw = Record<string, string | string[] | undefined>;

/** Reads the list filters from searchParams (shared by the page and the CSV export). */
export function customerParams(sp: Raw | URLSearchParams): CustomerListParams & { q: string; account: "konto" | "gast" | ""; newsletter: "ja" | "nein" | ""; tag: string; sort: CustomerSort } {
  const get = (k: string) => (sp instanceof URLSearchParams ? (sp.get(k) ?? "") : one(sp[k]));
  const account = get("konto");
  const newsletter = get("newsletter");
  const sort = get("sort");
  return {
    q: get("q"),
    account: account === "konto" || account === "gast" ? account : "",
    newsletter: newsletter === "ja" || newsletter === "nein" ? newsletter : "",
    tag: get("tag"),
    sort: (sort in CUSTOMER_SORTS ? sort : "recent") as CustomerSort,
    page: Math.max(1, Number(get("seite")) || 1),
  };
}
