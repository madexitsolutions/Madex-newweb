"use client";

import { useState } from "react";
import type { Check } from "@/lib/analysis";

/**
 * What the scan shows inside the browser and the phone: a neutral skeleton
 * until Google's screenshot of the real page arrives, then the screenshot.
 * Results of finished checks appear as markers on top.
 */
export function ScanPreview({ src, checks, compact = false }: { src?: string | null; checks: Check[]; compact?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const find = (id: string) => checks.find((c) => c.id === id);
  return (
    <div className={`wf${compact ? " wf--compact" : ""}`}>
      <Skeleton compact={compact} hidden={loaded} />
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={`az-shot${loaded ? " is-in" : ""}`} src={src} alt="" onLoad={() => setLoaded(true)} />
      )}
      {!compact && (
        <div className="wf__marks">
          <Marker check={find("title")} slot="a" />
          <Marker check={find("h1")} slot="b" />
          <Marker check={find("alt")} slot="c" />
          <Marker check={find("design-ai") ?? find("legal")} slot="d" />
        </div>
      )}
    </div>
  );
}

function Marker({ check, slot }: { check?: Check; slot: string }) {
  if (!check) return null;
  return (
    <span className={`wf-mark wf-mark--${slot} is-${check.status}`}>
      <span className="wf-mark__dot" />
      {check.label}
      {check.value ? `: ${check.value}` : ""}
    </span>
  );
}

function Skeleton({ compact, hidden }: { compact: boolean; hidden: boolean }) {
  return (
    <div className={`wf__skel${hidden ? " is-out" : ""}`}>
      <div className="wf__head">
        <span className="wf__logo" />
        {compact ? (
          <span className="wf__burger">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <span className="wf__nav">
            <span />
            <span />
            <span />
            <span />
          </span>
        )}
      </div>
      <div className="wf__hero">
        <span className="wf__line wf__line--xl" />
        <span className="wf__line wf__line--lg" />
        <span className="wf__line wf__line--short" />
        <span className="wf__cta" />
      </div>
      <div className="wf__body">
        {Array.from({ length: compact ? 2 : 4 }, (_, i) => (
          <div key={i} className="wf__block">
            <span className="wf__line wf__line--h" />
            <span className="wf__line" />
            <span className="wf__line wf__line--short" />
          </div>
        ))}
        <div className="wf__tiles">
          {Array.from({ length: compact ? 1 : 3 }, (_, i) => (
            <span key={i} className="wf__tile" />
          ))}
        </div>
      </div>
    </div>
  );
}
