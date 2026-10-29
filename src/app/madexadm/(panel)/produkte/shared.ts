import { enabledModules } from "@/modules/registry";
import { appUrl } from "@/server/lib/app-url";
import { getSettings } from "@/server/settings";
import { allTaxClasses } from "@/server/shop/tax";
import { categoryTree } from "@/server/shop/categories";

/** Data every product editor page needs. */
export async function editorContext() {
  const [taxClasses, tree, shop, general, modules] = await Promise.all([allTaxClasses(), categoryTree(), getSettings("shop"), getSettings("general"), enabledModules()]);
  const shopBase = (modules.storefront ? appUrl("") : general.siteUrl || appUrl("")).replace(/\/$/, "");
  return {
    taxClasses: taxClasses.map((t) => ({ id: t.id, name: t.name, rateBp: t.rateBp, isDefault: t.isDefault })),
    tree: tree.map((c) => ({ id: c.id, name: c.name, depth: c.depth, path: c.path })),
    shopBase,
    storefront: modules.storefront,
    lowStock: shop.lowStockThreshold,
    pricesIncludeTax: shop.pricesIncludeTax,
  };
}
