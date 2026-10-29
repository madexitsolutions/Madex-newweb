"use client";

/**
 * The free website analysis: address + e-mail → POST /api/analyse → live scan
 * on /analyse/<id>. Used in the home hero and on /kostenlose-prufung (dark backgrounds).
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { trackLead } from "@/components/layout/Analytics";
import { useTransition } from "@/components/layout/Transition";
import "./scan-form.css";

const DEFAULT_HINT = "Kostenlos und sofort: SEO-, Mobile- und Google-Check Ihrer Website mit drei konkreten Verbesserungsvorschlägen.";

const I = {
  globe: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm18 3-10 6L2 7",
  arrow: "M5 12h14M13 5l7 7-7 7",
};
function Svg({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function ScanForm({ hint = DEFAULT_HINT }: { hint?: string }) {
  const { navigate } = useTransition();
  // when the form became usable – the server rejects sends faster than a person can type
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: f.get("website"), email: f.get("email"), hp: f.get("hp_check"), startedAt: startedAt.current }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; message?: string; url?: string; ref?: string };
      if (json.ok) trackLead(json.ref, "Kostenlose Analyse");
      if (json.ok && json.url) {
        setMsg("Die Analyse startet …");
        navigate(json.url);
        return;
      }
      if (!json.ok) {
        setState("error");
        setMsg(json.error || "Die Anfrage konnte nicht gesendet werden. Rufen Sie uns an: 052 589 67 59");
        return;
      }
      setState("done");
      setMsg(json.message || "Danke! Wir melden uns innerhalb von 24 Stunden.");
      e.currentTarget?.reset();
    } catch {
      setState("error");
      setMsg("Senden fehlgeschlagen. Rufen Sie uns an: 052 589 67 59");
    }
  };
  return (
    <div className="scan">
      <form className="hx__form" onSubmit={submit}>
        <label className="hx__field">
          <Svg d={I.globe} />
          <span className="sr-only">Ihre Website, z. B. firma.ch</span>
          <input name="website" type="text" inputMode="url" autoComplete="url" placeholder="Ihre Website, z. B. firma.ch" maxLength={200} />
        </label>
        <span className="hx__sep" aria-hidden="true" />
        <label className="hx__field">
          <Svg d={I.mail} />
          <span className="sr-only">Ihre E-Mail</span>
          <input name="email" type="email" autoComplete="email" required placeholder="Ihre E-Mail" maxLength={200} />
        </label>
        <input name="hp_check" tabIndex={-1} autoComplete="off" className="hx__hp" aria-hidden="true" />
        <button type="submit" className="hx__submit" disabled={state === "sending"}>
          {state === "sending" ? "Analyse startet …" : "Gratis-Analyse"}
          <Svg d={I.arrow} />
        </button>
      </form>
      <p className={`hx__msg${state === "error" ? " is-err" : state === "done" ? " is-ok" : ""}`} role="status">
        {msg || hint}
      </p>
    </div>
  );
}
