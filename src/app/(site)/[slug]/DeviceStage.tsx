import Image from "next/image";

/**
 * Laptop, tablet and phone showing the same project screenshot – pure HTML/CSS
 * 3D (no WebGL), so it is crisp, responsive and visible on first paint.
 * Every screen crops the screenshot like `background-size: cover`, anchored to
 * the top so the header/hero of the website is always what you see.
 */
export function DeviceStage({ image, alt }: { image: string; alt: string }) {
  return (
    <div className="dv" aria-hidden="true">
      <div className="dv__scene">
        {/* laptop */}
        <div className="dv__pos dv__pos--lap">
          <div className="dv__float">
            <div className="dv__lap">
              <div className="dv__lid">
                <span className="dv__cam" />
                <div className="dv__screen">
                  <Image src={image} alt={alt} fill sizes="(max-width: 900px) 70vw, 560px" loading="eager" fetchPriority="high" className="dv__img dv__img--lap" />
                </div>
              </div>
              <div className="dv__deck">
                <div className="dv__keys" />
                <div className="dv__pad" />
                <div className="dv__lip" />
              </div>
            </div>
          </div>
        </div>
            {/* tablet */}
            <div className="dv__pos dv__pos--tab">
              <div className="dv__float" style={{ animationDelay: "-2.2s" }}>
                <div className="dv__tab">
                  <span className="dv__cam" />
                  <div className="dv__screen">
                    <Image src={image} alt="" fill sizes="(max-width: 900px) 30vw, 240px" loading="eager" className="dv__img dv__img--tab" />
                  </div>
                </div>
                <div className="dv__floor" />
              </div>
            </div>
            {/* phone */}
            <div className="dv__pos dv__pos--ph">
              <div className="dv__float" style={{ animationDelay: "-4.1s" }}>
                <div className="dv__ph">
                  <div className="dv__screen">
                    <Image src={image} alt="" fill sizes="(max-width: 900px) 20vw, 140px" loading="eager" className="dv__img dv__img--ph" />
                    <span className="dv__island" />
                  </div>
                </div>
                <div className="dv__floor" />
              </div>
            </div>
      </div>
      <style>{`
        .dv{position:relative;container-type:inline-size;aspect-ratio:1.3;perspective:2400px;perspective-origin:50% 20%;animation:dvIn 1.2s var(--ease-out) .2s both}
        @keyframes dvIn{from{opacity:0;transform:translateY(40px) scale(.96)}to{opacity:1;transform:none}}
        .dv__scene{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateX(17deg) rotateY(-20deg)}
        .dv__pos,.dv__float{position:absolute;transform-style:preserve-3d}
        .dv__float{inset:0;animation:dvFloat 7s ease-in-out infinite alternate}
        @keyframes dvFloat{from{transform:translateY(-.5cqw)}to{transform:translateY(.7cqw)}}

        /* shared screen */
        .dv__screen{position:relative;width:100%;height:100%;overflow:hidden;background:#0d2a2e}
        .dv__screen::after{content:"";position:absolute;inset:0;pointer-events:none;
          background:linear-gradient(118deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,.04) 34%,transparent 35%,transparent 100%)}
        .dv__img{object-fit:cover}
        .dv__img--lap{object-position:50% 0}
        .dv__img--tab,.dv__img--ph{object-position:0 0}
        .dv__cam{position:absolute;left:50%;width:.55cqw;height:.55cqw;margin-left:-.275cqw;border-radius:50%;background:#1d2a2c;box-shadow:inset 0 0 0 .12cqw #2f4246;z-index:1}

        /* laptop: lid + keyboard deck laid flat towards the viewer */
        .dv__pos--lap{left:25%;top:4%;width:58%}
        .dv__lap{position:relative;transform-style:preserve-3d}
        .dv__lid{position:relative;transform-style:preserve-3d;transform-origin:50% 100%;transform:rotateX(-15deg);aspect-ratio:16/10.6;padding:1.6cqw 1.5cqw 2.2cqw;border-radius:2.2cqw 2.2cqw .6cqw .6cqw;
          background:linear-gradient(#0a0f10,#0a0f10) padding-box,linear-gradient(160deg,#e8eded,#9aa5a7 60%,#cfd6d7) border-box;border:.32cqw solid transparent;
          box-shadow:0 2.4cqw 5cqw -2cqw rgba(0,10,12,.55)}
        .dv__lid::before{content:"";position:absolute;inset:-.32cqw;border-radius:inherit;transform:translateZ(-.7cqw);background:#7f8a8c}
        .dv__lid .dv__cam{top:.55cqw}
        .dv__lid .dv__screen{border-radius:.5cqw}
        .dv__deck{position:absolute;top:calc(100% - .3cqw);left:-5%;width:110%;height:38cqw;transform-origin:50% 0;transform:rotateX(90deg);transform-style:preserve-3d;
          border-radius:.6cqw .6cqw 2.4cqw 2.4cqw;background:linear-gradient(180deg,#a9b3b5 0%,#dfe5e6 6%,#d2d9da 60%,#c5cdce 100%);
          box-shadow:0 0 7cqw 1cqw rgba(0,10,12,.55)}
        .dv__keys{position:absolute;left:12%;right:12%;top:7%;height:46%;border-radius:.8cqw;background-color:#1c2526;
          background-image:linear-gradient(90deg,#1c2526 .22cqw,transparent .22cqw),linear-gradient(#1c2526 .22cqw,transparent .22cqw),linear-gradient(#3b4749,#2e3a3c);
          background-size:calc(100% / 14) 100%,100% calc(100% / 6),100% 100%;padding:.3cqw;box-shadow:inset 0 0 0 .3cqw #1c2526}
        .dv__pad{position:absolute;left:33%;right:33%;top:58%;bottom:7%;border-radius:1cqw;background:linear-gradient(180deg,#cbd2d3,#d9dfe0);box-shadow:inset 0 0 0 .14cqw rgba(0,0,0,.08)}
        .dv__lip{position:absolute;left:1.2cqw;right:1.2cqw;top:100%;height:1.1cqw;transform-origin:50% 0;transform:rotateX(-90deg);
          border-radius:0 0 1cqw 1cqw;background:linear-gradient(90deg,#8d989a,#c6cecf 50%,#8d989a)}

        /* tablet */
        .dv__pos--tab{left:7%;top:36%;width:24%;transform:translateZ(44cqw)}
        .dv__tab{position:relative;transform-style:preserve-3d;aspect-ratio:3/4.1;padding:1.5cqw;border-radius:2.4cqw;
          background:linear-gradient(#0a0f10,#0a0f10) padding-box,linear-gradient(150deg,#eef2f2,#a3adaf 55%,#d6dcdd) border-box;border:.3cqw solid transparent;
          box-shadow:0 3cqw 5cqw -2.4cqw rgba(0,10,12,.7)}
        .dv__tab::before{content:"";position:absolute;inset:-.3cqw;border-radius:inherit;transform:translateZ(-.8cqw);background:#7f8a8c}
        .dv__tab .dv__cam{top:.5cqw}
        .dv__tab .dv__screen{border-radius:1cqw}

        /* phone */
        .dv__pos--ph{right:-1%;top:50%;width:12.5%;transform:translateZ(48cqw)}
        .dv__ph{position:relative;transform-style:preserve-3d;aspect-ratio:9/19.3;padding:.75cqw;border-radius:3cqw;
          background:linear-gradient(#050809,#050809) padding-box,linear-gradient(150deg,#56656a,#1d2729 50%,#46555a) border-box;border:.32cqw solid transparent;
          box-shadow:0 3cqw 4cqw -2cqw rgba(0,10,12,.75)}
        .dv__ph::before{content:"";position:absolute;inset:-.32cqw;border-radius:inherit;transform:translateZ(-.9cqw);background:#2b3638}
        .dv__ph .dv__screen{border-radius:2.3cqw}
        .dv__island{position:absolute;top:.8cqw;left:50%;width:32%;height:1.5cqw;transform:translateX(-50%);border-radius:1cqw;background:#050809;z-index:1}

        /* soft contact shadow on the floor for upright devices */
        .dv__floor{position:absolute;left:8%;right:8%;top:calc(100% - 1cqw);height:8cqw;transform-origin:50% 0;transform:rotateX(90deg);
          background:radial-gradient(50% 50% at 50% 20%,rgba(0,10,12,.55),transparent 70%)}

        @media(prefers-reduced-motion:reduce){.dv,.dv__float{animation:none}}
      `}</style>
    </div>
  );
}
