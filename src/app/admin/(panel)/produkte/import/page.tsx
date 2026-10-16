import Link from "next/link";
import "../../../shop.css";
import { Empty, Icon, one, PageHeader, Pager, Panel, qs, Tabs } from "@/components/admin/kit";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { InputError } from "@/server/shop/errors";
import { planImport, readImportFile, readImportResult, type ImportPlan, type PlannedProduct } from "@/server/shop/import-export";
import { RunForm, UploadForm } from "./form";

export const metadata = { title: "Produkte importieren" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const PER_PAGE = 25;
const ACTION: Record<PlannedProduct["action"], { label: string; pill: string }> = {
  create: { label: "Neu", pill: "ok" },
  update: { label: "Aktualisieren", pill: "info" },
  skip: { label: "Überspringen", pill: "bad" },
};
const FILTERS = { "": "Alle", create: "Neu", update: "Aktualisieren", skip: "Mit Fehlern" } as const;

const header = (description: string) => <PageHeader title="Produkte importieren" description={description} crumb={{ href: "/admin/produkte", label: "Produkte" }} />;

export default async function ImportPage({ searchParams }: { searchParams: SP }) {
  await requirePermission("products.manage");
  await requireModule("shop");
  const sp = await searchParams;
  const token = one(sp.datei);
  const resultToken = one(sp.ergebnis);

  if (resultToken) return <ResultView token={resultToken} />;
  if (token) {
    const text = await readImportFile(token);
    if (!text) return <UploadView expired />;
    let plan: ImportPlan;
    try {
      plan = await planImport(text);
    } catch (e) {
      if (e instanceof InputError) return <UploadView error={e.message} />;
      throw e;
    }
    const filter = (one(sp.zeigen) in FILTERS ? one(sp.zeigen) : "") as keyof typeof FILTERS;
    return <PreviewView token={token} plan={plan} filter={filter} page={Math.max(1, Number(one(sp.seite)) || 1)} />;
  }
  return <UploadView />;
}

/* ------------------------------------------------------------ step 1: upload */

function UploadView({ expired, error }: { expired?: boolean; error?: string }) {
  return (
    <>
      {header("Sortiment aus einer CSV-Datei übernehmen. Sie sehen zuerst eine Vorschau, erst danach wird etwas geändert.")}
      {expired && (
        <p className="a-alert a-alert--error" role="alert">
          Die hochgeladene Datei ist abgelaufen (nach 24 Stunden) oder wurde bereits importiert. Bitte laden Sie sie erneut hoch.
        </p>
      )}
      {error && (
        <p className="a-alert a-alert--error" role="alert">
          {error}
        </p>
      )}
      <div className="a-grid2">
        <Panel title="1. Datei hochladen">
          <UploadForm />
        </Panel>
        <Panel title="Unterstützte Formate">
          <div className="a-stack a-small">
            <p>
              <strong>WooCommerce:</strong> In WordPress unter Produkte → Exportieren alle Spalten exportieren. Einfache und variable Produkte mit Varianten, Kategorien, Bildern, Lager und
              Aktionspreisen werden übernommen.
            </p>
            <p>
              <strong>Eigenes Format:</strong> die Datei aus{" "}
              <a href="/admin/produkte/export" className="a-link" download>
                Produkte exportieren
              </a>
              . Eine Zeile pro Variante, zusammengefasst über die Spalte «handle». So können Sie Preise und Lager in Excel ändern und wieder einlesen.
            </p>
            <p>
              Bestehende Produkte werden über Artikelnummer bzw. URL-Kürzel erkannt und aktualisiert, alle anderen neu angelegt. Excel-Dateien bitte als «CSV UTF-8» speichern.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ step 2: preview */

function PreviewView({ token, plan, filter, page }: { token: string; plan: ImportPlan; filter: keyof typeof FILTERS; page: number }) {
  const s = plan.summary;
  const rows = filter ? plan.products.filter((p) => p.action === filter) : plan.products;
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const href = (o: Record<string, string | number>) => `/admin/produkte/import${qs({ datei: token, zeigen: filter, ...o })}`;
  const errors = plan.issues.filter((i) => i.level === "error");
  const warnings = plan.issues.filter((i) => i.level === "warning");
  const nothing = s.create + s.update === 0;

  return (
    <>
      {header(`${plan.format === "woocommerce" ? "WooCommerce-Export" : "Eigene Exportdatei"} mit ${plan.rows} Zeile${plan.rows === 1 ? "" : "n"} erkannt. Prüfen Sie die Vorschau, bevor Sie importieren.`)}

      <div className="s-import-sum">
        <div className="a-kpi a-kpi--accent">
          <span className="a-kpi__label">Neue Produkte</span>
          <strong>{s.create}</strong>
        </div>
        <div className="a-kpi">
          <span className="a-kpi__label">Aktualisiert</span>
          <strong>{s.update}</strong>
        </div>
        <div className={`a-kpi${s.skip ? " a-kpi--warn" : ""}`}>
          <span className="a-kpi__label">Übersprungen</span>
          <strong>{s.skip}</strong>
          {s.skip > 0 && <span className="a-kpi__hint">wegen Fehlern, siehe unten</span>}
        </div>
        <div className="a-kpi">
          <span className="a-kpi__label">Varianten</span>
          <strong>{s.variants}</strong>
          <span className="a-kpi__hint">
            {s.images} Bilder, {s.categories} Kategorien
          </span>
        </div>
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <Panel title="Hinweise zur Datei" description="Diese Zeilen gehören zu keinem Produkt oder werden nicht unterstützt.">
          <Issues items={[...errors.map((i) => ({ error: true, text: `Zeile ${i.line}: ${i.message}` })), ...warnings.map((i) => ({ error: false, text: `Zeile ${i.line}: ${i.message}` }))]} />
        </Panel>
      )}

      <Panel
        flush
        title="Vorschau"
        action={
          <Tabs
            variant="segment"
            label="Anzeigen"
            active={filter}
            items={(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((k) => ({ key: k, label: FILTERS[k], count: k ? plan.products.filter((p) => p.action === k).length : plan.products.length, href: href({ zeigen: k, seite: "" }) }))}
          />
        }
      >
        {shown.length === 0 ? (
          <Empty icon="filter" title="Keine Produkte in dieser Ansicht" action={<Link href={href({ zeigen: "", seite: "" })} className="a-btn a-btn--ghost">Alle anzeigen</Link>}>
            Wählen Sie oben eine andere Ansicht.
          </Empty>
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>Aktion</th>
                  <th className="a-num">Varianten</th>
                  <th>Zeilen</th>
                  <th>Hinweise</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.key}>
                    <td>
                      <span className="a-cellmain">
                        {p.existingId ? (
                          <Link href={`/admin/produkte/${p.existingId}`} className="a-link" target="_blank">
                            {p.name || p.key}
                          </Link>
                        ) : (
                          p.name || p.key
                        )}
                      </span>
                      {p.categoryPaths.length > 0 && <small className="a-muted"> {p.categoryPaths.map((c) => c.join(" › ")).join(", ")}</small>}
                    </td>
                    <td>
                      <span className={`a-pill a-pill--${ACTION[p.action].pill}`}>{ACTION[p.action].label}</span>
                    </td>
                    <td className="a-num">{p.input.variants.length}</td>
                    <td className="a-nowrap a-muted">{lineRange(p.lines)}</td>
                    <td>
                      {p.errors.length + p.warnings.length === 0 ? (
                        <span className="a-muted">–</span>
                      ) : (
                        <Issues items={[...p.errors.map((t) => ({ error: true, text: t })), ...p.warnings.map((t) => ({ error: false, text: t }))]} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={current} pages={pages} href={(n) => href({ seite: n > 1 ? n : "" })} total={rows.length} from={(current - 1) * PER_PAGE + 1} to={Math.min(current * PER_PAGE, rows.length)} />
      </Panel>

      <Panel title="2. Import starten" description={nothing ? "Die Datei enthält kein Produkt, das importiert werden kann. Korrigieren Sie die Fehler und laden Sie die Datei erneut hoch." : `${s.create} Produkte werden angelegt und ${s.update} aktualisiert${s.skip ? `, ${s.skip} mit Fehlern übersprungen` : ""}.`}>
        <RunForm token={token} images={s.images} disabled={nothing} />
        <p className="a-small a-muted">
          <Link href="/admin/produkte/import" className="a-link">
            Andere Datei hochladen
          </Link>
        </p>
      </Panel>
    </>
  );
}

/* ------------------------------------------------------------ step 3: result */

async function ResultView({ token }: { token: string }) {
  const r = await readImportResult(token);
  if (!r) return <UploadView expired />;
  return (
    <>
      {header("Der Import ist abgeschlossen.")}
      <div className="s-import-sum">
        <div className="a-kpi a-kpi--accent">
          <span className="a-kpi__label">Erstellt</span>
          <strong>{r.created}</strong>
        </div>
        <div className="a-kpi">
          <span className="a-kpi__label">Aktualisiert</span>
          <strong>{r.updated}</strong>
        </div>
        <div className={`a-kpi${r.skipped ? " a-kpi--warn" : ""}`}>
          <span className="a-kpi__label">Übersprungen</span>
          <strong>{r.skipped}</strong>
        </div>
        <div className="a-kpi">
          <span className="a-kpi__label">Bilder geladen</span>
          <strong>{r.images}</strong>
        </div>
      </div>
      {r.errors.length > 0 && (
        <Panel title={`Fehler (${r.errors.length})`} description="Diese Produkte wurden nicht importiert. Korrigieren Sie die Datei und importieren Sie sie erneut – bereits importierte Produkte werden dabei nur aktualisiert.">
          <Issues items={r.errors.map((text) => ({ error: true, text }))} />
        </Panel>
      )}
      {r.warnings.length > 0 && (
        <Panel title={`Hinweise (${r.warnings.length})`} description="Importiert, aber bitte prüfen.">
          <Issues items={r.warnings.map((text) => ({ error: false, text }))} />
        </Panel>
      )}
      <div className="a-actions">
        <Link href="/admin/produkte" className="a-btn a-btn--primary">
          Zu den Produkten
        </Link>
        <Link href="/admin/produkte/import" className="a-btn a-btn--ghost">
          Weitere Datei importieren
        </Link>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ helpers */

function Issues({ items }: { items: { error: boolean; text: string }[] }) {
  const max = 200;
  return (
    <ul className="s-issues">
      {items.slice(0, max).map((i, n) => (
        <li key={n} className={i.error ? "is-error" : "is-warn"}>
          <Icon name="alert" size={14} className="a-ico" />
          <span>{i.text}</span>
        </li>
      ))}
      {items.length > max && <li className="a-muted">… und {items.length - max} weitere</li>}
    </ul>
  );
}

function lineRange(lines: number[]) {
  if (!lines.length) return "–";
  const min = Math.min(...lines);
  const max = Math.max(...lines);
  return min === max ? String(min) : `${min}–${max}`;
}
