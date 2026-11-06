/**
 * Rules of the free website analysis (api/analyse): one automatic analysis per
 * visit, a website with an available report is not scanned again (the next
 * person gets that report with their own link), an expired report is scanned anew.
 */
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mkdtempSync } = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tmpdir } = require("node:os") as typeof import("node:os");
  process.env.DATA_DIR = mkdtempSync(`${tmpdir()}/madex-analyse-`);
  process.env.APP_URL = "http://localhost";
  delete process.env.PAGESPEED_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

// no real websites: every page answers with the same small HTML document
vi.mock("@/lib/server/analysis/safe-fetch", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server/analysis/safe-fetch")>();
  const body = `<!doctype html><html lang="de"><head><title>Firma – Startseite</title><meta name="description" content="Eine Firma."></head><body><h1>Willkommen</h1><p>Text</p></body></html>`;
  return { ...real, safeFetch: vi.fn(async (url: string) => ({ url, status: 200, headers: new Headers({ "content-type": "text/html" }), body, bytes: body.length, ms: 50, redirects: [] })) };
});

const { POST } = await import("@/app/api/analyse/route");
const { GET } = await import("@/app/api/analyse/[id]/route");
const { update } = await import("@/lib/server/store");

type Answer = { ok: boolean; id?: string; url?: string; report?: string; message?: string; error?: string };

// a new address per request: the per-visitor limits are not what is tested here
let visitor = 0;

async function start(website: string, email: string, cookie = "") {
  const res = await POST(
    new Request("http://localhost/api/analyse", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", "x-real-ip": `198.51.${++visitor}.7`, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ website, email, startedAt: Date.now() - 10_000 }),
    }),
  );
  const set = res.headers.get("set-cookie") ?? "";
  return { json: (await res.json()) as Answer, cookie: set.split(";")[0] };
}

async function view(url: string) {
  const u = new URL(url, "http://localhost");
  const id = u.pathname.split("/").pop()!;
  const res = await GET(new Request(`http://localhost/api/analyse/${id}${u.search}`, { headers: { "x-real-ip": "203.0.113.7" } }), { params: Promise.resolve({ id }) });
  return (await res.json()) as { ok: boolean; report?: { status: string; emailMasked: string } };
}

async function finished(url: string) {
  for (let i = 0; i < 100; i++) {
    const v = await view(url);
    if (v.report?.status !== "running") return v;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("analysis did not finish");
}

describe("free website analysis rules", () => {
  it("starts one analysis and opens it again for the same website in the same visit", async () => {
    const first = await start("erste-firma.ch", "anna@example.ch");
    expect(first.json.ok).toBe(true);
    expect(first.json.url).toMatch(/^\/analyse\/[a-f0-9]{20}\?t=/);
    expect(first.cookie).toMatch(/^madex-analyse=/);
    expect((await finished(first.json.url!)).report?.status).toBe("done");

    const again = await start("www.erste-firma.ch", "anna@example.ch", first.cookie);
    expect(again.json.url).toBe(first.json.url);
  });

  it("turns a second website in the same visit into a personal request with a link to the first report", async () => {
    const first = await start("zweite-firma.ch", "ben@example.ch");
    await finished(first.json.url!);
    const other = await start("dritte-firma.ch", "ben@example.ch", first.cookie);
    expect(other.json.ok).toBe(true);
    expect(other.json.url).toBeUndefined();
    expect(other.json.report).toBe(first.json.url);
    expect(other.json.message).toMatch(/Pro Besuch/);
  });

  it("shows an available report to the next person with their own link instead of scanning again", async () => {
    const first = await start("vierte-firma.ch", "carla@example.ch");
    await finished(first.json.url!);
    const next = await start("vierte-firma.ch", "dario@example.ch");
    expect(next.json.id).toBe(first.json.id);
    expect(next.json.url).not.toBe(first.json.url);
    // the page shows the second person's own address (masked), so the PDF goes to them
    expect((await view(next.json.url!)).report?.emailMasked).toBe("da…@example.ch");
    expect((await view(first.json.url!)).report?.emailMasked).toBe("ca…@example.ch");
    // asking again gives the same personal link
    expect((await start("vierte-firma.ch", "dario@example.ch")).json.url).toBe(next.json.url);
  });

  it("scans again once the report is no longer available", async () => {
    const first = await start("fuenfte-firma.ch", "eva@example.ch");
    await finished(first.json.url!);
    await update<{ createdAt?: string }>(`analyse-${first.json.id}`, {}, (r) => void (r.createdAt = new Date(Date.now() - 91 * 86_400_000).toISOString()));
    const fresh = await start("fuenfte-firma.ch", "fritz@example.ch");
    expect(fresh.json.ok).toBe(true);
    expect(fresh.json.id).not.toBe(first.json.id);
    await finished(fresh.json.url!);
  });
});
