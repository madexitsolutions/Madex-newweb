import { describe, expect, it } from "vitest";
import type { Check } from "@/lib/analysis";
import { fallback } from "@/lib/server/analysis/ai";
import { contentChecks, mobileChecks, parsePage, preview, seoChecks, speedChecks } from "@/lib/server/analysis/page";
import { isPrivateAddress, normalizeUrl } from "@/lib/server/analysis/safe-fetch";
import { lighthouseChecks, scoreChecks } from "@/lib/server/analysis/score";

describe("normalizeUrl", () => {
  it("accepts what people type", () => {
    expect(normalizeUrl("firma.ch")?.toString()).toBe("https://firma.ch/");
    expect(normalizeUrl(" www.firma.ch/leistungen ")?.toString()).toBe("https://www.firma.ch/leistungen");
    expect(normalizeUrl("http://firma.ch#x")?.toString()).toBe("http://firma.ch/");
  });
  it("refuses internal and odd targets", () => {
    for (const bad of ["localhost", "http://127.0.0.1", "https://[::1]/", "intranet", "drucker.local", "https://firma.ch:8080", "ftp://firma.ch", "https://user:pw@firma.ch", "firma .ch", ""]) expect(normalizeUrl(bad), bad).toBeNull();
  });
});

describe("isPrivateAddress", () => {
  it("blocks private, loopback, link-local and mapped addresses", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "172.16.5.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) expect(isPrivateAddress(ip), ip).toBe(true);
  });
  it("lets public addresses through", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "2a00:1450:4001::200e", "::ffff:8.8.8.8"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
});

const c = (category: Check["category"], status: Check["status"], weight = 1, id = `${category}-${status}-${weight}`): Check => ({ id, category, label: id, status, weight });

describe("scoreChecks", () => {
  it("weights ok, warn and bad and ignores info", () => {
    const s = scoreChecks([c("seo", "ok", 3), c("seo", "bad", 1), c("seo", "info", 5), c("mobile", "warn", 2)]);
    expect(s.seo).toBe(75);
    expect(s.mobile).toBe(50);
    expect(s.google).toBe(0);
  });
  it("caps the total when Google may not index the page", () => {
    const all = (["seo", "google", "design", "mobile", "speed", "tech", "content"] as const).map((k) => c(k, "ok", 2));
    expect(scoreChecks(all).overall).toBe(100);
    expect(scoreChecks([...all, c("google", "bad", 0.1, "indexable")]).overall).toBe(45);
  });
});

describe("lighthouseChecks", () => {
  it("turns Google scores into checks", () => {
    const lh = { performance: 42, seo: 92, accessibility: 78, bestPractices: 100, vitals: { score: 42, lcp: 5200, cls: 0.02, tbt: 300 }, opportunities: [], hasScreenshot: false };
    const list = lighthouseChecks(lh, null);
    expect(list.find((x) => x.id === "lh-mobile")?.status).toBe("bad");
    expect(list.find((x) => x.id === "lh-mobile-lcp")?.status).toBe("bad");
    expect(list.find((x) => x.id === "lh-seo")?.status).toBe("ok");
    expect(list.find((x) => x.id === "lh-cls")?.status).toBe("ok");
    expect(list.find((x) => x.id === "lh-tbt")?.status).toBe("warn");
  });
});

const html = `<!doctype html><html lang="de-CH"><head>
<title>Malerei Muster AG – Maler in Winterthur</title>
<meta name="description" content="Malerarbeiten, Fassaden und Tapeten in Winterthur und Umgebung. Offerte innert 48 Stunden, seit 1985 für Sie da.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:image" content="/og.jpg"><link rel="icon" href="/fav.png">
<style>@media (max-width: 700px){body{font-size:15px}}</style>
</head><body>
<header><nav><a href="/">Start</a><a href="/leistungen">Leistungen</a><a href="/kontakt">Kontakt</a></nav></header>
<h1>Ihr Maler in Winterthur</h1>
<h2>Leistungen</h2><p>Wir streichen Wände.</p><h2>Referenzen</h2>
<img src="a.webp" alt="Fassade" loading="lazy"><img src="b.jpg">
<a href="tel:+41521234567">052 123 45 67</a> <a href="mailto:info@muster.ch">E-Mail</a>
<a href="/kontakt">Offerte anfragen</a>
<footer><a href="/impressum">Impressum</a> <a href="/datenschutz">Datenschutz</a> © 2019</footer>
</body></html>`;

