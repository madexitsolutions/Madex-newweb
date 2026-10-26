"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, scoreLabel, scoreTone, type Check, type Lighthouse, type ReportView } from "@/lib/analysis";
import { Link } from "@/components/layout/Transition";

const dateFmt = new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
const sec = (ms?: number) => (ms === undefined ? "–" : `${(ms / 1000).toLocaleString("de-CH", { maximumFractionDigits: 1 })} s`);
const STATUS_TEXT = { ok: "In Ordnung", warn: "Verbesserungsfähig", bad: "Handlungsbedarf", info: "Hinweis" } as const;

function useCountUp(to: number, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

function Gauge({ value }: { value: number }) {
  const v = useCountUp(value);
  const r = 64;
  const c = 2 * Math.PI * r;
  return (
    <div className={`az-gauge tone-${scoreTone(value)}`} role="img" aria-label={`Gesamtergebnis ${value} von 100 Punkten`}>
      <svg viewBox="0 0 160 160" width="160" height="160" aria-hidden="true">
        <circle cx="80" cy="80" r={r} className="az-gauge__track" />
        <circle cx="80" cy="80" r={r} className="az-gauge__fill" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform="rotate(-90 80 80)" />
      </svg>
      <span className="az-gauge__n" aria-hidden="true">
        {v}
        <small>/100</small>
      </span>
    </div>
  );
}

function StatusIcon({ status }: { status: Check["status"] }) {
  const d = status === "ok" ? "M5 12.5l4.5 4.5L19 7.5" : status === "bad" ? "M7 7l10 10M17 7L7 17" : status === "warn" ? "M12 6v8M12 17.5v.5" : "M12 11v6M12 7.5v.5";
  return (
    <span className={`az-st is-${status}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Report({ report, token, onUpdate }: { report: ReportView; token: string; onUpdate: (r: ReportView) => void }) {
  const s = report.scores!;
  const ins = report.insights!;
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Link zum Bericht:", window.location.href);
    }
  };
  const [mail, setMail] = useState<{ state: "idle" | "sending" | "sent" | "error"; msg?: string }>(report.emailSentAt ? { state: "sent" } : { state: "idle" });
  const send = async () => {
    setMail({ state: "sending" });
    try {
      const res = await fetch(`/api/analyse/${report.id}/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }) });
      const json = (await res.json()) as { ok: boolean; error?: string; sentAt?: string };
      if (!json.ok) return setMail({ state: "error", msg: json.error });
      setMail({ state: "sent" });
      onUpdate({ ...report, emailSentAt: json.sentAt });
    } catch {
      setMail({ state: "error", msg: "Die E-Mail konnte nicht gesendet werden. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut." });
    }
  };
  // the PDF shows every check, also those in closed groups, and gets a clear file name
  useEffect(() => {
    let title = document.title;
    const before = () => {
      document.querySelectorAll<HTMLDetailsElement>(".az-group").forEach((d) => (d.open = true));
      title = document.title;
      document.title = `Website-Analyse ${report.domain}`;
    };
    const after = () => {
      document.title = title;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [report.domain]);
  const cats = CATEGORIES.filter((c) => typeof s[c.key] === "number");
  const lh = report.lighthouse;
  const shot = (which: "mobile" | "desktop") => (lh?.[which]?.hasScreenshot ? `/api/analyse/${report.id}/bild/${which}?t=${encodeURIComponent(token)}` : null);
  const byCat = (key: string) => report.checks.filter((c) => c.category === key);
  const counts = { bad: report.checks.filter((c) => c.status === "bad").length, warn: report.checks.filter((c) => c.status === "warn").length, ok: report.checks.filter((c) => c.status === "ok").length };

  return (
    <div className="az-report">
      {/* letterhead, only in the PDF */}
      <header className="az-print-head" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.svg" alt="" width={168} height={36} />
        <div>
          <strong>Website-Analyse</strong>
          <span>
            {report.domain} · {dateFmt.format(new Date(report.createdAt))}
          </span>
        </div>
      </header>
      <section className="az-sum" aria-labelledby="az-title">
        <div className="az-scan__glow" aria-hidden="true" />
        <div className="container az-sum__grid">
          <div className="az-sum__score">
            <Gauge value={s.overall} />
            <p className={`az-sum__label tone-${scoreTone(s.overall)}`}>{scoreLabel(s.overall)}</p>
          </div>
          <div className="az-sum__copy">
            <p className="az-sum__meta">
              Website-Analyse für{" "}
              <a href={report.url} target="_blank" rel="noopener noreferrer nofollow">
                {report.domain}
              </a>{" "}
              vom {dateFmt.format(new Date(report.createdAt))}
            </p>
            <h1 id="az-title" className="az-sum__title">
              {ins.headline}
            </h1>
            <p className="az-sum__lead">{ins.summary}</p>
            <p className="az-sum__counts">
              <span className="is-bad">{counts.bad} mit Handlungsbedarf</span>
              <span className="is-warn">{counts.warn} verbesserungsfähig</span>
              <span className="is-ok">{counts.ok} in Ordnung</span>
            </p>
            <div className="az-sum__actions">
              {mail.state === "sent" ? (
                <p className="az-sent" role="status">
                  <StatusIcon status="ok" /> Bericht gesendet an {report.emailMasked}
                </p>
              ) : (
                <button type="button" className="btn btn--primary" onClick={send} disabled={mail.state === "sending"}>
                  {mail.state === "sending" ? "Wird gesendet …" : `Bericht an ${report.emailMasked} senden`}
                </button>
              )}
              <button type="button" className="btn btn--ghost az-on-dark" onClick={() => window.print()}>
                Als PDF speichern
              </button>
              <button type="button" className="btn btn--ghost az-on-dark" onClick={copyLink} title="Der Link ist 90 Tage gültig">
                {copied ? "Link kopiert" : "Link kopieren"}
              </button>
            </div>
            {mail.state === "error" && (
              <p className="az-err" role="alert">
                {mail.msg}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="az-sec" aria-labelledby="az-cat-h">
        <div className="container">
          <h2 id="az-cat-h" className="az-h2">
            Ihre Werte im Überblick
          </h2>
          <ul className="az-cats">
            {cats.map((c) => (
              <li key={c.key} className={`az-cat tone-${scoreTone(s[c.key])}`}>
                <a href={`#pruefung-${c.key}`} className="az-cat__link">
                  <span className="az-cat__head">
                    <span className="az-cat__name">{c.label}</span>
                    <span className="az-cat__n">{s[c.key]}</span>
                  </span>
                  <span className="az-bar">
                    <span style={{ width: `${Math.max(3, s[c.key])}%` }} />
                  </span>
                  {ins.categories[c.key] && <span className="az-cat__text">{ins.categories[c.key]}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {ins.top.length > 0 && (
        <section className="az-sec az-sec--tint" aria-labelledby="az-top-h">
          <div className="container az-top">
            <div className="az-top__intro">
              <h2 id="az-top-h" className="az-h2">
                Das bringt am meisten
              </h2>
              <p>Die {ins.top.length === 1 ? "wichtigste Verbesserung" : `${ins.top.length} wirksamsten Verbesserungen`} für Ihre Website, nach Wirkung sortiert.</p>
              {ins.strengths.length > 0 && (
                <div className="az-strengths">
                  <h3>Das machen Sie bereits gut</h3>
                  <ul>
                    {ins.strengths.map((t) => (
                      <li key={t}>
                        <StatusIcon status="ok" /> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <ol className="az-recs">
              {ins.top.map((t, i) => (
                <li key={i} className="az-rec">
                  <span className="az-rec__n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="az-rec__title">
                      {t.title} <span className={`az-impact is-${t.impact}`}>Wirkung {t.impact}</span>
                    </h3>
                    <p className="az-rec__problem">{t.problem}</p>
                    {t.solution && (
                      <p className="az-rec__solution">
                        <strong>So lösen Sie es:</strong> {t.solution}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {lh && (lh.mobile || lh.desktop) && (
        <section className="az-sec" aria-labelledby="az-g-h">
          <div className="container">
            <h2 id="az-g-h" className="az-h2">
              Gemessen mit Google PageSpeed
            </h2>
            <p className="az-sub">So sieht Google Ihre Website beim Laden – auf dem Smartphone und am Computer.</p>
            <div className="az-devices">
              {(["mobile", "desktop"] as const).map((w) => (lh[w] ? <Device key={w} which={w} data={lh[w]!} shot={shot(w)} /> : null))}
            </div>
          </div>
        </section>
      )}

      <section className="az-sec" aria-labelledby="az-all-h">
        <div className="container">
          <h2 id="az-all-h" className="az-h2">
            Alle Prüfpunkte
          </h2>
          <p className="az-sub">{report.checks.filter((c) => c.status !== "info").length} Messungen in {cats.length === 7 ? "sieben" : "sechs"} Bereichen. Öffnen Sie einen Bereich für die Details.</p>
          <div className="az-groups">
            {cats.map((c) => {
              const list = byCat(c.key).sort((a, b) => order(a) - order(b));
              const open = list.some((x) => x.status === "bad");
              return (
                <details key={c.key} id={`pruefung-${c.key}`} className="az-group" open={open}>
                  <summary>
                    <span className="az-group__name">{c.label}</span>
                    <span className={`az-group__n tone-${scoreTone(s[c.key])}`}>{s[c.key]} Punkte</span>
                  </summary>
                  <ul className="az-checks">
                    {list.map((x) => (
                      <li key={x.id} className="az-check">
                        <StatusIcon status={x.status} />
                        <div className="az-check__body">
                          <p className="az-check__head">
                            <span className="az-check__label">{x.label}</span>
                            {x.value && <span className="az-check__value">{x.value}</span>}
                          </p>
                          {x.detail && <p className="az-check__detail">{x.detail}</p>}
                          <span className="sr-only">{STATUS_TEXT[x.status]}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </div>
      </section>

      <section className="az-cta" aria-labelledby="az-cta-h">
        <div className="container az-cta__inner">
          <div>
            <h2 id="az-cta-h">Sollen wir diese Punkte für Sie lösen?</h2>
            <p>
              Wir besprechen den Bericht mit Ihnen kostenlos und zeigen, was sich mit wenig Aufwand verbessern lässt. Im Madex-Wartungspaket ab CHF 250 pro Monat ist eine neue Website im Wert von CHF 8’000 bereits inklusive – mit Hosting, Domain und laufender Betreuung.
            </p>
          </div>
          <p className="az-print-contact">
            Madex IT Solutions GmbH · Buchenstrasse 36 · 8212 Neuhausen am Rheinfall
            <br />
            052 589 67 59 · info@madex-it.ch · madex-it.ch
          </p>
          <div className="az-cta__actions">
            <Link href="/kontakt" className="btn btn--primary">
              Kostenloses Gespräch vereinbaren
            </Link>
            <a href="tel:+41525896759" className="btn btn--ghost az-on-dark">
              052 589 67 59
            </a>
          </div>
        </div>
      </section>

      <p className="container az-foot">
        Automatische Analyse der Startseite {report.url} vom {dateFmt.format(new Date(report.createdAt))}. Messwerte können je nach Server und Tageszeit schwanken.
        {ins.ai ? " Die Texte wurden mit KI aus den Messwerten erstellt." : ""} Dieser Bericht ist 90 Tage unter diesem Link abrufbar.
      </p>
    </div>
  );
}

const order = (c: Check) => ({ bad: 0, warn: 1, ok: 2, info: 3 })[c.status] * 10 - c.weight;

const VITALS: { key: "lcp" | "fcp" | "tbt" | "si" | "cls"; label: string; hint: string; good: number; ok: number; fmt: (v: number) => string }[] = [
  { key: "lcp", label: "Hauptinhalt sichtbar", hint: "Largest Contentful Paint", good: 2500, ok: 4000, fmt: sec },
  { key: "fcp", label: "Erster Inhalt sichtbar", hint: "First Contentful Paint", good: 1800, ok: 3000, fmt: sec },
  { key: "si", label: "Seite aufgebaut", hint: "Speed Index", good: 3400, ok: 5800, fmt: sec },
  { key: "tbt", label: "Blockierte Zeit", hint: "Total Blocking Time", good: 200, ok: 600, fmt: (v) => `${v.toLocaleString("de-CH")} ms` },
  { key: "cls", label: "Layout-Verschiebung", hint: "Cumulative Layout Shift", good: 0.1, ok: 0.25, fmt: (v) => v.toLocaleString("de-CH") },
];

function Device({ which, data, shot }: { which: "mobile" | "desktop"; data: Lighthouse; shot: string | null }) {
  const scores = [
    { l: "Leistung", v: data.performance },
    { l: "SEO", v: data.seo },
    { l: "Barrierefreiheit", v: data.accessibility },
    { l: "Best Practices", v: data.bestPractices },
  ];
  return (
    <article className={`az-device az-device--${which}`}>
      <div className="az-device__stage">
        <div className={which === "mobile" ? "mk-iphone" : "mk-mac"}>
          <div className="mk-screen">
            {shot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot} alt={`So lädt Ihre Website ${which === "mobile" ? "auf dem Smartphone" : "am Computer"}`} loading="lazy" />
            ) : (
              <span className="az-device__none">Kein Bildschirmfoto</span>
            )}
            {which === "mobile" && <span className="mk-island" aria-hidden="true" />}
          </div>
          {which === "desktop" && <div className="mk-base" aria-hidden="true" />}
        </div>
      </div>
      <div className="az-device__data">
        <h3>{which === "mobile" ? "Smartphone" : "Desktop"}</h3>
        <ul className="az-minis">
          {scores.map((x) => (
            <li key={x.l} className={`tone-${scoreTone(x.v)}`}>
              <span className="az-minis__n">{x.v}</span>
              <span className="az-minis__l">{x.l}</span>
            </li>
          ))}
        </ul>
        <table className="az-vitals">
          <tbody>
            {VITALS.map((v) => {
              const val = data.vitals[v.key];
              if (val === undefined) return null;
              const st = val <= v.good ? "ok" : val <= v.ok ? "warn" : "bad";
              return (
                <tr key={v.key}>
                  <th scope="row">
                    {v.label}
                    <small>{v.hint}</small>
                  </th>
                  <td className={`is-${st}`}>{v.fmt(val)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.opportunities.length > 0 && (
          <div className="az-opps">
            <h4>Grösste Einsparungen laut Google</h4>
            <ul>
              {data.opportunities.slice(0, 4).map((o) => (
                <li key={o.title}>
                  <span>{o.title}</span>
                  {o.savingsMs ? <b>−{sec(o.savingsMs)}</b> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
