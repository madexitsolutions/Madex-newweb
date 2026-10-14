import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { VideoGrid } from "@/components/sections/VideoGrid";
import { CtaBand } from "@/components/sections/CtaBand";
import { Button } from "@/components/ui/Button";
import { Reveal, ScrollZoom, SplitText } from "@/components/ui/motion";
import videos from "@/content/generated/videos.json";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Werbevideos Portfolio – Kreative Videos für Unternehmen",
  description: "Eine Auswahl kreativer und wirkungsvoller Werbevideos, die Madex IT Solutions für Unternehmen aus Schaffhausen und der Ostschweiz produziert hat.",
  path: "/werbevideos-portfolio",
});

export default function VideoPortfolioPage() {
  return (
    <>
      <PageHero
        eyebrow="Werbevideos Portfolio"
        title="Geschichten, die Marken in Bewegung setzen."
        lead="Jedes Video ist einzigartig und wurde individuell auf die Bedürfnisse und Ziele unserer Kunden abgestimmt."
        crumbs={[
          { name: "Portfolio", path: "/portfolio" },
          { name: "Werbevideos Portfolio", path: "/werbevideos-portfolio" },
        ]}
      >
        <Button href="/marketing-solutions/photo-werbevideos">Photo & Werbevideos</Button>
      </PageHero>
      <section className="section white" aria-labelledby="vp-reel">
        <div className="container grid-2">
          <div>
            <p className="eyebrow">Showreel</p>
            <SplitText as="h2" text="Werbevideos Portfolio" className="h2" />
            <Reveal>
              <p className="lead muted">
                In unserem Werbevideos-Portfolio präsentieren wir Ihnen eine Auswahl an kreativen und wirkungsvollen Videos, die wir für verschiedene Unternehmen produziert haben. Schauen Sie sich unsere Arbeiten an und
                entdecken Sie, wie wir Geschichten visuell zum Leben erwecken.
              </p>
            </Reveal>
          </div>
          <ScrollZoom className="vp__reel">
            <video src="/media/2026/10/Madex-VIDEO-1.mp4" poster="/media/2026/10/Madex-VIDEO-1.webp" controls muted loop playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }}>
              <track kind="captions" />
            </video>
          </ScrollZoom>
        </div>
        <style>{`.vp__reel{aspect-ratio:16/9;border-radius:var(--radius-l)}`}</style>
      </section>
      <section className="section light" aria-label="Alle Werbevideos">
        <div className="container">
          <VideoGrid ids={videos} />
        </div>
      </section>
      <CtaBand />
    </>
  );
}
