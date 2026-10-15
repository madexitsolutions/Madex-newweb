import { SmoothScroll } from "./SmoothScroll";
import { TransitionProvider } from "./Transition";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Preloader } from "./Preloader";
import { Orion } from "./Orion";
import { Analytics } from "./Analytics";
import { organizationJsonLd } from "@/lib/seo";

/** Header, footer, chat and analytics around every public page. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#inhalt" className="skip-link">
        Zum Inhalt springen
      </a>
      <SmoothScroll>
        <TransitionProvider>
          <Preloader />
          <Header />
          <main id="inhalt" tabIndex={-1}>
            {children}
          </main>
          <Footer />
          <Orion />
          <Analytics />
        </TransitionProvider>
      </SmoothScroll>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />
    </>
  );
}
