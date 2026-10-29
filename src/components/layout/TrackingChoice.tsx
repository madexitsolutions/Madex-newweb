"use client";

import { useEffect, useState } from "react";
import { rememberConsent } from "./Analytics";

/**
 * Privacy policy: lets visitors object to (or allow) tracking for this browser.
 * Already loaded scripts only stop with a reload, so the page reloads after a change.
 */
export function TrackingChoice({ banner }: { banner: boolean }) {
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    try {
      setChoice(localStorage.getItem("madex-consent"));
    } catch {
      setChoice(null);
    }
  }, []);
  if (choice === undefined) return null;
  const on = banner ? choice === "yes" : choice !== "no";
  const change = (yes: boolean) => {
    rememberConsent(yes);
    location.reload();
  };
  return (
    <p className="tracking-choice">
      <span>{on ? "Tracking ist in diesem Browser aktiv." : "Tracking ist in diesem Browser deaktiviert."}</span>{" "}
      <button type="button" onClick={() => change(!on)}>
        {on ? "Tracking deaktivieren" : "Tracking erlauben"}
      </button>
      <style>{`.tracking-choice{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:#fff}.tracking-choice button{min-height:44px;padding:0 18px;border-radius:999px;background:var(--petrol);color:#fff;font-weight:600;font-size:14.5px}`}</style>
    </p>
  );
}
