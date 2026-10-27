import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { seoEntries } from "@/server/db/schema";
import { rateSeo, ratedPages, seoGrade, type SitePage } from "@/server/content/seo";

const good = { path: "/kontakt", title: "Kontakt – Webagentur in Neuhausen am Rheinfall", description: "Schreiben oder rufen Sie uns an: Wir beraten Sie zu Webdesign, Google Ads und SEO in Schaffhausen und Umgebung – kostenlos.", ogImage: "/media/kontakt.webp", noindex: false };

describe("rateSeo", () => {
  it("gives 100 when everything is in place", () => {
    expect(rateSeo(good).score).toBe(100);
    expect(seoGrade(100).label).toBe("Sehr gut");
  });
  it("names the concrete problem", () => {
    const r = rateSeo({ ...good, title: "Kontakt", description: "", ogImage: "/og.jpg" });
    const open = r.checks.filter((c) => !c.ok).map((c) => c.issue);
    expect(open).toEqual(["Titel zu kurz (7 Zeichen)", "Beschreibung fehlt", "Beschreibung zu kurz (0 Zeichen)", "Kein eigenes Vorschaubild"]);
    expect(r.score).toBeLessThan(50);
  });
  it("punishes noindex and duplicate titles", () => {
    expect(rateSeo({ ...good, noindex: true }).score).toBe(90);
    expect(rateSeo(good, true).score).toBe(95);
  });
});

describe("ratedPages", () => {
  const defaults: SitePage[] = [
    { path: "/", group: "Seiten", title: "Webdesign Schaffhausen – Websites für KMU", description: "Ihre neue Website ist inklusive: Webdesign, SEO und Google Ads für Schweizer KMU aus Neuhausen am Rheinfall. Jetzt Gratis-Analyse anfordern." },
    { path: "/kontakt", group: "Seiten", title: "Kontakt", description: "" },
  ];
  it("uses the website defaults until something is changed in the dashboard", async () => {
    const before = await ratedPages(defaults);
    expect(before.map((p) => [p.path, p.custom])).toEqual([
      ["/", false],
      ["/kontakt", false],
    ]);
    await db.insert(seoEntries).values({ path: "/kontakt", title: good.title, description: good.description });
    await db.insert(seoEntries).values({ path: "/extra", title: "Nur im Dashboard" });
    const after = await ratedPages(defaults);
    const kontakt = after.find((p) => p.path === "/kontakt")!;
    expect(kontakt.custom).toBe(true);
    expect(kontakt.title).toBe(good.title);
    expect(kontakt.score).toBeGreaterThan(before.find((p) => p.path === "/kontakt")!.score);
    expect(after.find((p) => p.path === "/extra")?.group).toBe("Weitere");
  });
});
