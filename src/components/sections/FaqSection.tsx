import Image from "next/image";
import { Accordion } from "@/components/ui/Accordion";
import { Parallax, SplitText } from "@/components/ui/motion";

export function FaqSection({ items, title = "Häufig gestellte Fragen", intro, id = "faq", decor = true }: { items: { q: string; a: string }[]; title?: string; intro?: string; id?: string; decor?: boolean }) {
  return (
    <section id={id} className="fq light section" aria-labelledby={`${id}-title`}>
      <div className="container fq__grid">
        <div className="fq__side">
          <p className="eyebrow">FAQ</p>
          <SplitText as="h2" text={title} className="h2" />
          {intro && <p className="muted">{intro}</p>}
          {decor && (
            <div className="fq__decor" aria-hidden="true">
              <Parallax speed={0.2} className="fq__bulb">
                <Image src="/media/brand/brand-lightbulb.webp" alt="" width={500} height={500} />
              </Parallax>
            </div>
          )}
        </div>
        <div>
          <Accordion items={items} />
        </div>
      </div>
      <style>{`
        .fq__grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:clamp(30px,6vw,100px);align-items:start}
        .fq__side{position:sticky;top:120px}
        .fq__decor{position:relative;height:300px;margin-top:40px}
        .fq__bulb{width:220px}
        .fq__bulb img{width:100%;height:auto;animation:bulb 5s ease-in-out infinite alternate;filter:drop-shadow(0 30px 40px rgba(2,81,89,.3))}
        @keyframes bulb{to{transform:rotate(10deg) translateY(-12px)}}
        @media(max-width:900px){.fq__grid{grid-template-columns:minmax(0,1fr)}.fq__side{position:static}.fq__decor{display:none}}
      `}</style>
    </section>
  );
}