const parsed = () => parsePage({ url: "https://muster.ch/", status: 200, headers: new Headers({ "content-type": "text/html" }), body: html, bytes: html.length, ms: 120, redirects: [] });

describe("page checks", () => {
  it("reads the preview data", () => {
    const p = preview(parsed());
    expect(p.title).toBe("Malerei Muster AG – Maler in Winterthur");
    expect(p.h1).toBe("Ihr Maler in Winterthur");
    expect(p.nav).toEqual(["Start", "Leistungen", "Kontakt"]);
    expect(p.favicon).toBe("https://muster.ch/fav.png");
    expect(p.ogImage).toBe("https://muster.ch/og.jpg");
    expect(p.images).toBe(2);
  });
  it("judges SEO, mobile, speed and content from the HTML", () => {
    const p = parsed();
    const all = [...seoChecks(p), ...mobileChecks(p), ...speedChecks(p), ...contentChecks(p)];
    const st = (id: string) => all.find((x) => x.id === id)?.status;
    expect(st("title")).toBe("ok");
    expect(st("h1")).toBe("ok");
    expect(st("alt")).not.toBe("ok");
    expect(st("viewport")).toBe("ok");
    expect(st("legal")).toBe("ok");
    expect(st("contact")).toBe("ok");
    expect(all.every((x) => !/ß/.test(`${x.label} ${x.value ?? ""} ${x.detail ?? ""}`))).toBe(true);
  });
});

describe("fallback insights", () => {
  it("names the weakest areas and picks the heaviest problems", () => {
    const checks = [c("seo", "bad", 3, "title"), c("mobile", "warn", 1, "zoom"), c("google", "ok", 2, "sitemap"), c("tech", "bad", 1, "headers")];
    const scores = scoreChecks(checks);
    const r = fallback({ url: "https://muster.ch/", page: preview(parsed()), checks, scores, opportunities: [] });
    expect(r.ai).toBe(false);
    expect(r.top[0].title).toBe("title");
    expect(r.top[0].impact).toBe("hoch");
    expect(r.summary).toContain("Potenzial");
  });
});

describe("design checks and recommendations", () => {
  it("reads fonts, builders and dated markup from the code", async () => {
    const { designChecks } = await import("@/lib/server/analysis/page");
    const old = `<html><body><center><font face="Arial">Willkommen</font></center><table width="800" bgcolor="#fff"><tr><td>a</td></tr></table><table width="800" cellpadding="2"><tr><td>b</td></tr></table><img src="https://static.wixstatic.com/media/a.jpg"><p>Individuelle Beratung</p></body></html>`;
    const list = await designChecks(parsePage({ url: "https://alt.ch/", status: 200, headers: new Headers(), body: old, bytes: old.length, ms: 50, redirects: [] }));
    const st = (id: string) => list.find((x) => x.id === id)?.status;
    expect(st("fonts")).toBe("warn");
    expect(st("template")).toBe("warn");
    expect(st("legacy")).toBe("bad");
    expect(list.find((x) => x.id === "template")?.value).toBe("Baukasten: Wix");
  });
  it("does not count WordPress with Elementor as a weakness", async () => {
    const { designChecks } = await import("@/lib/server/analysis/page");
    const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet"><link rel="stylesheet" href="/wp-content/plugins/elementor/assets/css/frontend.min.css"></head><body><div class="elementor-section elementor-top-section">x</div></body></html>`;
    const list = await designChecks(parsePage({ url: "https://kunde.ch/", status: 200, headers: new Headers(), body: html, bytes: html.length, ms: 50, redirects: [] }));
    expect(list.find((x) => x.id === "template")?.status).toBe("ok");
  });
  it("does not take words in the text for a page builder", async () => {
    const { designChecks } = await import("@/lib/server/analysis/page");
    const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet"></head><body><p>Individuelle Websites, kein Baukasten wie Wix oder Jimdo.</p></body></html>`;
    const list = await designChecks(parsePage({ url: "https://neu.ch/", status: 200, headers: new Headers(), body: html, bytes: html.length, ms: 50, redirects: [] }));
    expect(list.find((x) => x.id === "template")?.status).toBe("ok");
  });
  it("always gives three recommendations, even when everything passes", () => {
    const checks = (["seo", "google", "design", "mobile", "speed", "tech", "content"] as const).map((k) => c(k, "ok", 2));
    const r = fallback({ url: "https://top.ch/", page: preview(parsed()), checks, scores: scoreChecks(checks), opportunities: [] });
    expect(r.top).toHaveLength(3);
    expect(Object.values(r.categories).join(" ")).not.toMatch(/alles im grünen Bereich/);
  });
});

