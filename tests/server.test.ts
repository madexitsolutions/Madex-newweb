import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// isolate the file store before any server module is imported
const dir = mkdtempSync(path.join(tmpdir(), "madex-test-"));
process.env.DATA_DIR = dir;
process.env.DATA_ENCRYPTION_KEY = "test-key";

let orion: typeof import("@/lib/server/orion");
let packages: typeof import("@/lib/server/packages");
let store: typeof import("@/lib/server/store");

beforeAll(async () => {
  orion = await import("@/lib/server/orion");
  packages = await import("@/lib/server/packages");
  store = await import("@/lib/server/store");
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

