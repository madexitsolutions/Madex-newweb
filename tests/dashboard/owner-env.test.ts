import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { ownerFromEnv } from "@/server/db/bootstrap";
import { verifyPassword } from "@/server/lib/crypto";

afterEach(() => vi.unstubAllEnvs());

describe("Inhaber aus Umgebungsvariablen", () => {
  it("legt das Konto nur bei leerer Datenbank und gültigem Passwort an", async () => {
    vi.stubEnv("ADMIN_USERNAME", "Info@Madex-IT.ch");
    vi.stubEnv("ADMIN_PASSWORD", "kurz");
    await ownerFromEnv(db);
    expect(await db.select().from(users)).toHaveLength(0);

    vi.stubEnv("ADMIN_PASSWORD", "Sonnenblume Zürich 2026");
    await ownerFromEnv(db);
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("info@madex-it.ch");
    expect(await verifyPassword("Sonnenblume Zürich 2026", rows[0].passwordHash)).toBe(true);

    vi.stubEnv("ADMIN_EMAIL", "andere@madex-it.ch");
    await ownerFromEnv(db);
    expect(await db.select().from(users)).toHaveLength(1);
  });
});
