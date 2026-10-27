import { count, eq, inArray } from "drizzle-orm";
import { Brand } from "@/components/admin/brand";
import { AdminNav, type NavGroupView } from "@/components/admin/nav";
import { MadexSignature } from "@/components/admin/madex";
import { Rail } from "@/components/admin/rail";
import { NAV, enabledModules, navItemVisible } from "@/modules/registry";
import { db } from "@/server/db";
import { inquiries, orders } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { signOutAction } from "../auth-actions";

async function badgeCounts(show: { orders: boolean; inquiries: boolean }) {
  const [o] = show.orders ? await db.select({ n: count() }).from(orders).where(inArray(orders.status, ["processing", "on_hold"])) : [{ n: 0 }];
  const [i] = show.inquiries ? await db.select({ n: count() }).from(inquiries).where(eq(inquiries.status, "new")) : [{ n: 0 }];
  return { orders: o.n, inquiries: i.n };
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [modules, general] = await Promise.all([enabledModules(), getSettings("general")]);
  const visible = (i: (typeof NAV)[number]["items"][number]) => user.permissions.has(i.permission) && navItemVisible(i, modules);
  const badges = await badgeCounts({
    orders: modules.shop && user.permissions.has("orders.view"),
    inquiries: modules.inquiries && user.permissions.has("inquiries.view"),
  });
  const groups: NavGroupView[] = NAV.map((g) => ({
    group: g.group,
    items: g.items.filter(visible).map((i) => ({ href: i.href, label: i.label, icon: i.icon, badge: i.badge ? badges[i.badge] : undefined })),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="a-shell">
      <AdminNav groups={groups} user={{ name: user.name, role: user.role.name }} brand={<Brand dark />} siteUrl={general.siteUrl || "/"} signOut={signOutAction} />
      <div className="a-body">
        <main className="a-main" id="inhalt">
          {children}
          <footer className="a-mainfoot">
            <MadexSignature />
          </footer>
        </main>
        <Rail user={user} modules={modules} siteUrl={general.siteUrl || "/"} />
      </div>
    </div>
  );
}
