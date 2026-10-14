import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/sections/PageHero";
import { Testimonials } from "@/components/sections/Testimonials";
import { CtaBand } from "@/components/sections/CtaBand";
import { Icon } from "@/components/ui/Icon";
import { Reveal, ScrollZoom, SplitText } from "@/components/ui/motion";
import partners from "@/content/generated/partners.json";
import { media } from "@/lib/media";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Unsere geschätzten Partner",
  description: "Starke Partner, starke Lösungen: Madex IT Solutions arbeitet mit ausgewählten Unternehmen und Spezialisten zusammen – und betreut Kunden aus der ganzen Schweiz.",
  path: "/partners",
});

function partnerName(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|de-de\.)/, "");
    if (/facebook\.com|instagram\.com/.test(host)) {
      const parts = u.pathname.split("/").filter(Boolean);
      const raw = parts[0] === "people" || parts[0] === "p" ? parts[1] : parts[0];
      return decodeURIComponent(raw ?? host)
        .replace(/^www\./, "")
        .replace(/-\d{6,}$/, "")
        .replace(/[-_.]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
    }
    return host;
  } catch {
    return url;
  }
}

export default function PartnersPage() {
  return (
    <>
      <PageHero eyebrow="Starke Partner. Starke Lösungen." title="Gemeinsam stärker für unsere Kunden." crumbs={[{ name: "Partner", path: "/partners" }]} />

      <section className="section white" aria-labelledby="pt-intro">
        <div className="container grid-2">
          <div>
            <p className="eyebrow">Netzwerk</p>
            <SplitText as="h2" text="Die richtigen Partner für erfolgreiche Projekte." className="h2" />
            <Reveal>
              <p className="lead muted">
                Für erfolgreiche Projekte braucht es die richtigen Partner. Madex IT Solutions arbeitet mit ausgewählten Unternehmen und Spezialisten zusammen, die unser Know-how in verschiedenen Bereichen ergänzen. So können
                wir unseren Kunden noch umfassendere Lösungen, kurze Wege und zuverlässige Umsetzung aus einer Hand bieten.
              </p>
            </Reveal>
          </div>
          <ScrollZoom className="pt__img">
            <Image src="/media/2024/09/71201.webp" alt="Partnerschaftliche Zusammenarbeit" width={1400} height={933} sizes="(max-width: 900px) 100vw, 50vw" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </ScrollZoom>
        </div>
      </section>

      <section className="section light" aria-labelledby="pt-logos">
        <div className="container">
          <p className="eyebrow">Kunden & Partner</p>
          <SplitText as="h2" text="Unternehmen, die uns vertrauen" className="h2" />
          <ul className="pt__wall">
            {partners.logos.map((l, i) => (
              <Reveal as="li" key={l} delay={(i % 8) * 0.03} y={20} className="pt__logo">
                <Image src={media(l)} alt="Kundenlogo" width={150} height={150} />
              </Reveal>
            ))}
          </ul>
          <h3 className="h3 pt__links-h">Besuchen Sie unsere Partner online</h3>
          <ul className="pt__links">
            {partners.links.map((l) => (
              <li key={l}>
                <a href={l} target="_blank" rel="noopener noreferrer nofollow">
                  {partnerName(l)} <Icon name="arrow-up-right" size={14} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Testimonials />
      <CtaBand />

      <style>{`
        .pt__img{aspect-ratio:3/2;border-radius:var(--radius-l)}
        .pt__wall{list-style:none;margin:40px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px}
        .pt__logo{aspect-ratio:1;border-radius:20px;background:#fff;display:grid;place-items:center;transition:transform .5s var(--ease-out),box-shadow .5s}
        .pt__logo:hover{transform:translateY(-6px) scale(1.04);box-shadow:0 30px 50px -30px rgba(1,41,45,.5)}
        .pt__logo img{width:72%;height:auto;object-fit:contain;filter:grayscale(1);opacity:.8;transition:filter .4s,opacity .4s}
        .pt__logo:hover img{filter:none;opacity:1}
        .pt__links-h{margin-top:70px}
        .pt__links{list-style:none;margin:20px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
        .pt__links a{display:inline-flex;gap:6px;align-items:center;padding:9px 14px;border-radius:999px;background:#fff;border:1px solid rgba(2,81,89,.12);font-size:14px;transition:.3s}
        .pt__links a:hover{background:var(--petrol);color:#fff;border-color:var(--petrol)}
      `}</style>
    </>
  );
}
