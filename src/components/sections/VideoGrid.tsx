"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/motion";

/**
 * Privacy-friendly YouTube embeds: nothing is loaded from YouTube until the
 * visitor clicks play (then via youtube-nocookie.com).
 */
export function VideoGrid({ ids }: { ids: string[] }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="vg">
      {ids.map((id, i) => (
        <Reveal key={id} delay={(i % 3) * 0.08} className="vg__cell">
          {active === id ? (
            <iframe
              className="vg__frame"
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
              title={`Werbevideo ${i + 1} von Madex IT Solutions`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button className="vg__facade" onClick={() => setActive(id)} data-cursor="Play" aria-label={`Werbevideo ${i + 1} abspielen (lädt YouTube)`}>
              <span className="vg__n">{String(i + 1).padStart(2, "0")}</span>
              <span className="vg__play">
                <Icon name="play" size={28} />
              </span>
              <span className="vg__label">Werbevideo {i + 1}</span>
              <span className="vg__wave" aria-hidden="true">
                {Array.from({ length: 24 }).map((_, k) => (
                  <i key={k} style={{ animationDelay: `${(k * 37) % 900}ms` }} />
                ))}
              </span>
            </button>
          )}
        </Reveal>
      ))}
      <p className="vg__note">Beim Abspielen wird das Video von YouTube (youtube-nocookie.com) geladen.</p>
      <style>{`
        .vg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        .vg__cell{aspect-ratio:16/9;border-radius:var(--radius-m);overflow:hidden;position:relative}
        .vg__frame{width:100%;height:100%;border:0}
        .vg__facade{position:relative;width:100%;height:100%;display:grid;place-items:center;color:#fff;overflow:hidden;
          background:radial-gradient(80% 90% at 30% 20%,rgba(79,224,210,.35),transparent 60%),linear-gradient(135deg,var(--petrol),var(--night))}
        .vg__facade::after{content:"";position:absolute;inset:0;background:url(/media/brand/business-favicon.webp) center/38% no-repeat;opacity:.06;transition:transform 1s var(--ease-out)}
        .vg__facade:hover::after{transform:scale(1.2) rotate(-6deg)}
        .vg__n{position:absolute;left:20px;top:16px;font:800 34px/1 var(--font-display);color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.4)}
        .vg__play{position:relative;z-index:1;width:76px;height:76px;border-radius:50%;background:#fff;color:var(--petrol);display:grid;place-items:center;transition:transform .5s var(--ease-out)}
        .vg__facade:hover .vg__play{transform:scale(1.15)}
        .vg__label{position:absolute;left:20px;bottom:16px;font-weight:500}
        .vg__wave{position:absolute;right:18px;bottom:18px;display:flex;gap:3px;align-items:flex-end;height:24px}
        .vg__wave i{width:3px;height:100%;background:var(--teal-glow);border-radius:2px;animation:wave .9s ease-in-out infinite alternate;transform-origin:bottom}
        @keyframes wave{from{transform:scaleY(.2)}to{transform:scaleY(1)}}
        .vg__note{grid-column:1/-1;font-size:13px;color:var(--text-soft);margin:6px 0 0}
        @media(max-width:1000px){.vg{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.vg{grid-template-columns:minmax(0,1fr)}}
      `}</style>
    </div>
  );
}
