"use client";

import { useState } from "react";
import type { Check, PagePreview } from "@/lib/analysis";

/**
 * A drawn version of the scanned page from its real content (title, menu, H1,
 * headings, share image, brand colour). Results of finished checks appear as
 * markers on the element they belong to.
 */
export function Wireframe({ page, checks, compact = false }: { page?: PagePreview; checks: Check[]; compact?: boolean }) {
  const [imgOk, setImgOk] = useState(true);
  const [iconOk, setIconOk] = useState(true);
  const find = (id: string) => checks.find((c) => c.id === id);
  if (!page) return <Skeleton compact={compact} />;
  const accent = page.themeColor || "var(--teal)";
  const tiles = Math.min(compact ? 2 : 3, Math.max(2, Math.ceil(page.images / 4)));
  const headings = page.headings.slice(0, compact ? 2 : 4);
  return (
    <div className={`wf${compact ? " wf--compact" : ""}`} style={{ ["--wf-accent" as string]: accent }}>
      <div className="wf__head">
        <span className="wf__logo">
          {page.favicon && iconOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.favicon} alt="" width={16} height={16} onError={() => setIconOk(false)} referrerPolicy="no-referrer" />
          ) : (
            <i />
          )}
        </span>
        {compact ? (
          <span className="wf__burger">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <span className="wf__nav">
            {(page.nav.length ? page.nav : ["", "", "", ""]).slice(0, 5).map((n, i) => (
              <span key={i}>{n}</span>
            ))}
          </span>
        )}
        <Marker check={find("viewport") ?? find("title")} compact={compact} />
      </div>
      <div className="wf__hero">
        {page.ogImage && imgOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="wf__hero-img" src={page.ogImage} alt="" onError={() => setImgOk(false)} referrerPolicy="no-referrer" />
        )}
        <div className="wf__hero-copy">
          <p className="wf__h1">{page.h1 || page.title || "Ohne Hauptüberschrift"}</p>
          {page.description && !compact && <p className="wf__desc">{page.description}</p>}
          <span className="wf__cta" />
        </div>
        <Marker check={find("h1")} compact={compact} />
      </div>
      <div className="wf__body">
        {headings.map((h, i) => (
          <div key={i} className="wf__block">
            <p className="wf__h2">{h}</p>
            <span className="wf__line" />
            <span className="wf__line wf__line--short" />
          </div>
        ))}
        <div className="wf__tiles">
          {Array.from({ length: tiles }, (_, i) => (
            <span key={i} className="wf__tile" />
          ))}
          <Marker check={find("alt")} compact={compact} />
        </div>
      </div>
      <div className="wf__foot">
        <Marker check={find("legal") ?? find("contact")} compact={compact} />
      </div>
    </div>
  );
}

function Marker({ check, compact }: { check?: Check; compact: boolean }) {
  if (!check || compact) return null;
  return (
    <span className={`wf-mark is-${check.status}`}>
      <span className="wf-mark__dot" />
      {check.label}
      {check.value ? `: ${check.value}` : ""}
    </span>
  );
}

function Skeleton({ compact }: { compact: boolean }) {
  return (
    <div className={`wf wf--skeleton${compact ? " wf--compact" : ""}`}>
      <div className="wf__head">
        <span className="wf__logo">
          <i />
        </span>
        <span className="wf__nav">
          <span />
          <span />
          <span />
        </span>
      </div>
      <div className="wf__hero">
        <div className="wf__hero-copy">
          <span className="wf__line" />
          <span className="wf__line wf__line--short" />
        </div>
      </div>
      <div className="wf__body">
        <span className="wf__line" />
        <span className="wf__line" />
        <span className="wf__line wf__line--short" />
      </div>
    </div>
  );
}
