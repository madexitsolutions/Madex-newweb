import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/sections/PageHero";
import { CtaBand } from "@/components/sections/CtaBand";
import { Icon } from "@/components/ui/Icon";
import { StaggerGroup, StaggerItem, Tilt } from "@/components/ui/motion";
import { Link } from "@/components/layout/Transition";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Portfolio",
  description: "Durchsuchen Sie das Portfolio von Madex IT Solutions: Websites, Grafikdesign und Werbevideos für Schweizer Unternehmen.",
  path: "/portfolio",
});

const cats = [
  { href: "/website-portfolio", title: "Webdesign & Website-Erstellung", text: "Wir erstellen einzigartige und funktionale Websites, die Ihre digitalen Bedürfnisse erfüllen.", image: "/media/2026/04/autopozzo.webp", count: "70+ Websites" },
  { href: "/graphic-design-portfolio", title: "Graphic Design", text: "Einzigartige und visuell ansprechende Designs, die Ihre Marke zum Leben erwecken.", image: "/media/2026/04/MONAROSA.webp", count: "Brandings, Print & Social" },
  { href: "/werbevideos-portfolio", title: "Photo & Werbevideos", text: "Kreative und ansprechende visuelle Inhalte zur Förderung Ihrer Marke.", image: "/media/2026/10/Madex-VIDEO-1.webp", count: "Werbeclips & Imagefilme" },
];

export default function PortfolioPage() {
  return (
    <>
      <PageHero eyebrow="Portfolio" title="Durchsuchen Sie unser Portfolio." lead="Hier finden Sie einige unserer neuesten Projekte, die wir erstellt haben." crumbs={[{ name: "Portfolio", path: "/portfolio" }]} />
      <section className="section light" aria-label="Portfolio-Kategorien">
        <div className="container">
          <StaggerGroup className="pf">
            {cats.map((c, i) => (
              <StaggerItem key={c.href} as="article">
                <Tilt max={6}>
                  <Link href={c.href} className="pf__card" data-cursor="Öffnen">
                    <Image src={c.image} alt="" fill sizes="(max-width: 900px) 100vw, 33vw" className="pf__img" priority={i === 0} />
                    <span className="pf__shade" />
                    <span className="pf__n">0{i + 1}</span>
                    <span className="pf__body">
                      <span className="chip">{c.count}</span>
                      <h2 className="h3">{c.title}</h2>
                      <p>{c.text}</p>
                      <span className="pf__more">
                        Mehr erfahren <Icon name="arrow-up-right" size={18} />
                      </span>
                    </span>
                  </Link>
                </Tilt>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
        <style>{`
          .pf{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
          .pf__card{position:relative;display:flex;align-items:flex-end;min-height:560px;border-radius:var(--radius-l);overflow:hidden;color:#fff;background:var(--night)}
          .pf__img{object-fit:cover;transition:transform 1.4s var(--ease-out)}
          .pf__card:hover .pf__img{transform:scale(1.08)}
          .pf__shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(1,27,30,.05) 20%,rgba(1,27,30,.92) 80%)}
          .pf__n{position:absolute;top:24px;left:28px;font:800 64px/1 var(--font-display);color:transparent;-webkit-text-stroke:1.5px rgba(255,255,255,.6)}
          .pf__body{position:relative;padding:32px;display:grid;gap:10px;justify-items:start}
          .pf__body .chip{background:rgba(79,224,210,.18);color:var(--teal-glow)}
          .pf__body p{margin:0;opacity:.8}
          .pf__more{display:flex;gap:8px;align-items:center;color:var(--teal-glow);font-weight:500;margin-top:6px}
          @media(max-width:1000px){.pf{grid-template-columns:minmax(0,1fr)}.pf__card{min-height:440px}}
        `}</style>
      </section>
      <CtaBand />
    </>
  );
}
