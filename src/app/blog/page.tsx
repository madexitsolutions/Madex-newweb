import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/sections/PageHero";
import { CtaBand } from "@/components/sections/CtaBand";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/motion";
import { Link } from "@/components/layout/Transition";
import { blogPosts, formatDate } from "@/content/posts";
import { media } from "@/lib/media";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Blog",
  description: "Fachartikel von Madex IT Solutions zu Webdesign, Grafikdesign und Social Media.",
  path: "/blog",
});

export default function BlogPage() {
  return (
    <>
      <PageHero eyebrow="Blog" title="Wissen rund um Web, Design & Marketing." crumbs={[{ name: "Wer wir sind", path: "/uber-uns" }, { name: "Blog", path: "/blog" }]} compact />
      <section className="section light" aria-label="Beiträge">
        <div className="container blog">
          {blogPosts.map((p, i) => (
            <Reveal key={p.slug} delay={i * 0.1}>
              <Link href={`/${p.slug}`} className={`bp${i === 0 ? " bp--lead" : ""}`} data-cursor="Lesen">
                <div className="bp__img">
                  <Image src={media(p.cover)} alt="" fill sizes="(max-width: 900px) 100vw, 60vw" priority={i === 0} />
                </div>
                <div className="bp__body">
                  <span className="bp__date">{formatDate(p.date)}</span>
                  <h2 className="h3">{p.title}</h2>
                  <p className="muted">{p.description}</p>
                  <span className="link-arrow">
                    Ganze Geschichte lesen <Icon name="arrow" size={16} />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        <style>{`
          .blog{display:grid;gap:24px}
          .bp{display:grid;grid-template-columns:1.1fr .9fr;border-radius:var(--radius-l);overflow:hidden;background:#fff;transition:box-shadow .6s}
          .bp:hover{box-shadow:0 50px 100px -50px rgba(1,41,45,.5)}
          .bp__img{position:relative;min-height:360px;overflow:hidden}
          .bp__img img{object-fit:cover;transition:transform 1.2s var(--ease-out)}
          .bp:hover .bp__img img{transform:scale(1.06)}
          .bp__body{padding:clamp(28px,4vw,56px);display:flex;flex-direction:column;justify-content:center;gap:10px}
          .bp__date{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--teal)}
          @media(max-width:900px){.bp{grid-template-columns:minmax(0,1fr)}.bp__img{min-height:240px}}
        `}</style>
      </section>
      <CtaBand />
    </>
  );
}
