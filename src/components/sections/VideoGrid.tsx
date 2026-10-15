"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/motion";

/** Thumbnail sizes YouTube offers, best first; we step down when one is missing. */
const THUMBS = ["maxresdefault", "hqdefault"] as const;

function Facade({ id, n, title, onPlay }: { id: string; n: number; title: string; onPlay: () => void }) {
  const [step, setStep] = useState(0);
  const failed = step >= THUMBS.length;
  return (
    <button className={`vg__facade${failed ? " is-fallback" : ""}`} onClick={onPlay} data-cursor="Play" aria-label={`${title} abspielen (lädt YouTube)`}>
      {!failed && (
        <Image
          key={THUMBS[step]}
          src={`https://i.ytimg.com/vi/${id}/${THUMBS[step]}.jpg`}
          alt=""
          fill
          sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
          className="vg__thumb"
          onError={() => setStep((s) => s + 1)}
          // YouTube serves a 120×90 grey placeholder instead of a 404 when a size is missing
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth <= 120) setStep((s) => s + 1);
          }}
        />
      )}
      <span className="vg__shade" aria-hidden="true" />
      <span className="vg__n" aria-hidden="true">
        {String(n).padStart(2, "0")}
      </span>
      <span className="vg__play" aria-hidden="true">
        <Icon name="play" size={26} />
      </span>
      <span className="vg__label">{title}</span>
      <span className="vg__wave" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, k) => (
          <i key={k} style={{ animationDelay: `${(k * 37) % 900}ms` }} />
        ))}
      </span>
    </button>
  );
}

/**
 * Privacy-friendly YouTube embeds: the preview thumbnail is proxied through the
 * Next image optimiser, and nothing is loaded from YouTube itself until the
 * visitor clicks play (then via youtube-nocookie.com).
 */
export function VideoGrid({ ids, titles = {} }: { ids: string[]; titles?: Record<string, string> }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="vg">
      {ids.map((id, i) => {
        const title = titles[id] || `Werbevideo ${i + 1}`;
        return (
          <Reveal key={id} delay={(i % 3) * 0.08} className="vg__cell">
            {active === id ? (
              <iframe
                className="vg__frame"
                src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
                title={`${title} – Madex IT Solutions`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <Facade id={id} n={i + 1} title={title} onPlay={() => setActive(id)} />
            )}
          </Reveal>
        );
      })}
      <p className="vg__note">Beim Abspielen wird das Video von YouTube (youtube-nocookie.com) geladen.</p>
      <style>{`
        .vg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        .vg__cell{aspect-ratio:16/9;border-radius:var(--radius-m);overflow:hidden;position:relative;background:var(--night);box-shadow:0 24px 40px -30px rgba(1,41,45,.55)}
        .vg__frame{width:100%;height:100%;border:0}
        .vg__facade{position:relative;width:100%;height:100%;display:grid;place-items:center;color:#fff;overflow:hidden;isolation:isolate;
          background:radial-gradient(80% 90% at 30% 20%,rgba(79,224,210,.35),transparent 60%),linear-gradient(135deg,var(--petrol),var(--night))}
        .vg__facade.is-fallback::after{content:"";position:absolute;inset:0;z-index:-1;background:url(/media/brand/business-favicon.webp) center/38% no-repeat;opacity:.06;transition:transform 1s var(--ease-out)}
        .vg__facade.is-fallback:hover::after{transform:scale(1.2) rotate(-6deg)}
        .vg__thumb{object-fit:cover;z-index:-2;transform:scale(1.02);transition:transform 1.1s var(--ease-out),filter .6s}
        .vg__facade:hover .vg__thumb,.vg__facade:focus-visible .vg__thumb{transform:scale(1.09);filter:saturate(1.1)}
        .vg__shade{position:absolute;inset:0;z-index:-1;pointer-events:none;
          background:linear-gradient(180deg,rgba(1,41,45,.45) 0%,rgba(1,41,45,0) 34%,rgba(1,41,45,0) 52%,rgba(1,41,45,.85) 100%);transition:background-color .5s}
        .vg__facade:hover .vg__shade{background-color:rgba(1,41,45,.18)}
        .vg__facade:focus-visible{outline:3px solid var(--teal-glow);outline-offset:-3px}
        .vg__n{position:absolute;left:18px;top:14px;font:700 15px/1 var(--font-display);font-variant-numeric:tabular-nums;letter-spacing:.06em;color:#fff;
          padding:7px 10px;border-radius:999px;background:rgba(1,41,45,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
        .vg__play{position:relative;width:68px;height:68px;border-radius:50%;background:#fff;color:var(--petrol);display:grid;place-items:center;
          box-shadow:0 14px 30px -10px rgba(0,15,17,.6);transition:transform .5s var(--ease-out),background .3s,color .3s}
        .vg__play svg{margin-left:3px}
        .vg__facade:hover .vg__play,.vg__facade:focus-visible .vg__play{transform:scale(1.14);background:var(--teal-glow);color:var(--ink)}
        .vg__label{position:absolute;left:18px;right:84px;bottom:14px;text-align:left;font-weight:600;font-size:15px;line-height:1.3;
          text-shadow:0 1px 8px rgba(0,15,17,.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .vg__wave{position:absolute;right:18px;bottom:16px;display:flex;gap:3px;align-items:flex-end;height:20px}
        .vg__wave i{width:3px;height:100%;background:var(--teal-glow);border-radius:2px;animation:wave .9s ease-in-out infinite alternate;transform-origin:bottom}
        @keyframes wave{from{transform:scaleY(.2)}to{transform:scaleY(1)}}
        .vg__note{grid-column:1/-1;font-size:13px;color:var(--text-soft);margin:6px 0 0}
        @media(max-width:1000px){.vg{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.vg{grid-template-columns:minmax(0,1fr)}}
        @media(prefers-reduced-motion:reduce){.vg__wave i{animation:none;transform:scaleY(.6)}.vg__thumb{transition:none}}
      `}</style>
    </div>
  );
}
