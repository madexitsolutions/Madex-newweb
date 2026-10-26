"use client";

import { useEffect, useState } from "react";
import { Link } from "@/components/layout/Transition";
import { STEPS, type ReportView, type StepState } from "@/lib/analysis";
import { Report } from "./Report";
import { ScanPreview } from "./Wireframe";
import "./analyse.css";

/** Each step stays visible at least this long, so a fast scan still reads as one. */
const STEP_MS = 1300;
const LOG_MS = 110;
const POLL_MS = 1000;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AnalysisView({ initial, token }: { initial: ReportView; token: string }) {
  const [report, setReport] = useState(initial);
  // the scan always plays right after the form; a report opened again later skips it
  const [phase, setPhase] = useState<"scan" | "report">(() => (initial.status === "done" && Date.now() - Date.parse(initial.createdAt) > 3 * 60_000 ? "report" : "scan"));
  const [shown, setShown] = useState(0);
  const [logShown, setLogShown] = useState(0);
  const [offline, setOffline] = useState(false);

  // poll while the server is working
  useEffect(() => {
    if (report.status !== "running") return;
    let stop = false;
    let misses = 0;
    let timer = 0;
    const tick = async () => {
      try {
        const res = await fetch(`/api/analyse/${report.id}?t=${encodeURIComponent(token)}`, { cache: "no-store" });
        const json = (await res.json()) as { ok: boolean; report?: ReportView };
        if (stop) return;
        if (json.ok && json.report) {
          misses = 0;
          setOffline(false);
          setReport(json.report);
          if (json.report.status !== "running") return;
        } else misses++;
      } catch {
        misses++;
      }
      if (stop) return;
      if (misses > 4) setOffline(true);
      timer = window.setTimeout(tick, misses ? POLL_MS * 2 : POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [report.status, report.id, token]);

  const serverDone = STEPS.findIndex((s) => report.steps[s.key] === "wait" || report.steps[s.key] === "run");
  const target = serverDone === -1 ? STEPS.length : serverDone;

  // log lines belong to a step: only those up to the step on screen are shown
  const nextStart = shown + 1 < STEPS.length ? report.log.indexOf(`${STEPS[shown + 1].running} …`) : -1;
  const logLimit = nextStart === -1 ? report.log.length : nextStart;

  // reveal steps one by one, never faster than STEP_MS and not before their log is out
  useEffect(() => {
    if (phase !== "scan" || shown >= target || logShown < logLimit) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), reduced() ? 250 : STEP_MS);
    return () => window.clearTimeout(id);
  }, [phase, shown, target, logShown, logLimit]);

  // log lines trickle in
  useEffect(() => {
    if (phase !== "scan" || logShown >= logLimit) return;
    const id = window.setTimeout(() => setLogShown((n) => n + 1), reduced() ? 20 : LOG_MS);
    return () => window.clearTimeout(id);
  }, [phase, logShown, logLimit]);

  const complete = report.status === "done" && shown >= STEPS.length && logShown >= report.log.length;
  useEffect(() => {
    if (!complete || phase !== "scan") return;
    const id = window.setTimeout(() => {
      setPhase("report");
      window.scrollTo({ top: 0 });
    }, reduced() ? 200 : 1600);
    return () => window.clearTimeout(id);
  }, [complete, phase]);

  if (phase === "report") return <Report report={report} token={token} onUpdate={setReport} />;
  return <Scan report={report} shown={shown} logShown={logShown} complete={complete} token={token} offline={offline} />;
}

/* ------------------------------------------------------------------ scan */

function Scan({ report, shown, logShown, complete, token, offline }: { report: ReportView; shown: number; logShown: number; complete: boolean; token: string; offline: boolean }) {
  const failed = report.status === "failed";
  const state = (i: number): StepState => {
    const server = report.steps[STEPS[i].key];
    if (i < shown) return server === "skip" ? "skip" : "done";
    if (failed) return server === "done" ? "done" : "skip";
    return i === shown ? "run" : "wait";
  };
  const visibleChecks = report.checks.filter((c) => {
    const step = STEPS.findIndex((s) => s.key === (c.category === "content" ? "speed" : c.id.startsWith("lh-") ? "speed" : c.category));
    return step < shown;
  });
  const issues = visibleChecks.filter((c) => c.status === "bad" || c.status === "warn").length;
  const pct = complete ? 100 : Math.round((shown / STEPS.length) * 100 + (failed ? 0 : 100 / STEPS.length / 2));
  const lines = report.log.slice(Math.max(0, logShown - 7), logShown);
  const current = STEPS[Math.min(shown, STEPS.length - 1)];
  const mobileActive = !failed && current.key === "mobile" && !complete;
  const shot = (which: "mobile" | "desktop") => (report.shots?.[which] || report.lighthouse?.[which]?.hasScreenshot ? `/api/analyse/${report.id}/bild/${which}?t=${encodeURIComponent(token)}` : null);

  return (
    <section className={`az-scan${complete ? " is-complete" : ""}${failed ? " is-failed" : ""}`} aria-labelledby="az-scan-title">
      <div className="az-scan__glow" aria-hidden="true" />
      <div className="container az-scan__grid">
        <div className="az-stage" aria-hidden="true">
          <div className={`az-browser${failed ? "" : " is-scanning"}`}>
            <div className="az-browser__bar">
              <span className="az-dots">
                <i />
                <i />
                <i />
              </span>
              <span className="az-url">
                <svg viewBox="0 0 24 24" width="13" height="13">
                  <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="az-url__text">{report.domain}</span>
              </span>
            </div>
            <div className="az-browser__view">
              <ScanPreview src={shot("desktop")} checks={visibleChecks} />
              {!failed && <div className="az-beam" />}
              <div className="az-grid-overlay" />
            </div>
          </div>

          <div className={`az-phone${mobileActive ? " is-active" : ""}`}>
            <div className="az-phone__view">
              <ScanPreview src={shot("mobile")} checks={visibleChecks} compact />
              <div className="az-phone__island" />
              {mobileActive && <div className="az-beam az-beam--phone" />}
            </div>
          </div>

          <div className="az-radar">
            <span className="az-radar__n">{visibleChecks.length}</span>
            <span className="az-radar__l">Prüfpunkte</span>
            <span className="az-radar__n az-radar__n--warn">{issues}</span>
            <span className="az-radar__l">Hinweise</span>
          </div>
        </div>

        <div className="az-panel">
          <p className="az-panel__kicker">{failed ? "Analyse abgebrochen" : complete ? "Analyse abgeschlossen" : "Analyse läuft"}</p>
          <h1 id="az-scan-title" className="az-panel__title">
            {failed ? "Wir konnten diese Website nicht prüfen" : complete ? "Ihre Website ist geprüft" : "Wir prüfen Ihre Website"}
          </h1>
          <SiteLine domain={report.domain} favicon={report.page?.favicon} />

          {failed ? (
            <div className="az-fail" role="alert">
              <p>{report.error}</p>
              <div className="az-fail__actions">
                <Link className="btn btn--primary" href="/">
                  Andere Adresse eingeben
                </Link>
                <Link className="btn btn--ghost az-on-dark" href="/kontakt">
                  Persönliche Analyse anfragen
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="az-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Fortschritt der Analyse">
                <span style={{ width: `${pct}%` }} />
              </div>
              <p className="az-progress__label" aria-live="polite">
                {complete ? "Bericht wird erstellt …" : `${current.running} …`}
                <span>{pct} %</span>
              </p>
            </>
          )}

          <ol className="az-steps">
            {STEPS.map((s, i) => {
              const st = state(i);
              return (
                <li key={s.key} className={`az-step is-${st}`}>
                  <span className="az-step__icon" aria-hidden="true">
                    {st === "done" ? (
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : st === "skip" ? (
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path d="M6 12h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    ) : st === "run" ? (
                      <span className="az-spin" />
                    ) : null}
                  </span>
                  <span className="az-step__label">{s.label}</span>
                  <span className="sr-only">{st === "done" ? "erledigt" : st === "run" ? "läuft" : st === "skip" ? "übersprungen" : "ausstehend"}</span>
                </li>
              );
            })}
          </ol>

          <div className="az-log" aria-hidden="true">
            {lines.map((l, i) => (
              <p key={logShown - lines.length + i} className={`az-log__line${/^✗/.test(l) ? " is-bad" : /^!/.test(l) ? " is-warn" : /^✓/.test(l) ? " is-ok" : ""}`}>
                {l}
              </p>
            ))}
          </div>
          {offline && !failed && <p className="az-note">Die Verbindung ist unterbrochen – wir versuchen es weiter.</p>}
          {!failed && <p className="az-note">Das dauert meist 30 bis 90 Sekunden. Sie können diese Seite offen lassen.</p>}
        </div>
      </div>
    </section>
  );
}

/** The checked site under the heading: its own icon and the domain. */
function SiteLine({ domain, favicon }: { domain: string; favicon?: string }) {
  const [icon, setIcon] = useState(true);
  return (
    <p className="az-target">
      <span className="az-target__icon" aria-hidden="true">
        {favicon && icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={favicon} alt="" width={20} height={20} onError={() => setIcon(false)} referrerPolicy="no-referrer" />
        ) : (
          <span>{domain.charAt(0).toUpperCase()}</span>
        )}
      </span>
      <span className="sr-only">Geprüfte Website: </span>
      <span className="az-target__url">{domain}</span>
    </p>
  );
}
