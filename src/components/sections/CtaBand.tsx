import Image from "next/image";
import { Button } from "@/components/ui/Button";

/** "Mehr Umsatz für Ihr Unternehmen" band used at the end of every service page (as on madex-it.ch). */
export function CtaBand({ title = "Mehr Umsatz für Ihr Unternehmen", text, href = "/kontakt", cta = "Vorschlag einholen" }: { title?: string; text?: string; href?: string; cta?: string }) {
  return (
    <section className="cta">
      <div className="container">
        <div className="cta__box">
          <div className="cta__copy">
            <h2 className="sec-title">{title}</h2>
            {text && <p className="lead">{text}</p>}
            <Button href={href} variant="light">
              {cta}
            </Button>
          </div>
          <div className="cta__phone">
            <Image src="/media/2023/06/g3-1.webp" alt="" width={400} height={756} />
          </div>
        </div>
      </div>
      <style>{`
        .cta{padding:clamp(60px,8vw,120px) 0;background:var(--paper)}
        .cta__box{position:relative;overflow:hidden;border-radius:20px;padding:clamp(36px,5vw,72px);color:#fff;
          background:var(--deep);display:grid;grid-template-columns:1.4fr .6fr;gap:30px;align-items:center}
        .cta__box .sec-title{color:#fff;max-width:18ch}
        .cta__box .lead{color:rgba(255,255,255,.8);margin-bottom:28px}
        .cta__copy{position:relative}
        .cta__phone{position:relative;justify-self:center;max-width:200px;margin-block:-20px -130px}
        .cta__phone img{width:100%;height:auto;filter:drop-shadow(0 30px 40px rgba(0,0,0,.3))}
        @media(max-width:800px){.cta__box{grid-template-columns:minmax(0,1fr)}.cta__phone{display:none}.cta__box .btn{white-space:normal;max-width:100%}}
      `}</style>
    </section>
  );
}
