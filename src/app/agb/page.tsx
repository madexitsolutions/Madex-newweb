import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { LegalBody } from "@/components/sections/LegalBody";
import legal from "@/content/generated/legal.json";
import type { Block } from "@/content/posts";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "AGB – Allgemeine Geschäftsbedingungen",
  description: "Allgemeine Geschäftsbedingungen der Madex IT Solutions GmbH, Buchenstrasse 36, 8212 Neuhausen am Rheinfall.",
  path: "/agb",
});

export default function AgbPage() {
  const blocks = (legal.agb as Block[]).slice(1);
  return (
    <>
      <PageHero eyebrow="Rechtliches" title="Allgemeine Geschäftsbedingungen" lead="Aktuelle Version vom 04.09.2022" crumbs={[{ name: "AGB", path: "/agb" }]} compact mark={false} />
      <section className="section white">
        <div className="container">
          <LegalBody blocks={blocks} />
        </div>
      </section>
    </>
  );
}
