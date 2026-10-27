/**
 * PROJEKTCODE (Madex): on an enquiry from the website analysis, the result
 * at a glance – score, the three biggest weaknesses and whether the prospect
 * opened the report – so the reply can start with what matters to them.
 */
import { Icon, Panel } from "@/components/admin/kit";
import { dateTime } from "@/lib/format";
import { analysisForInquiry } from "@/lib/server/analysis/admin";
import "./inquiry-analysis.css";

const tone = (n: number) => (n >= 85 ? "ok" : n >= 60 ? "info" : n >= 40 ? "warn" : "bad");

export async function InquiryAnalysis({ reference, fields }: { reference: string; fields: Record<string, string> }) {
  if (!fields.Bericht && !fields.Website) return null;
  const a = await analysisForInquiry(reference, fields.Bericht).catch(() => null);
  if (!a) return null;
  return (
    <Panel title={`Website-Analyse ${a.domain}`} description={a.madex ? "Website von Madex – der Bericht wurde kundenfreundlich erstellt." : undefined}>
      <div className="iqa">
        {a.score !== undefined ? (
          <span className={`iqa__score iqa__score--${tone(a.score)}`}>
            <strong>{a.score}</strong>
            <small>von 100</small>
          </span>
        ) : (
          <span className="a-pill a-pill--muted">{a.status === "failed" ? "Analyse fehlgeschlagen" : "läuft noch"}</span>
        )}
        <div className="iqa__body">
          {a.top && a.top.length > 0 && (
            <>
              <p className="iqa__label">Grösste Hebel für das Gespräch</p>
              <ol className="iqa__top">
                {a.top.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </>
          )}
          <p className="iqa__meta">
            <span className={a.views ? "is-on" : ""}>{a.views ? `Bericht ${a.views}× geöffnet, zuletzt ${dateTime(a.lastViewedAt)}` : "Bericht noch nicht geöffnet"}</span>
            <span className={a.emailSentAt ? "is-on" : ""}>{a.emailSentAt ? "per E-Mail erhalten" : "nicht per E-Mail angefordert"}</span>
          </p>
          {a.status === "done" && (
            <p className="iqa__links">
              <a href={`/admin/analysen/${a.id}/bericht`} target="_blank" rel="noopener" className="a-btn a-btn--ghost a-btn--sm">
                <Icon name="eye" size={15} />
                Bericht ansehen
              </a>
              <a href={`/admin/analysen/${a.id}/bericht?pdf=1`} className="a-btn a-btn--quiet a-btn--sm">
                <Icon name="download" size={15} />
                PDF
              </a>
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
