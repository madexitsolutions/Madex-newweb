import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/sections/PageHero";
import { ProjectCard } from "@/components/sections/ProjectCard";
import { CtaBand } from "@/components/sections/CtaBand";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Reveal, ScrollZoom, StaggerGroup, StaggerItem, Tilt } from "@/components/ui/motion";
import { Link } from "@/components/layout/Transition";
import { formatDate, getPost, posts, projects, type Block } from "@/content/posts";
import { media } from "@/lib/media";
import { withSeo } from "@/lib/seo";
import { site } from "@/content/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) return {};
  return withSeo({ title: p.title, description: p.description || p.title, path: `/${p.slug}`, image: media(p.cover) });
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Body({ blocks, skipImage }: { blocks: Block[]; skipImage?: string }) {
  let imgIndex = 0;
  return (
    <div className="pb">
      {blocks.map((b, i) => {
        if (b.type === "img") {
          if (b.src === skipImage && imgIndex === 0) {
            imgIndex++;
            return null;
          }
          imgIndex++;
          return (
            <ScrollZoom key={i} className="pb__img">
              <Image src={media(b.src)} alt={b.alt || "Screenshot des Projekts"} width={1600} height={900} sizes="(max-width: 1000px) 100vw, 900px" style={{ width: "100%", height: "auto" }} />
            </ScrollZoom>
          );
        }
        if (b.type === "h") {
          return (
            <Reveal key={i}>
              <h2 className="pb__h">{b.text}</h2>
            </Reveal>
          );
        }
        if (b.type === "li") {
          return (
            <Reveal key={i} y={16}>
              <p className="pb__li">
                <Icon name="check" size={16} strokeWidth={2.4} /> {b.text}
              </p>
            </Reveal>
          );
        }
        return (
          <Reveal key={i} y={20}>
            <p className="pb__p">{b.text}</p>
          </Reveal>
        );
      })}
      <style>{`
        .pb{max-width:860px;margin:0 auto}
        .pb__h{font-size:clamp(22px,2.2vw,32px);margin:50px 0 14px}
        .pb__p{font-size:clamp(16px,1.15vw,19px);color:var(--text-soft)}
        .pb__li{display:flex;gap:10px;align-items:baseline;color:var(--text-soft);margin:0 0 8px}
        .pb__li svg{color:var(--teal);flex:none}
        .pb__img{margin:40px -6vw;border-radius:var(--radius-m);box-shadow:0 40px 80px -50px rgba(1,41,45,.6)}
        @media(max-width:1000px){.pb__img{margin:30px 0}}
      `}</style>
    </div>
  );
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const isProject = post.category === "website-portfolio";
  const pool = isProject ? projects : posts;
  const idx = pool.indexOf(post);
  const more = [1, 2, 3].map((k) => pool[(idx + k) % pool.length]).filter((p) => p.slug !== post.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": isProject ? "CreativeWork" : "BlogPosting",
    headline: post.title,
    datePublished: post.date,
    image: `${site.url}${media(post.cover)}`,
    author: { "@type": "Organization", name: site.name },
    publisher: { "@type": "Organization", name: site.name },
    inLanguage: "de-CH",
  };

  return (
    <>
      <PageHero scene="laptop" sceneProps={{ image: media(post.cover) }}
        eyebrow={isProject ? `Website Portfolio · ${formatDate(post.date)}` : `Blog · ${formatDate(post.date)}`}
        title={isProject ? post.client : post.title}
        lead={isProject ? post.title : undefined}
        crumbs={
          isProject
            ? [
                { name: "Website Portfolio", path: "/website-portfolio" },
                { name: post.client, path: `/${post.slug}` },
              ]
            : [
                { name: "Blog", path: "/blog" },
                { name: post.title, path: `/${post.slug}` },
              ]
        }
        compact
      >
        {post.external && (
          <Button href={post.external} target="_blank">
            {host(post.external)} besuchen
          </Button>
        )}
      </PageHero>

      <section className="pp__cover-wrap light">
        <div className="container">
          <Reveal y={60}>
            <Tilt max={4}>
              <div className="pp__cover">
                <Image src={media(post.cover)} alt={`${post.client} – Projektvorschau`} width={2000} height={1400} sizes="(max-width: 1400px) 100vw, 1300px" priority style={{ width: "100%", height: "auto" }} />
              </div>
            </Tilt>
          </Reveal>
        </div>
      </section>

      <article className="section light pp__article">
        <div className="container">
          <Body blocks={post.blocks} skipImage={post.cover === post.image ? post.image : undefined} />
          <Reveal className="pp__cta">
            <h2 className="h3">Sind Sie bereit, Ihr Unternehmen mit Madex IT Solutions auszubauen?</h2>
            <p className="muted">Holen Sie sich ein kostenloses Beratungsgespräch, um Ihr Geschäft anzukurbeln!</p>
            <div className="pp__cta-row">
              <Button href="/kostenlose-prufung">Kostenloses Erstgespräch buchen</Button>
              {post.external && (
                <Button href={post.external} target="_blank" variant="ghost">
                  Website ansehen
                </Button>
              )}
            </div>
          </Reveal>
        </div>
      </article>

      <section className="section white" aria-labelledby="pp-more">
        <div className="container">
          <div className="pp__more-head">
            <h2 id="pp-more" className="h2">
              Was als Nächstes zu lesen ist
            </h2>
            <Link href={isProject ? "/website-portfolio" : "/blog"} className="link-arrow">
              Alle ansehen <Icon name="arrow" size={18} />
            </Link>
          </div>
          <StaggerGroup className="pp__more">
            {more.map((p) => (
              <StaggerItem key={p.slug}>
                <ProjectCard post={p} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <CtaBand />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style>{`
        .pp__cover-wrap{padding-top:0;position:relative}
        .pp__cover-wrap::before{content:"";position:absolute;left:0;right:0;top:0;height:50%;background:var(--night)}
        .pp__cover{position:relative;border-radius:var(--radius-l);overflow:hidden;box-shadow:0 60px 120px -50px rgba(1,27,30,.8);background:#fff}
        .pp__article{padding-top:clamp(50px,6vw,90px)}
        .pp__cta{max-width:860px;margin:70px auto 0;padding:clamp(28px,4vw,50px);border-radius:var(--radius-l);background:#fff}
        .pp__cta-row{display:flex;flex-wrap:wrap;gap:12px}
        .pp__more-head{display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap;margin-bottom:40px}
        .pp__more{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
        @media(max-width:1000px){.pp__more{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.pp__more{grid-template-columns:minmax(0,1fr)}}
      `}</style>
    </>
  );
}
