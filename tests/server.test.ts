import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// isolate the file store before any server module is imported
const dir = mkdtempSync(path.join(tmpdir(), "madex-test-"));
process.env.DATA_DIR = dir;
process.env.DATA_ENCRYPTION_KEY = "test-key";

let totp: typeof import("@/lib/server/totp");
let requests: typeof import("@/lib/server/requests");
let orion: typeof import("@/lib/server/orion");
let packages: typeof import("@/lib/server/packages");
let store: typeof import("@/lib/server/store");

beforeAll(async () => {
  totp = await import("@/lib/server/totp");
  requests = await import("@/lib/server/requests");
  orion = await import("@/lib/server/orion");
  packages = await import("@/lib/server/packages");
  store = await import("@/lib/server/store");
});

describe("TOTP", () => {
  it("matches the RFC 6238 test vector", () => {
    // RFC 6238, SHA-1, secret "12345678901234567890", T = 59 s → 94287082 (last 6 digits)
    const secret = totp.base32Encode(Buffer.from("12345678901234567890"));
    expect(totp.hotp(secret, 1)).toBe("287082");
    expect(totp.verifyTotp(secret, "287082", 59_000)).toBe(true);
    expect(totp.verifyTotp(secret, "000000", 59_000)).toBe(false);
  });
  it("round-trips base32", () => {
    const buf = Buffer.from("madex-secret-key");
    expect(totp.base32Decode(totp.base32Encode(buf)).equals(buf)).toBe(true);
  });
});

describe("CSV export", () => {
  it("neutralises spreadsheet formulas and escapes quotes", () => {
    expect(requests.csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(requests.csvCell('Er sagte "Hallo"')).toBe(`"Er sagte ""Hallo"""`);
    expect(requests.csvCell(undefined)).toBe(`""`);
  });
});

describe("Chat action markers", () => {
  it("extracts known actions and keeps page links", () => {
    const r = orion.extractActions("Gerne! [[pakete]] Mehr unter [[seite:ki]] [[unbekannt]] **fett**");
    expect(r.actions).toEqual(["pakete"]);
    expect(r.text).toContain("[[seite:ki]]");
    expect(r.text).not.toContain("[[unbekannt]]");
    expect(r.text).toContain("fett");
    expect(r.text).not.toContain("**");
  });
});

describe("Package recommendation", () => {
  it("ranks Premium first for Google Ads goals", async () => {
    const ranked = await packages.recommend({ goals: ["google-ads", "social-media"], hasWebsite: false, companySize: 20 });
    expect(ranked[0].name).toBe("Premium");
  });
  it("ranks Website-Wartung first for a website-only goal of a small company", async () => {
    const ranked = await packages.recommend({ goals: ["wartung"], hasWebsite: true, companySize: 1 });
    expect(ranked[0].name).toBe("Website-Wartung");
  });
});

describe("Encrypted store and requests", () => {
  it("stores requests idempotently and encrypted on disk", async () => {
    const input = { type: "kontakt" as const, source: "test", name: "Anna Muster", email: "anna@example.ch", idempotencyKey: "abc-123" };
    const a = await requests.createRequest(input);
    const b = await requests.createRequest(input);
    expect(a.item.reference).toMatch(/^MDX-[0-9A-F]{12}$/);
    expect(b.replay).toBe(true);
    expect(b.item.id).toBe(a.item.id);
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(path.join(store.dataDir, "requests.json"), "utf8");
    expect(raw.startsWith("MDXENC1:")).toBe(true);
    expect(raw).not.toContain("anna@example.ch");
  });
});
