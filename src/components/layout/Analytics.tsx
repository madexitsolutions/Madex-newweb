"use client";

import { useEffect, useState } from "react";
import { Link } from "./Transition";

type Config = { ga4Id: string; gtmId: string; requireConsent: boolean };
const KEY = "madex-consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function inject(c: Config) {
  if (document.getElementById("mdx-analytics")) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
  const s = document.createElement("script");
  s.id = "mdx-analytics";
  s.async = true;
  if (c.gtmId) {
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(c.gtmId)}`;
  } else {
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(c.ga4Id)}`;
    window.gtag("js", new Date());
    window.gtag("config", c.ga4Id, { anonymize_ip: true });
  }
  document.head.appendChild(s);
}

/** Loads Google Analytics / Tag Manager – only after consent when the admin requires it. */
export function Analytics() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    fetch("/api/site-config")
      .then((r) => r.json())
      .then((j: { analytics: Config }) => {
        const c = j.analytics;
        if (!c.ga4Id && !c.gtmId) return;
        setCfg(c);
        let choice: string | null = null;
        try {
          choice = localStorage.getItem(KEY);
        } catch {}
        if (!c.requireConsent || choice === "yes") inject(c);
        else if (choice !== "no") setAsk(true);
      })
      .catch(() => {});
  }, []);

  const decide = (yes: boolean) => {
    try {
      localStorage.setItem(KEY, yes ? "yes" : "no");
    } catch {}
    setAsk(false);
    if (yes && cfg) inject(cfg);
  };

  if (!ask) return null;
  return (
    <div className="consent" role="dialog" aria-label="Cookie-Einstellungen">
      <p>
        Wir möchten mit Google Analytics anonym messen, wie unsere Website genutzt wird. Sie entscheiden, ob Sie dem zustimmen. <Link href="/datenschutz">Mehr erfahren</Link>
      </p>
      <div className="consent__btns">
        <button className="consent__no" onClick={() => decide(false)}>
          Ablehnen
        </button>
        <button className="consent__yes" onClick={() => decide(true)}>
          Zulassen
        </button>
      </div>
      <style>{`
        .consent{position:fixed;left:20px;bottom:20px;z-index:690;max-width:420px;background:#fff;color:var(--ink);border:1px solid var(--line-soft);border-radius:14px;padding:18px 18px 16px;box-shadow:0 24px 60px -30px rgba(1,54,59,.55);font-size:14.5px;line-height:1.5}
        .consent p{margin:0 0 14px}
        .consent a{text-decoration:underline}
        .consent__btns{display:flex;gap:8px;justify-content:flex-end}
        .consent__btns button{padding:9px 16px;border-radius:9px;font-weight:600;font-size:14px}
        .consent__no{border:1px solid var(--line);color:var(--ink)}
        .consent__yes{background:var(--petrol);color:#fff}
        @media(max-width:640px){.consent{left:12px;right:84px;bottom:12px;max-width:none}}
      `}</style>
    </div>
  );
}
