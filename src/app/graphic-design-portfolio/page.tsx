import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { Gallery } from "@/components/sections/Gallery";
import { CtaBand } from "@/components/sections/CtaBand";
import { Button } from "@/components/ui/Button";
import graphic from "@/content/generated/graphic-portfolio.json";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Graphic Design Portfolio – Brandings, Print & Social Media",
  description: "Grafikdesigns für Unternehmen in Thurgau, Zürich und Schaffhausen: Brandings, Printprodukte und Social-Media-Designs von Madex IT Solutions.",
  path: "/graphic-design-portfolio",
});

export default function GraphicPortfolioPage() {
  return (
    <>
      <PageHero scene="design"
        eyebrow="Graphic Design Portfolio"
        title="Social Media Designs, die sofort auffallen."
        lead="Wir gestalten visuelle Inhalte, die Ihre Marke stärken, Vertrauen aufbauen und im Feed herausstechen."
        crumbs={[
          { name: "Portfolio", path: "/portfolio" },
          { name: "Graphic Design Portfolio", path: "/graphic-design-portfolio" },
        ]}
      >
        <Button href="/marketing-solutions/graphic-design">Graphic Design Leistungen</Button>
      </PageHero>
      <section className="section light" aria-label="Arbeiten">
        <div className="container">
          <Gallery
            tabs={[
              { id: "branding", label: "Brandings", items: graphic.branding },
              { id: "print", label: "Print", items: graphic.print },
              { id: "social", label: "Social Media", items: graphic.social },
            ]}
          />
        </div>
      </section>
      <CtaBand />
    </>
  );
}
