import { one } from "@/components/admin/kit";
import type { InquiryFilter, InquiryStatus } from "@/server/content/inquiries";

export const STATUS_TABS: { key: InquiryStatus | "all"; param: string; label: string }[] = [
  { key: "new", param: "", label: "Neu" },
  { key: "open", param: "offen", label: "Offen" },
  { key: "quoted", param: "offerte", label: "Offerte gesendet" },
  { key: "done", param: "erledigt", label: "Erledigt" },
  { key: "spam", param: "spam", label: "Spam" },
  { key: "all", param: "alle", label: "Alle" },
];

const day = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");

/** Reads the inbox filters from searchParams (shared by the page and the CSV export). */
export function readFilters(sp: Record<string, string | string[] | undefined>) {
  const tab = STATUS_TABS.find((t) => t.param === one(sp.status)) ?? STATUS_TABS[0];
  const filter: InquiryFilter = { status: tab.key, q: one(sp.q).trim().slice(0, 100), form: one(sp.formular).slice(0, 60), from: day(one(sp.von)), to: day(one(sp.bis)) };
  return { tab, filter, params: { status: tab.param || undefined, q: filter.q, formular: filter.form, von: filter.from, bis: filter.to } };
}
