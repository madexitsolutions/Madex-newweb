import { Suspense } from "react";
import { analyticsIds, getSettings } from "@/lib/server/settings";
import { ga4Configured, ga4Report } from "@/lib/server/ga4";
import { saveAnalytics } from "../../actions";
import { ActionForm, Submit } from "../../ui";
import { Bars } from "../../chart";
import { FormSection, Icon, PageHeader, Panel } from "../../kit";
import { requireAdmin } from "@/lib/server/auth";

export const metadata = { title: "Google Analytics" };

const fmt = (n: number) => n.toLocaleString("de-CH");

async function Report() {
  if (!ga4Configured()) {
    return (
      <div className="a-setup">
        <p className="a-setup__title">
          <Icon name="chart" />
          Berichte direkt hier anzeigen
        </p>
        <p className="a-muted">Einmalig einrichten, danach sehen Sie Besucher, Seiten und Herkunft ohne Umweg über Google.</p>
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
            <span className="a-kpi__label">Besucher</span>
            <strong>{fmt(r.totals.users)}</strong>
          </div>
          <div className="a-kpi">
            <span className="a-kpi__label">Sitzungen</span>
            <strong>{fmt(r.totals.sessions)}</strong>
          </div>
          <div className="a-kpi">
            <span className="a-kpi__label">Seitenaufrufe</span>
            <strong>{fmt(r.totals.views)}</strong>
          </div>
          <div className="a-kpi">
            <span className="a-kpi__label">Interaktionsrate</span>
            <strong>{Math.round(r.totals.engagement * 100)} %</strong>
          </div>
        </div>
        {r.days.length > 1 && (
          <div className="a-block">
            <h3>Besucher pro Tag</h3>
            <Bars data={r.days.map((d) => ({ date: d.date, count: d.users }))} label="Besucher pro Tag" />
          </div>
        )}
        <div className="a-grid2 a-block">
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
  await requireAdmin();
  const s = await getSettings();
  const env = analyticsIds({ ga4Id: "", gtmId: "", requireConsent: true });
  const ids = analyticsIds(s.analytics);
  const tracking = Boolean(ids.ga4Id || ids.gtmId);
  return (
    <>
      <PageHeader
        title="Google Analytics"
        meta={<span className={`a-pill ${tracking ? "a-pill--confirmed" : "a-pill--new"}`}>{tracking ? "Tracking aktiv" : "Kein Tracking"}</span>}
        description="Die wichtigsten Zahlen der letzten 28 Tage und die Verbindung zum Tracking-Code."
        actions={
          <a className="a-btn a-btn--ghost" href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={16} />
            Google Analytics öffnen
          </a>
        }
      />
      <Panel title="Letzte 28 Tage">
        <Suspense fallback={<div className="a-skeleton" aria-label="Daten werden von Google geladen …" />}>
          <Report />
        </Suspense>
      </Panel>
      <section className="a-panel a-panel--form">
        <ActionForm action={saveAnalytics} className="a-form">
          <FormSection title="Tracking-Code" help="Verbindet die Website mit Ihrer Google-Analytics-Property. Gilt sofort für alle Seiten.">
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
          </FormSection>
          <FormSection title="Datenschutz" help="Nach revDSG empfohlen: erst messen, wenn Besucher zugestimmt haben.">
            <label className="a-check a-check--box">
              <input type="checkbox" name="requireConsent" defaultChecked={s.analytics.requireConsent} />
              <span>
                Erst nach Zustimmung der Besucher laden
                <small>Empfohlen. Ohne Zustimmung wird kein Google-Code geladen.</small>
              </span>
            </label>
          </FormSection>
          <div className="a-savebar">
            <Submit>Speichern</Submit>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
