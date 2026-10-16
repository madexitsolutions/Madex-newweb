import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { roles, settings as settingsTable } from "@/server/db/schema";
import { decrypt, encrypt, hashPassword, isEncrypted, verifyPassword } from "@/server/lib/crypto";
import { ipMatches, isValidIpRule } from "@/server/lib/ip";
import { hit } from "@/server/lib/rate-limit";
import { getSettings, getSettingsForForm, saveSettings } from "@/server/settings";
import { ALL_PERMISSIONS, SYSTEM_ROLES } from "@/server/auth/permissions";
import { hotp, base32Encode, verifyTotp } from "@/server/auth/totp";
import { money, parseMoney, slugify } from "@/lib/format";

describe("Verschlüsselung und Passwörter", () => {
  it("verschlüsselt und entschlüsselt Geheimnisse", () => {
    const c = encrypt("sk_test_123");
    expect(isEncrypted(c)).toBe(true);
    expect(c).not.toContain("sk_test_123");
    expect(decrypt(c)).toBe("sk_test_123");
  });

  it("hasht Passwörter mit scrypt", async () => {
    const h = await hashPassword("Sonnenblume Zürich 2026");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Sonnenblume Zürich 2026", h)).toBe(true);
    expect(await verifyPassword("falsch", h)).toBe(false);
    expect(await verifyPassword("x", null)).toBe(false);
  });

  it("TOTP entspricht RFC 6238", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(hotp(secret, 1)).toBe("287082");
    expect(verifyTotp(secret, "287082", 59_000)).toBe(true);
  });
});

describe("Einstellungen", () => {
  it("liefert Standardwerte und speichert Geheimnisse verschlüsselt", async () => {
    expect((await getSettings("general")).currency).toBe("CHF");
    await saveSettings("payments", { stripeEnabled: true, stripeSecretKey: "sk_test_abc123" });
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "payments"));
    expect(JSON.stringify(row.value)).not.toContain("sk_test_abc123");
    expect((await getSettings("payments")).stripeSecretKey).toBe("sk_test_abc123");
    const form = await getSettingsForForm("payments");
    expect(form.stripeSecretKey).toBe("");
    expect(form._secrets.stripeSecretKey).toBe("•••• c123");
    // empty secret in a later save keeps the stored one
    await saveSettings("payments", { stripeSecretKey: "" });
    expect((await getSettings("payments")).stripeSecretKey).toBe("sk_test_abc123");
  });

  it("weist ungültige Werte zurück", async () => {
    await expect(saveSettings("branding", { primaryColor: "rot" })).rejects.toThrow();
  });
});

describe("Sicherheit", () => {
  it("begrenzt die Rate pro Schlüssel", async () => {
    for (let i = 0; i < 3; i++) expect((await hit("t:1", 3, 60_000)).allowed).toBe(true);
    expect((await hit("t:1", 3, 60_000)).allowed).toBe(false);
    expect((await hit("t:2", 3, 60_000)).allowed).toBe(true);
  });

  it("prüft IP-Regeln", () => {
    expect(ipMatches("192.168.1.20", "192.168.1.0/24")).toBe(true);
    expect(ipMatches("192.168.2.20", "192.168.1.0/24")).toBe(false);
    expect(ipMatches("::ffff:10.0.0.5", "10.0.0.5")).toBe(true);
    expect(isValidIpRule("10.0.0.0/8")).toBe(true);
    expect(isValidIpRule("10.0.0.0/40")).toBe(false);
  });

  it("legt die eingebauten Rollen an", async () => {
    const rows = await db.select().from(roles);
    expect(rows.map((r) => r.key).sort()).toEqual(SYSTEM_ROLES.map((r) => r.key).sort());
    const owner = rows.find((r) => r.key === "owner")!;
    expect(owner.permissions.length).toBe(ALL_PERMISSIONS.length);
  });
});

describe("Formatierung", () => {
  it("formatiert Franken und liest Beträge", () => {
    expect(money(123450)).toMatch(/CHF\s1’234\.50/);
    expect(parseMoney("12,5")).toBe(1250);
    expect(parseMoney("1'234.50")).toBe(123450);
    expect(parseMoney("abc")).toBeNull();
  });

  it("erzeugt Slugs mit Umlauten", () => {
    expect(slugify("Über uns – Grösse & Mass")).toBe("ueber-uns-groesse-mass");
  });
});
