import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { ProjectExplorer } from "@/components/sections/ProjectExplorer";
import { screenImage } from "@/components/sections/screenImage";
import { CtaBand } from "@/components/sections/CtaBand";
import { Button } from "@/components/ui/Button";
import { Reveal, SplitText } from "@/components/ui/motion";
import { getProjects } from "@/lib/server/projects";
import { staticSeo, withSeo } from "@/lib/seo";

export const generateMetadata = (): Promise<Metadata> => withSeo({ path: "/website-portfolio", ...staticSeo["/website-portfolio"] });

export default async function WebsitePortfolioPage() {
  const projects = await getProjects();
  return (
    <>
      <PageHero scene="portfolio"
        title="Ihre Chance: kostenlose Website mit unserem Online-Marketing-Paket."
        lead="Bei uns erhalten Sie mehr als erstklassiges Online-Marketing und Website-Wartung – wir schenken Ihnen eine moderne, professionelle Website."
        crumbs={[
          { name: "Portfolio", path: "/portfolio" },
          { name: "Website Portfolio", path: "/website-portfolio" },
        ]}
      >
        <Button href="/kostenlose-prufung">Gratis-Analyse anfordern</Button>
      </PageHero>
      <section className="section--tight white" aria-labelledby="wp-why">
        <div className="container grid-2">
          <SplitText as="h2" text="Warum machen wir das?" className="h2" />
          <Reveal>
            <p className="lead muted">
              Entscheiden Sie sich für einen 1-Jahres-Vertrag und profitieren Sie von einer digitalen Lösung, die Ihre Sichtbarkeit nachhaltig stärkt. Unsere Leistungen sind in der gesamten Ostschweiz verfügbar, darunter in
              den Kantonen Thurgau, Zürich, Schaffhausen und St. Gallen.
            </p>
            <p className="muted">
              Ganz einfach: Wir wollen unseren Kunden den vollen Nutzen unserer Dienstleistungen zeigen. Eine starke Online-Präsenz beginnt mit einer optimierten Website – und mit einem fairen Preis-Leistungs-Verhältnis
              möchten wir Sie nicht nur überzeugen, sondern als treuen Kunden gewinnen. Lassen Sie uns gemeinsam Ihre digitale Zukunft gestalten – effektiv, professionell und fair!
            </p>
          </Reveal>
        </div>
      </section>
      <ProjectExplorer posts={projects} screens={Object.fromEntries(projects.slice(0, 16).map((p) => [p.slug, screenImage(p)]))} />
      <CtaBand />
    </>
  );
}
