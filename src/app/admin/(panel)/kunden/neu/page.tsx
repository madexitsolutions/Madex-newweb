import "../../../shop.css";
import { PageHeader } from "@/components/admin/kit";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { CustomerForm } from "../form";

export const metadata = { title: "Kunde erfassen" };

export default async function NewCustomer() {
  await requirePermission("customers.manage");
  await requireModule("shop");
  return (
    <>
      <PageHeader title="Kunde erfassen" description="Zum Beispiel für telefonische Bestellungen oder Firmenkunden. Ein Kundenkonto mit Passwort legt die Person im Shop selbst an." crumb={{ href: "/admin/kunden", label: "Kunden" }} />
      <div className="a-panel a-panel--form">
        <CustomerForm current={null} />
      </div>
    </>
  );
}
