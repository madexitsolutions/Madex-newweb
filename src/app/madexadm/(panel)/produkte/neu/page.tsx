import "../../../shop.css";
import { PageHeader } from "@/components/admin/kit";
import { requirePermission } from "@/server/auth/session";
import { requireModule } from "@/modules/registry";
import { ProductEditor } from "../editor";
import { editorContext } from "../shared";

export const metadata = { title: "Neues Produkt" };

export default async function NewProductPage() {
  await requirePermission("products.manage");
  await requireModule("shop");
  const ctx = await editorContext();
  return (
    <>
      <PageHeader title="Neues Produkt" crumb={{ href: "/madexadm/produkte", label: "Produkte" }} description="Neue Produkte sind zuerst Entwürfe. Stellen Sie den Status auf «Aktiv», sobald alles stimmt." />
      <ProductEditor
        product={{
          id: null,
          name: "",
          slug: "",
          status: "draft",
          type: "physical",
          shortDescription: "",
          description: "",
          vendor: "",
          tags: [],
          featured: false,
          taxClassId: null,
          seoTitle: "",
          seoDescription: "",
          categoryIds: [],
          images: [],
          options: [],
          variants: [],
        }}
        taxClasses={ctx.taxClasses}
        tree={ctx.tree}
        shopBase={ctx.shopBase}
        lowStock={ctx.lowStock}
        pricesIncludeTax={ctx.pricesIncludeTax}
      />
    </>
  );
}
