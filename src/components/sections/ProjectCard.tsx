import Image from "next/image";
import { Link } from "@/components/layout/Transition";
import { formatDate, type Post } from "@/content/posts";
import { media } from "@/lib/media";
import { Icon } from "@/components/ui/Icon";

export function ProjectCard({ post, priority = false, size = "md" }: { post: Post; priority?: boolean; size?: "md" | "lg" }) {
  return (
    <Link href={`/${post.slug}`} className={`pc pc--${size}`} data-cursor="Ansehen">
      <div className="pc__media">
        <Image src={media(post.cover)} alt={`Website-Projekt ${post.client}`} fill sizes="(max-width: 700px) 100vw, (max-width: 1200px) 50vw, 33vw" priority={priority} className="pc__img" />
        <span className="pc__badge">
          <Icon name="arrow-up-right" size={18} />
        </span>
      </div>
      <div className="pc__meta">
        <span className="pc__date">{formatDate(post.date)}</span>
        <h3 className="pc__client">{post.client}</h3>
        <p className="pc__title">{post.title}</p>
      </div>
      <style>{`
        .pc{display:flex;flex-direction:column;gap:16px}
        .pc__media{position:relative;aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:var(--mint);border:1px solid var(--line-soft);transform:translateZ(0)}
        .pc__img{object-fit:cover;transition:transform .8s var(--ease-out)}
        .pc:hover .pc__img{transform:scale(1.03)}
        .pc__badge{position:absolute;right:14px;top:14px;width:40px;height:40px;border-radius:10px;background:#fff;color:var(--petrol);display:grid;place-items:center;opacity:0;transition:opacity .25s}
        .pc:hover .pc__badge,.pc:focus-visible .pc__badge{opacity:1}
        .pc__date{font-size:13.5px;color:var(--ink-soft)}
        .pc__client{font-size:clamp(20px,1.6vw,24px);margin:4px 0 4px;color:var(--deep)}
        .dark .pc__client,.dark-ink .pc__client{color:#fff}
        .pc__title{margin:0;font-size:15px;color:var(--text-soft);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .dark .pc__title,.dark-ink .pc__title{color:var(--on-dark-soft)}
        .dark .pc__date,.dark-ink .pc__date{color:var(--on-dark-soft)}
      `}</style>
    </Link>
  );
}
