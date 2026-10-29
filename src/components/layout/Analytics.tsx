"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Link } from "./Transition";

type Config = { ga4Id: string; gtmId: string; metaPixelId?: string; adsId?: string; adsLeadLabel?: string; requireConsent: boolean };

/** Google Ads conversion target ("AW-123/abcDEF"), set once the tags are loaded. */
let adsLead = "";
const KEY = "madex-consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; push?: unknown; loaded?: boolean; version?: string };
    _fbq?: unknown;
  }
}

/** The choice also goes into a cookie, so the server only sends Meta conversions with consent. */
function rememberConsent(yes: boolean) {
  document.cookie = `${KEY}=${yes ? "yes" : "no"}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

/** Meta Pixel (standard snippet), then a page view. */
function injectMeta(id: string) {
  if (window.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue!.push(args);
  } as NonNullable<Window["fbq"]>;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  fbq("init", id);
  fbq("track", "PageView");
}

/**
 * Conversion for Meta (only if the pixel runs, i.e. after consent). `id` is the
 * enquiry reference – the server sends the same ID via the Conversions API.
 */
export function trackLead(id?: string, form?: string) {
  window.fbq?.("track", "Lead", form ? { content_name: form } : {}, id ? { eventID: id } : undefined);
  window.gtag?.("event", "generate_lead", form ? { form } : {});
  // Google Ads conversion; transaction_id keeps a reload from counting twice
  if (adsLead) window.gtag?.("event", "conversion", { send_to: adsLead, ...(id ? { transaction_id: id } : {}) });
}

/** `consented`: the visitor clicked «Zulassen» – then Google Ads may use its cookies too. */
function inject(c: Config, consented: boolean) {
  if (c.metaPixelId) injectMeta(c.metaPixelId);
  if (!c.ga4Id && !c.gtmId && !c.adsId) return;
  if (document.getElementById("mdx-analytics")) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  const ads = consented && c.adsId ? "granted" : "denied";
  window.gtag("consent", "default", { ad_storage: ads, ad_user_data: ads, ad_personalization: ads, analytics_storage: "granted" });
  const load = (id: string, src: string) => {
    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  };
  if (c.gtmId) {
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    load("mdx-analytics", `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(c.gtmId)}`);
  }
  // gtag.js for GA4 (without Tag Manager) and for the Google Ads tag (AW-…)
  const tagId = (!c.gtmId && c.ga4Id) || c.adsId;
  if (tagId) {
    load(c.gtmId ? "mdx-gtag" : "mdx-analytics", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`);
    window.gtag("js", new Date());
    if (!c.gtmId && c.ga4Id) window.gtag("config", c.ga4Id, { anonymize_ip: true });
    if (c.adsId) {
      window.gtag("config", c.adsId);
      if (c.adsLeadLabel) adsLead = `${c.adsId}/${c.adsLeadLabel}`;
    }
  }
}

/** Loads Google Analytics / Tag Manager – only after consent when the admin requires it. */
export function Analytics() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [ask, setAsk] = useState(false);
  const pathname = usePathname();
  const first = useRef(true);

  // client-side navigation: the pixel only counts the first page by itself
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  useEffect(() => {
    fetch("/api/site-config")
      .then((r) => r.json())
      .then((j: { analytics: Config }) => {
        const c = j.analytics;
        if (!c.ga4Id && !c.gtmId && !c.metaPixelId && !c.adsId) return;
        setCfg(c);
        let choice: string | null = null;
        try {
          choice = localStorage.getItem(KEY);
        } catch {}
        if (choice === "yes") rememberConsent(true);
        if (!c.requireConsent || choice === "yes") inject(c, choice === "yes");
        else if (choice !== "no") setAsk(true);
      })
      .catch(() => {});
  }, []);

  const decide = (yes: boolean) => {
    try {
      localStorage.setItem(KEY, yes ? "yes" : "no");
    } catch {}
    rememberConsent(yes);
    setAsk(false);
    if (yes && cfg) inject(cfg, true);
  };

  if (!ask) return null;
  return (
    <div className="consent" role="dialog" aria-label="Cookie-Einstellungen">
      <p>
        {cfg?.metaPixelId || cfg?.adsId
          ? `Wir möchten mit Google Analytics messen, wie unsere Website genutzt wird, und die Wirkung unserer Werbung auf ${[cfg.adsId && "Google", cfg.metaPixelId && "Facebook und Instagram"].filter(Boolean).join(", ")}. Sie entscheiden, ob Sie dem zustimmen.`
          : "Wir möchten mit Google Analytics anonym messen, wie unsere Website genutzt wird. Sie entscheiden, ob Sie dem zustimmen."}{" "}
        <Link href="/datenschutz">Mehr erfahren</Link>
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
