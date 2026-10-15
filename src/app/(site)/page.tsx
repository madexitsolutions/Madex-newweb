import type { Metadata } from "next";
import { HomeHero } from "@/components/sections/HomeHero";
import { BigOffer, ContentShowcase, CreativeTeasers, Growth, LatestProjects, OfferHow, Packages, PartnerMarquee, UspStrip, WhyOnline } from "@/components/sections/HomeSections";
import { ServicesConstellation } from "@/components/sections/ServicesConstellation";
import { FaqSection } from "@/components/sections/FaqSection";
import { CtaBand } from "@/components/sections/CtaBand";
import { homeFaq } from "@/content/site";
import { projects } from "@/content/posts";
import partners from "@/content/generated/partners.json";
import graphic from "@/content/generated/graphic-portfolio.json";
import { staticSeo, withSeo } from "@/lib/seo";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/", ...staticSeo["/"] });

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <UspStrip />
      <OfferHow />
      <PartnerMarquee logos={partners.logos} />
      <ContentShowcase />
      <ServicesConstellation
        intro="Acht Disziplinen, ein Ansprechpartner: Wir verbinden Website, Marketing, SEO, Design und Content zu einem Auftritt, der Ihr Unternehmen sichtbar macht."
      />
      <Packages />
      <WhyOnline />
      <FaqSection items={homeFaq} />
      <LatestProjects posts={projects.slice(0, 8)} />
      <CreativeTeasers designs={graphic.social.slice(0, 12)} />
      <BigOffer />
      <Growth />
      <CtaBand title="Bereit für Ihren nächsten digitalen Schritt?" text="Sprechen Sie mit einem Wachstumsexperten – kostenlos und unverbindlich." href="/kostenlose-prufung" cta="Kostenloses Erstgespräch buchen" />
    </>
  );
}
