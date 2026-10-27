import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { clearGa4Cache } from "@/server/analytics/ga4";
import { clearSearchConsoleCache, gscCandidates, gscPath, searchConsolePages, searchConsoleQueries } from "@/server/analytics/search-console";
import { saveSettings } from "@/server/settings";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

afterEach(() => {
  vi.unstubAllGlobals();
  clearSearchConsoleCache();
  clearGa4Cache();
});

describe("search console helpers", () => {
  it("maps URLs to paths", () => {
    expect(gscPath("https://www.madex-it.ch/")).toBe("/");
    expect(gscPath("https://madex-it.ch/kontakt/")).toBe("/kontakt");
    expect(gscPath("https://madex-it.ch/marketing-solutions/seo")).toBe("/marketing-solutions/seo");
  });
  it("tries the domain property first", () => {
    expect(gscCandidates("www.madex-it.ch", "")).toEqual(["sc-domain:madex-it.ch", "https://www.madex-it.ch/"]);
    expect(gscCandidates("madex-it.ch", "")).toEqual(["sc-domain:madex-it.ch", "https://madex-it.ch/", "https://www.madex-it.ch/"]);
    expect(gscCandidates("madex-it.ch", "https://madex-it.ch/")).toEqual(["https://madex-it.ch/"]);
  });
});

describe("searchConsolePages", () => {
  it("is not configured without a service account", async () => {
    expect(await searchConsolePages("madex-it.ch")).toEqual({ configured: false });
  });

  describe("with a service account", () => {
    beforeAll(async () => {
      await saveSettings("analytics", { serviceAccountEmail: "gsc@projekt.iam.gserviceaccount.com", serviceAccountKey: pem });
    });

    it("falls back to the URL prefix property and adds up page variants", async () => {
      const sites: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init: RequestInit) => {
          if (url.includes("oauth2")) {
            expect(String(init.body)).toContain("assertion=");
            return Response.json({ access_token: "tok", expires_in: 3600 });
          }
          const site = decodeURIComponent(url.split("/sites/")[1].split("/")[0]);
          sites.push(site);
          if (site.startsWith("sc-domain:")) return new Response("forbidden", { status: 403 });
          const body = JSON.parse(String(init.body));
          if (body.dimensions.includes("query"))
            return Response.json({ rows: [{ keys: ["https://madex-it.ch/kontakt", "webagentur schaffhausen"], clicks: 4, impressions: 40, ctr: 0.1, position: 3.2 }] });
          return Response.json({
            rows: [
              { keys: ["https://madex-it.ch/"], clicks: 30, impressions: 600, ctr: 0.05, position: 4 },
              { keys: ["https://madex-it.ch/kontakt/"], clicks: 5, impressions: 100, ctr: 0.05, position: 6 },
              { keys: ["http://madex-it.ch/kontakt"], clicks: 1, impressions: 100, ctr: 0.01, position: 10 },
            ],
          });
        }),
      );
      const r = await searchConsolePages("madex-it.ch");
      expect(r.configured && "report" in r).toBe(true);
      if (!("report" in r)) return;
      expect(r.report.site).toBe("https://madex-it.ch/");
      expect(r.report.totals.clicks).toBe(36);
      expect(r.report.pages["/kontakt"]).toMatchObject({ clicks: 6, impressions: 200, ctr: 0.03, position: 8 });
      expect(sites).toEqual(["sc-domain:madex-it.ch", "https://madex-it.ch/"]);
      // the working property is remembered
      expect(await searchConsoleQueries("madex-it.ch", "/kontakt")).toEqual([{ query: "webagentur schaffhausen", clicks: 4, impressions: 40, ctr: 0.1, position: 3.2 }]);
      expect(sites.at(-1)).toBe("https://madex-it.ch/");
      expect(sites).toHaveLength(3);
    });

    it("explains a missing permission", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => (url.includes("oauth2") ? Response.json({ access_token: "tok", expires_in: 3600 }) : new Response("no", { status: 403 }))),
      );
      const r = await searchConsolePages("madex-it.ch");
      expect("error" in r && r.error).toMatch(/Nutzer und Berechtigungen/);
    });
  });
});
