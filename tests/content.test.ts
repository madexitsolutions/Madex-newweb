import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { posts, projects, blogPosts } from "@/content/posts";
import { services } from "@/content/services";
import { clientSupport, leadership, mainNav, photoShoots, site, teamGroups } from "@/content/site";
import { media } from "@/lib/media";
import graphic from "@/content/generated/graphic-portfolio.json";
import partners from "@/content/generated/partners.json";

const pub = (p: string) => join(process.cwd(), "public", p);

describe("Inhalte", () => {
  it("enthält alle neun Leistungen (inkl. KI-Assistent) mit eindeutigen Slugs", () => {
    expect(services).toHaveLength(9);
    expect(new Set(services.map((s) => s.slug)).size).toBe(9);
    for (const s of services) expect(s.faq.length).toBeGreaterThan(0);
  });

  it("übernimmt alle Projekt- und Blogbeiträge der alten Website", () => {
    expect(posts.length).toBe(76);
    expect(blogPosts.length).toBe(2);
    expect(projects.length).toBe(74);
    expect(new Set(posts.map((p) => p.slug)).size).toBe(posts.length);
    for (const p of posts) expect(p.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("verwendet Schweizer Rechtschreibung (kein ß)", () => {
    const all = JSON.stringify({ posts, services, site, mainNav });
    expect(all).not.toContain("ß");
  });

  it("hat dieselbe Hauptnavigation wie madex-it.ch", () => {
    expect(mainNav.map((n) => n.label)).toEqual(["Marketing Lösungen", "Wer wir sind", "Portfolio", "Partner", "Kontakt"]);
    expect(mainNav[0].children).toHaveLength(9);
  });
});

describe("Medien", () => {
  it("alle referenzierten Bilder liegen lokal vor", () => {
    const paths = [
      ...posts.flatMap((p) => [p.cover, p.image, ...p.blocks.filter((b) => b.type === "img").map((b) => (b as { src: string }).src)]),
      ...graphic.branding,
      ...graphic.print,
      ...graphic.social,
      ...partners.logos,
    ]
      .filter(Boolean)
      .map(media);
    const local = [
      ...services.flatMap((s) => [s.image, ...(s.gallery ?? []), ...s.sections.map((x) => x.image).filter(Boolean)]),
      ...[...leadership, ...clientSupport].map((m) => m.image),
      ...teamGroups.flatMap((g) => g.members.map((m) => m.image)),
      ...photoShoots,
    ] as string[];
    const missing = [...paths, ...local].filter((p) => !existsSync(pub(p)));
    expect(missing).toEqual([]);
  });

  it("liefert keine Hotlinks auf die alte Website aus", () => {
    const src = readFileSync(join(process.cwd(), "src/content/services.ts"), "utf8") + readFileSync(join(process.cwd(), "src/content/site.ts"), "utf8");
    expect(src).not.toMatch(/madex-it\.ch\/wp-content/);
  });
});
