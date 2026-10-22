import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { roles, settings, users } from "@/server/db/schema";
import { bootstrap } from "@/server/db/bootstrap";
import { getSettings, invalidateSettings } from "@/server/settings";

describe("Plugins beim Start", () => {
  it("sind bei einer neuen Installation alle aus", async () => {
    invalidateSettings();
    const m = await getSettings("modules");
    expect(Object.entries(m).filter(([k, on]) => on && k !== "storefront")).toEqual([]);
  });

  it("behalten bei bestehenden Installationen die früheren Standards", async () => {
    // an installation from before the plugins: users, but no stored choice
    await db.delete(settings).where(eq(settings.key, "modules"));
    const [role] = await db.select().from(roles).where(eq(roles.key, "owner"));
    await db.insert(users).values({ email: "alt@example.ch", name: "Alt", passwordHash: "x", roleId: role.id });
    await bootstrap(db);
    invalidateSettings();
    const m = await getSettings("modules");
    expect([m.shop, m.blog, m.inquiries, m.seo, m.analytics]).toEqual([true, true, true, true, true]);
    expect([m.cookies, m.maintenance, m.redirects]).toEqual([false, false, false]);
  });
});
