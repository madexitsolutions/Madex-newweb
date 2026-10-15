"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Link } from "./Transition";

const HIDDEN_ON = ["/kostenlose-prufung", "/kontakt"];

/**
 * Phones only: once the visitor has scrolled past the first screen, the main
 * action stays in thumb reach next to the chat launcher. It steps aside over
 * the footer, which carries the same action.
 */
export function MobileCta() {
  const pathname = usePathname();
  const [past, setPast] = useState(false);
  const [footer, setFooter] = useState(false);

  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const el = document.querySelector("footer");
    const io = el ? new IntersectionObserver(([e]) => setFooter(e.isIntersecting)) : null;
    if (el && io) io.observe(el);
    return () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, [pathname]);

  if (HIDDEN_ON.includes(pathname)) return null;
  const shown = past && !footer;

  return (
    <div className={`mcta${shown ? " is-on" : ""}`} aria-hidden={!shown}>
      <Link href="/kostenlose-prufung" className="mcta__btn" tabIndex={shown ? 0 : -1}>
        Gratis-Analyse anfordern
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M5 12h14M13 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <style>{`
        .mcta{display:none}
        @media(max-width:700px){
          .mcta{display:block;position:fixed;z-index:680;left:max(16px,env(safe-area-inset-left));right:calc(max(16px,env(safe-area-inset-right)) + 72px);bottom:calc(max(16px,env(safe-area-inset-bottom)) + 6px);
            transform:translateY(140%);opacity:0;transition:transform .45s cubic-bezier(.16,1,.3,1),opacity .3s;pointer-events:none}
          .mcta.is-on{transform:none;opacity:1;pointer-events:auto}
          .mcta__btn{display:flex;align-items:center;justify-content:center;gap:10px;height:48px;border-radius:999px;font-weight:600;font-size:15.5px;color:#03262a;
            background:linear-gradient(120deg,#6ff3e1,#19b3a9);box-shadow:0 14px 34px -12px rgba(1,27,30,.55),inset 0 1px 0 rgba(255,255,255,.45)}
        }
        @media(prefers-reduced-motion:reduce){.mcta{transition:none}}
      `}</style>
    </div>
  );
}
