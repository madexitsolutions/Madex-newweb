import type { Metadata } from "next";
import "@/components/home/home.css";
import { Hero } from "@/components/home/Hero";
import { AiSection, ContentProduction, Offer, Pricing, Steps } from "@/components/home/Sections";
import { LatestProjects, PartnerMarquee } from "@/components/sections/HomeSections";
import { ServicesConstellation } from "@/components/sections/ServicesConstellation";
import { Testimonials } from "@/components/sections/Testimonials";
import { FaqSection } from "@/components/sections/FaqSection";
import { homeFaq } from "@/content/site";
import { projects } from "@/content/posts";
import partners from "@/content/generated/partners.json";
import { staticSeo, withSeo } from "@/lib/seo";
import { getGoogleReviews } from "@/lib/server/google-reviews";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/", ...staticSeo["/"] });

export default async function HomePage() {
  const google = await getGoogleReviews();
  return (
    <>
      <Hero rating={google?.rating || undefined} />
      <PartnerMarquee logos={partners.logos} />
      <Offer />
      <Steps />
      <ContentProduction />
      <AiSection />
      <ServicesConstellation />
      <Pricing />
      <LatestProjects posts={projects.slice(0, 8)} />
      <Testimonials />
      <FaqSection items={homeFaq} />
    </>
  );
}
