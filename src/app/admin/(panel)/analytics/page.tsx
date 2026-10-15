import { Suspense } from "react";
import { analyticsIds, getSettings } from "@/lib/server/settings";
import { ga4Configured, ga4Report } from "@/lib/server/ga4";
import { saveAnalytics } from "../../actions";
import { ActionForm, Submit } from "../../ui";
import { Bars } from "../../chart";

export const metadata = { title: "Google Analytics" };

const fmt = (n: number) => n.toLocaleString("de-CH");

async function Report() {
  if (!ga4Configured()) {
    return (
      <div className="a-empty">
        <p>
          <strong>Berichte direkt hier anzeigen</strong>
        </p>
        <ol className="a-steps">
          <li>In der Google Cloud Console ein Dienstkonto erstellen und die «Google Analytics Data API» aktivieren.</li>
          <li>Einen JSON-Schlüssel für das Dienstkonto herunterladen.</li>
          <li>In Google Analytics unter Verwaltung › Property-Zugriff die E-Mail des Dienstkontos als «Betrachter» hinzufügen.</li>
          <li>
            In der .env <code>GA4_PROPERTY_ID</code>, <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> und <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> setzen und neu starten.
          </li>
        </ol>
      </div>
    );
  }
  let r: Awaited<ReturnType<typeof ga4Report>>;
  try {
    r = await ga4Report(28);
  } catch (e) {
    return <p className="a-alert a-alert--error">{(e as Error).message}</p>;
  }
  {
    const max = Math.max(1, ...r.pages.map((p) => p.views));
    return (
      <>
        <div className="a-kpis">
          <div className="a-kpi">
            <strong>{fmt(r.totals.users)}</strong>
            <span>Besucher</span>
          </div>
          <div className="a-kpi">
            <strong>{fmt(r.totals.sessions)}</strong>
            <span>Sitzungen</span>
          </div>
          <div className="a-kpi">
            <strong>{fmt(r.totals.views)}</strong>
            <span>Seitenaufrufe</span>
          </div>
          <div className="a-kpi">
            <strong>{Math.round(r.totals.engagement * 100)} %</strong>
            <span>Interaktionsrate</span>
          </div>
        </div>
        {r.days.length > 1 && <Bars data={r.days.map((d) => ({ date: d.date, count: d.users }))} label="Besucher pro Tag" />}
        <div className="a-grid2">
          <div>
            <h3>Meistbesuchte Seiten</h3>
            <ul className="a-meter">
              {r.pages.map((p) => (
                <li key={p.path}>
                  <span>{p.path}</span>
                  <b>{fmt(p.views)}</b>
                  <i style={{ width: `${(p.views / max) * 100}%` }} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Herkunft der Besucher</h3>
            <ul className="a-meter">
              {r.sources.map((s) => (
                <li key={s.source}>
                  <span>{s.source}</span>
                  <b>{fmt(s.sessions)}</b>
                  <i style={{ width: `${(s.sessions / Math.max(1, r.sources[0]?.sessions ?? 1)) * 100}%` }} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </>
    );
  }
}

export default async function Analytics() {
  const s = await getSettings();
  const env = analyticsIds({ ga4Id: "", gtmId: "", requireConsent: true });
  return (
    <>
      <header className="a-head">
        <h1>Google Analytics</h1>
        <p className="a-muted">Tracking-Code verbinden und die wichtigsten Zahlen der letzten 28 Tage ansehen.</p>
      </header>
      <section className="a-panel">
        <h2>Letzte 28 Tage</h2>
        <Suspense fallback={<p className="a-muted">Daten werden von Google geladen …</p>}>
          <Report />
        </Suspense>
      </section>
      <section className="a-panel">
        <h2>Verbindung</h2>
        <ActionForm action={saveAnalytics} className="a-stack a-narrow">
          <label className="a-field">
            <span>GA4-Mess-ID</span>
            <input name="ga4Id" defaultValue={s.analytics.ga4Id} placeholder={env.ga4Id || "G-XXXXXXXXXX"} />
            <small>Google Analytics › Verwaltung › Datenstreams › Web. {env.ga4Id && `Aus der .env: ${env.ga4Id}`}</small>
          </label>
          <label className="a-field">
            <span>Google Tag Manager ID (optional)</span>
            <input name="gtmId" defaultValue={s.analytics.gtmId} placeholder={env.gtmId || "GTM-XXXXXXX"} />
            <small>Wenn gesetzt, wird der Tag Manager statt des direkten GA4-Codes geladen.</small>
          </label>
          <label className="a-check">
            <input type="checkbox" name="requireConsent" defaultChecked={s.analytics.requireConsent} />
            Erst nach Zustimmung der Besucher laden (empfohlen, revDSG)
          </label>
          <div>
            <Submit>Speichern</Submit>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
