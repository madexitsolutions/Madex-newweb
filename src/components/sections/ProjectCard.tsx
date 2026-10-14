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
        .pc{display:flex;flex-direction:column;gap:18px;group:card}
        .pc__media{position:relative;aspect-ratio:4/3;border-radius:var(--radius-m);overflow:hidden;background:linear-gradient(135deg,var(--petrol),var(--night));
          transform:translateZ(0);transition:border-radius .6s var(--ease-out)}
        .pc__img{object-fit:cover;transition:transform 1.1s var(--ease-out),filter .6s}
        .pc:hover .pc__img{transform:scale(1.07)}
        .pc:hover .pc__media{border-radius:calc(var(--radius-m) * 2)}
        .pc__badge{position:absolute;right:16px;top:16px;width:46px;height:46px;border-radius:50%;background:#fff;color:var(--petrol);display:grid;place-items:center;
          transform:scale(0) rotate(-90deg);transition:transform .6s var(--ease-out)}
        .pc:hover .pc__badge{transform:scale(1) rotate(0)}
        .pc__date{font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--teal)}
        .pc__client{font-size:clamp(22px,2vw,28px);margin:6px 0 4px}
        .pc__title{margin:0;font-size:15px;color:var(--text-soft);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .dark .pc__title,.dark-ink .pc__title{color:var(--on-dark-soft)}
        .dark .pc__date,.dark-ink .pc__date{color:var(--teal-glow)}
      `}</style>
    </Link>
  );
}
