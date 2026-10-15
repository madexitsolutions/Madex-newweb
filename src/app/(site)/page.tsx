import type { Metadata } from "next";
import "@/components/home/home.css";
import { Hero } from "@/components/home/Hero";
import { AiSection, Offer, Pricing, Steps } from "@/components/home/Sections";
import { LatestProjects, PartnerMarquee } from "@/components/sections/HomeSections";
import { ServicesConstellation } from "@/components/sections/ServicesConstellation";
import { Testimonials } from "@/components/sections/Testimonials";
import { FaqSection } from "@/components/sections/FaqSection";
import { homeFaq } from "@/content/site";
import { projects } from "@/content/posts";
import partners from "@/content/generated/partners.json";
import { staticSeo, withSeo } from "@/lib/seo";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/", ...staticSeo["/"] });

export default function HomePage() {
  return (
    <>
      <Hero />
      <PartnerMarquee logos={partners.logos} />
      <Offer />
      <Steps />
      <AiSection />
      <ServicesConstellation intro="Ein Ansprechpartner für alles: Wir verbinden Website, Marketing, SEO, Design und Content zu einem Auftritt, der Ihr Unternehmen sichtbar macht." />
      <Pricing />
      <LatestProjects posts={projects.slice(0, 8)} />
      <Testimonials />
      <FaqSection items={homeFaq} />
    </>
  );
}
