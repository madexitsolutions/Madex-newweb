import { notFound } from "next/navigation";
import { InvoiceDoc } from "@/components/shop/invoice-doc";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { loadOrder, loadOrderItems } from "@/server/shop/order-core";
import { AutoPrint } from "./auto-print";

export const metadata = { title: "Druckansicht" };

/** Print view of an order for the staff: /madexadm/druck/rechnung/<id> or /madexadm/druck/lieferschein/<id>. */
export default async function PrintPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  await requirePermission("orders.view");
  await requireModule("shop");
  const { kind, id } = await params;
  if (kind !== "rechnung" && kind !== "lieferschein") notFound();
  const order = /^[0-9a-f-]{36}$/i.test(id) ? await loadOrder(id) : null;
  if (!order) notFound();
  const items = await loadOrderItems(order.id);
  return (
    <div className="a-print">
      <AutoPrint />
      <InvoiceDoc order={order} items={items} kind={kind} />
    </div>
  );
}
