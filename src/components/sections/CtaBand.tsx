import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Reveal, SplitText } from "@/components/ui/motion";

/** "Mehr Umsatz für Ihr Unternehmen" band used at the end of every service page (as on madex-it.ch). */
export function CtaBand({ title = "Mehr Umsatz für Ihr Unternehmen", text, href = "/kontakt", cta = "Vorschlag einholen" }: { title?: string; text?: string; href?: string; cta?: string }) {
  return (
    <section className="cta">
      <div className="container">
        <div className="cta__box grain">
          <div className="cta__glow" />
          <div className="cta__copy">
            <p className="eyebrow">Madex IT Solutions</p>
            <SplitText as="h2" text={title} className="h2" />
            {text && <p className="lead muted">{text}</p>}
            <Reveal delay={0.2}>
              <Button href={href} variant="light">
                {cta}
              </Button>
            </Reveal>
          </div>
          <div className="cta__phone">
            <Image src="/media/2023/06/g3-1.webp" alt="" width={400} height={756} />
          </div>
        </div>
      </div>
      <style>{`
        .cta{padding:clamp(60px,8vw,120px) 0;background:var(--mist)}
        .cta__box{position:relative;overflow:hidden;border-radius:var(--radius-l);padding:clamp(40px,6vw,90px);color:#fff;
          background:linear-gradient(125deg,var(--petrol) 0%,var(--teal) 100%);display:grid;grid-template-columns:1.4fr .6fr;gap:30px;align-items:center}
        .cta__box .eyebrow{color:#bff5ee}
        .cta__box .muted{color:rgba(255,255,255,.8)}
        .cta__glow{position:absolute;width:60%;aspect-ratio:1;right:-10%;top:-40%;border-radius:50%;background:radial-gradient(circle,rgba(79,224,210,.55),transparent 65%);filter:blur(10px);animation:ctaGlow 9s ease-in-out infinite alternate}
        @keyframes ctaGlow{to{transform:translate(-30%,30%) scale(1.2)}}
        .cta__copy{position:relative}
        .cta__phone{position:relative;justify-self:center;max-width:220px;margin-block:-30px -120px;animation:ctaFloat 6s ease-in-out infinite alternate}
        .cta__phone img{width:100%;height:auto;filter:drop-shadow(0 40px 50px rgba(0,0,0,.35))}
        @keyframes ctaFloat{to{transform:translateY(-18px) rotate(3deg)}}
        @media(max-width:800px){.cta__box{grid-template-columns:minmax(0,1fr)}.cta__phone{display:none}}
      `}</style>
    </section>
  );
}
