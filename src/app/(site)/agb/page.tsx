import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { LegalBody } from "@/components/sections/LegalBody";
import legal from "@/content/generated/legal.json";
import type { Block } from "@/content/posts";
import { staticSeo, withSeo } from "@/lib/seo";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/agb", ...staticSeo["/agb"] });

export default function AgbPage() {
  const blocks = (legal.agb as Block[]).slice(1);
  return (
    <>
      <PageHero eyebrow="Rechtliches" title="Allgemeine Geschäftsbedingungen" lead="Aktuelle Version vom 04.09.2022" crumbs={[{ name: "AGB", path: "/agb" }]} compact scene="legal" />
      <section className="section white">
        <div className="container">
          <LegalBody blocks={blocks} />
        </div>
      </section>
    </>
  );
}