describe("scanner protection", () => {
  it("treats www and case variants as the same website", async () => {
    const { domainKey } = await import("@/lib/server/analysis/guard");
    expect(domainKey("WWW.Firma.ch")).toBe("firma.ch");
    expect(domainKey("firma.ch.")).toBe("firma.ch");
  });
  it("groups visitors by network", async () => {
    const { networkOf } = await import("@/lib/server/analysis/guard");
    expect(networkOf("203.0.113.57")).toBe("203.0.113");
    expect(networkOf("2001:db8:85a3:42:1:2:3:4")).toBe("2001:db8:85a3:42");
  });
  it("uses the IP set by the proxy, not the one a visitor can fake", async () => {
    const { clientIp } = await import("@/lib/server/analysis/guard");
    expect(clientIp(new Request("https://madex-it.ch/api/analyse", { headers: { "x-forwarded-for": "1.1.1.1, 198.51.100.7" } }))).toBe("198.51.100.7");
    expect(clientIp(new Request("https://madex-it.ch/api/analyse", { headers: { "x-forwarded-for": "1.1.1.1", "x-real-ip": "198.51.100.8" } }))).toBe("198.51.100.8");
  });
  it("only accepts requests from our own site", async () => {
    const { fromOwnSite } = await import("@/lib/server/analysis/guard");
    const req = (origin?: string) => new Request("https://madex-it.ch/api/analyse", { method: "POST", headers: { host: "madex-it.ch", ...(origin ? { origin } : {}) } });
    expect(fromOwnSite(req("https://madex-it.ch"))).toBe(true);
    expect(fromOwnSite(req("https://angreifer.example"))).toBe(false);
    expect(fromOwnSite(req())).toBe(false);
  });
});

describe("sites built by Madex", () => {
  it("recognises the footer credit or a link to madex-it.ch", async () => {
    const { isMadexSite } = await import("@/lib/server/analysis/engine");
    expect(isMadexSite("<footer>Design & Development made by MADEX IT SOLUTIONS</footer>")).toBe(true);
    expect(isMadexSite('<footer><a href="https://madex-it.ch">Webdesign</a></footer>')).toBe(true);
    expect(isMadexSite("<footer>© 2026 Malerei Muster</footer>")).toBe(false);
  });
  it("writes positive texts with growth steps instead of criticism", () => {
    const checks = [c("design", "warn", 2, "fonts"), c("seo", "ok", 2, "title")];
    const r = fallback({ url: "https://kunde.ch/", page: preview(parsed()), checks, scores: scoreChecks(checks), opportunities: [], madex: true });
    expect(r.headline).toMatch(/Professionell/);
    expect(r.top.every((t) => t.impact !== "hoch")).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/Handlungsbedarf|verschenkt|veraltet/);
  });
});

describe("client-safe AI texts", () => {
  it("replaces design criticism from the model on a Madex site", async () => {
    const { vi } = await import("vitest");
    const critical = {
      headline: "Veraltetes Design kostet Kunden",
      summary: "Das Design wirkt veraltet und unprofessionell.",
      strengths: ["Schnelle Antwortzeit"],
      categories: { design: "Das Layout ist schwach.", seo: "Titel und Beschreibung sind gut gesetzt." },
      top: [{ title: "Design komplett erneuern", problem: "Das Design ist veraltet.", solution: "Neues Design.", impact: "hoch" }],
    };
    vi.stubEnv("OPENAI_API_KEY", "sk-test-only-1234567890");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(critical) } }] }), { status: 200 }));
    try {
      const { insights } = await import("@/lib/server/analysis/ai");
      const checks = [c("design", "ok", 4, "design-pro"), c("seo", "ok", 2, "title")];
      const r = await insights({ url: "https://kunde.ch/", page: preview(parsed()), checks, scores: scoreChecks(checks), opportunities: [], madex: true });
      expect(r.ai).toBe(true);
      expect(r.headline).toMatch(/Professionell/);
      expect(r.summary).not.toMatch(/veraltet/i);
      expect(r.categories.design).toMatch(/Professionell/);
      expect(r.categories.seo).toBe("Titel und Beschreibung sind gut gesetzt.");
      expect(r.top.map((t) => t.title)).not.toContain("Design komplett erneuern");
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
