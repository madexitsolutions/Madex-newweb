import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { ownerFromEnv } from "@/server/db/bootstrap";
import { roles, totpDevices, users } from "@/server/db/schema";
import { ALL_PERMISSIONS, type Permission } from "@/server/auth/permissions";
import { hotp } from "@/server/auth/totp";
import { decrypt, encrypt, hashPassword } from "@/server/lib/crypto";
import { dataDir, dataDirInsideApp } from "@/server/lib/data-dir";
import { addTotpDevice, beginTwoFactorSetup, disableOwnTwoFactor, listTotpDevices, removeTotpDevice, type Actor } from "@/server/users";
import { saveSettings } from "@/server/settings";

const PW = "Sonnenblume Zürich 2026";
const codeFor = (sealed: string) => hotp((JSON.parse(decrypt(sealed)) as { s: string }).s, Math.floor(Date.now() / 30000));

afterEach(() => vi.unstubAllEnvs());

async function owner(email: string) {
  const [r] = await db.select().from(roles).where(eq(roles.key, "owner"));
  const [u] = await db.insert(users).values({ email, name: "Inhaber", roleId: r.id, passwordHash: await hashPassword(PW), totpEnabled: true, totpSecret: encrypt("JBSWY3DPEHPK3PXP") }).returning();
  const actor: Actor = { id: u.id, email: u.email, name: u.name, role: { key: r.key, name: r.name }, permissions: new Set(ALL_PERMISSIONS as Permission[]) };
  return { user: u, actor };
}

describe("additional 2FA devices", () => {
  it("adds a device only with a matching code and a name, removes it with the password", async () => {
    const { actor } = await owner("geraete@madex-it.ch");
    const { sealed } = beginTwoFactorSetup(actor);
    expect(await addTotpDevice(actor, sealed, "000000", "iPhone Anna")).toMatchObject({ ok: false });
    expect(await addTotpDevice(actor, sealed, codeFor(sealed), "")).toMatchObject({ ok: false });
    expect(await addTotpDevice(actor, sealed, codeFor(sealed), "iPhone Anna")).toEqual({ ok: true });
    const list = await listTotpDevices(actor.id);
    expect(list.map((d) => d.name)).toEqual(["iPhone Anna"]);
    expect(await removeTotpDevice(actor, list[0].id, "falsch")).toMatchObject({ ok: false });
    expect(await removeTotpDevice(actor, list[0].id, PW)).toEqual({ ok: true });
    expect(await listTotpDevices(actor.id)).toEqual([]);
  });

  it("an envelope of another user is refused, and switching 2FA off removes all devices", async () => {
    const a = await owner("a@madex-it.ch");
    const b = await owner("b@madex-it.ch");
    const { sealed } = beginTwoFactorSetup(b.actor);
    expect(await addTotpDevice(a.actor, sealed, codeFor(sealed), "Fremd")).toMatchObject({ ok: false });
    const mine = beginTwoFactorSetup(a.actor);
    await addTotpDevice(a.actor, mine.sealed, codeFor(mine.sealed), "Laptop");
    await saveSettings("security", { require2fa: false });
    expect(await disableOwnTwoFactor(a.actor, PW)).toEqual({ ok: true });
    expect(await db.select().from(totpDevices).where(eq(totpDevices.userId, a.user.id))).toEqual([]);
  });
});

describe("owner from the environment", () => {
  it("ADMIN_RESET resets only once per e-mail and password", async () => {
    const { user } = await owner("chef@madex-it.ch");
    vi.stubEnv("ADMIN_EMAIL", "chef@madex-it.ch");
    vi.stubEnv("ADMIN_PASSWORD", "Neues Passwort Rheinfall 1");
    vi.stubEnv("ADMIN_RESET", "true");
    await ownerFromEnv(db);
    let [u] = await db.select().from(users).where(eq(users.id, user.id));
    expect(u.totpEnabled).toBe(false);
    // 2FA set up again, then a restart with ADMIN_RESET still true: no second reset
    await db.update(users).set({ totpEnabled: true, totpSecret: encrypt("JBSWY3DPEHPK3PXP") }).where(eq(users.id, user.id));
    await ownerFromEnv(db);
    [u] = await db.select().from(users).where(eq(users.id, user.id));
    expect(u.totpEnabled).toBe(true);
    // a new password means a new reset
    vi.stubEnv("ADMIN_PASSWORD", "Noch ein neues Passwort 22");
    await ownerFromEnv(db);
    [u] = await db.select().from(users).where(eq(users.id, user.id));
    expect(u.totpEnabled).toBe(false);
  });
});

describe("data folder", () => {
  it("uses DATA_DIR, otherwise ~/madex-data in production and warns when it lies in the app", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATA_DIR", "");
    expect(dataDir()).toMatch(/madex-data$/);
    vi.stubEnv("DATA_DIR", "./.data");
    expect(dataDirInsideApp()).toBe(true);
    vi.stubEnv("DATA_DIR", "/srv/madex-data");
    expect(dataDir()).toBe("/srv/madex-data");
    expect(dataDirInsideApp()).toBe(false);
  });
});
