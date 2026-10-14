import Image from "next/image";
import { Tilt } from "@/components/ui/motion";

export function TeamCard({ name, role, image, priority }: { name?: string; role: string; image: string; priority?: boolean }) {
  return (
    <Tilt max={8} className="tc">
      <figure className="tc__fig">
        <div className="tc__img">
          <Image src={image} alt={name ? `${name}, ${role}` : role} fill sizes="(max-width: 700px) 50vw, 25vw" priority={priority} />
        </div>
        <figcaption className="tc__cap">
          {name && <strong>{name}</strong>}
          <span>{role}</span>
        </figcaption>
      </figure>
      <style>{`
        .tc__fig{margin:0;position:relative;border-radius:var(--radius-m);overflow:hidden;background:var(--ink)}
        .tc__img{position:relative;aspect-ratio:4/5}
        .tc__img img{object-fit:cover;filter:grayscale(1) contrast(1.05);transition:filter .7s,transform 1s var(--ease-out)}
        .tc:hover .tc__img img{filter:grayscale(0);transform:scale(1.06)}
        .tc__cap{position:absolute;left:12px;right:12px;bottom:12px;padding:14px 16px;border-radius:16px;background:rgba(1,27,30,.72);backdrop-filter:blur(10px);color:#fff;display:grid;gap:2px;
          transform:translateY(8px);transition:transform .6s var(--ease-out),background .5s}
        .tc:hover .tc__cap{transform:none;background:rgba(2,141,134,.85)}
        .tc__cap strong{font:700 18px/1.2 var(--font-display)}
        .tc__cap span{font-size:13.5px;opacity:.85;text-transform:uppercase;letter-spacing:.06em}
      `}</style>
    </Tilt>
  );
}
