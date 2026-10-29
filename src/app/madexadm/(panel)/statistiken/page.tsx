import Link from "next/link";
import { Delta, HBars, LineChart, Split } from "@/components/admin/charts-ext";
import {
  Empty,
  Icon,
  PageHeader,
  Panel,
  Tabs,
  one,
  qs,
} from "@/components/admin/kit";
import { money, number } from "@/lib/format";
import { enabledModules, requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import {
  Ga4Error,
  ga4Config,
  ga4Report,
  type Ga4Report,
} from "@/server/analytics/ga4";
import {
  RANGE_PRESETS,
  bucketLabel,
  resolveRange,
} from "@/server/analytics/range";
import { change, salesReport } from "@/server/analytics/sales";
import "../../content.css";

export const metadata = { title: "Statistiken" };

const BUCKET_NAME = { day: "pro Tag", week: "pro Woche", month: "pro Monat" };

function Stat({
  label,
  value,
  delta,
  invert,
  hint,
}: {
  label: string;
  value: string;
  delta?: number | null;
  invert?: boolean;
  hint?: string;
}) {
  return (
    <div className="a-kpi">
      <span className="a-kpi__label">{label}</span>
      <strong>{value}</strong>
      {delta !== undefined ? (
        <Delta value={delta} invert={invert} />
      ) : hint ? (
        <span className="a-kpi__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("analytics.view");
  await requireModule("shop", "analytics");
  const modules = await enabledModules();
  const sp = await searchParams;
  const range = resolveRange(
    one(sp.zeitraum) || undefined,
    one(sp.von),
    one(sp.bis),
  );
  const metric = one(sp.kennzahl) === "bestellungen" ? "orders" : "revenue";
  const rangeParams = {
    zeitraum: range.key === "30" ? undefined : range.key,
    von: range.key === "custom" ? range.fromDay : undefined,
    bis: range.key === "custom" ? range.toDay : undefined,
  };

  const ga = modules.analytics ? await ga4Config() : { configured: false };
  const [report, ga4] = await Promise.all([
    salesReport(range),
    ga.configured
      ? ga4Report(range).then(
          (r): { ok: true; r: Ga4Report } => ({ ok: true, r }),
          (e): { ok: false; error: string } => ({
            ok: false,
            error:
              e instanceof Ga4Error
                ? e.message
                : "Google Analytics konnte nicht abgefragt werden.",
          }),
        )
      : null,
  ]);
  const t = report.totals;
  const p = report.previous;
  const labels = report.series.map((s) => bucketLabel(s.key, range.bucket));
  const short = report.series.map((s) =>
    bucketLabel(s.key, range.bucket, true),
  );
  const prevVals = report.series.map(
    (_, i) => report.previousSeries[i]?.[metric] ?? 0,
  );
  const hasSales = report.allOrders > 0 || p.orders > 0;

  return (
    <>
      <PageHeader
        title="Statistiken"
        description={
          modules.shop
            ? `${range.label} · verglichen mit dem gleich langen Zeitraum davor. Umsatz = bezahlte Bestellungen abzüglich Rückerstattungen.`
            : `${range.label} · verglichen mit dem gleich langen Zeitraum davor.`
        }
        actions={
          modules.shop && (
            <a
              href={`/madexadm/statistiken/export${qs(rangeParams)}`}
              className="a-btn a-btn--ghost"
              download
            >
              <Icon name="download" size={16} />
              Tagesbericht (CSV)
            </a>
          )
        }
      />
      <div className="st-range">
        <nav className="a-chips" aria-label="Zeitraum">
          {RANGE_PRESETS.map((r) => (
            <Link
              key={r.key}
              href={`/madexadm/statistiken${qs({ zeitraum: r.key === "30" ? undefined : r.key, kennzahl: metric === "orders" ? "bestellungen" : undefined })}`}
              className={`a-chip${range.key === r.key ? " is-active" : ""}`}
              aria-current={range.key === r.key ? "true" : undefined}
            >
              {r.label}
            </Link>
          ))}
        </nav>
        <form className="st-custom" action="/madexadm/statistiken">
          <input type="hidden" name="zeitraum" value="custom" />
          <label className="a-field">
            <span>Von</span>
            <input
              type="date"
              name="von"
              defaultValue={range.fromDay}
              required
            />
          </label>
          <label className="a-field">
            <span>Bis</span>
            <input type="date" name="bis" defaultValue={range.toDay} required />
          </label>
          <button
            type="submit"
            className={`a-btn ${range.key === "custom" ? "a-btn--primary" : "a-btn--ghost"}`}
          >
            Anwenden
          </button>
        </form>
      </div>

      {modules.shop && (
        <>
          <div className="a-kpis">
            <Stat
              label="Umsatz"
              value={money(t.revenue)}
              delta={change(t.revenue, p.revenue)}
            />
            <Stat
              label="Bezahlte Bestellungen"
              value={number(t.orders)}
              delta={change(t.orders, p.orders)}
            />
            <Stat
              label="Ø Bestellwert"
              value={money(t.aov)}
              delta={change(t.aov, p.aov)}
            />
            <Stat
              label="Rückerstattungen"
              value={money(t.refunds)}
              delta={
                t.refunds || p.refunds
                  ? change(t.refunds, p.refunds)
                  : undefined
              }
              invert
              hint="Keine im Zeitraum"
            />
          </div>

          <Panel
            title={
              metric === "revenue"
                ? `Umsatz ${BUCKET_NAME[range.bucket]}`
                : `Bezahlte Bestellungen ${BUCKET_NAME[range.bucket]}`
            }
            action={
              <Tabs
                variant="segment"
                label="Kennzahl"
                active={metric}
                items={[
                  {
                    key: "revenue",
                    label: "Umsatz",
                    href: `/madexadm/statistiken${qs(rangeParams)}`,
                  },
                  {
                    key: "orders",
                    label: "Bestellungen",
                    href: `/madexadm/statistiken${qs({ ...rangeParams, kennzahl: "bestellungen" })}`,
                  },
                ]}
              />
            }
          >
            {hasSales ? (
              <LineChart
                title={
                  metric === "revenue"
                    ? "Umsatz im Zeitverlauf"
                    : "Bestellungen im Zeitverlauf"
                }
                labels={labels}
                shortLabels={short}
                series={[
                  {
                    name: range.label,
                    values: report.series.map((s) => s[metric]),
                  },
                  { name: "Vorperiode", values: prevVals, tone: "muted" },
                ]}
                format={metric === "revenue" ? "money" : "number"}
                unit={metric === "revenue" ? "CHF" : undefined}
                height={260}
              />
            ) : (
              <Empty icon="chart" title="Keine Bestellungen im Zeitraum">
                Wählen Sie einen anderen Zeitraum. Gezählt werden bezahlte
                Bestellungen.
              </Empty>
            )}
          </Panel>

          <div className="a-grid2">
            <Panel
              title="Top-Produkte"
              description="Nach Umsatz, abzüglich zurückerstatteter Stück"
            >
              <HBars
                title="Top-Produkte nach Umsatz"
                format="money"
                items={report.top.products.map((x) => ({
                  label: x.name,
                  value: x.revenue,
                  note: `${number(x.qty)} Stück`,
                }))}
              />
            </Panel>
            <Panel
              title="Top-Kategorien"
              description="Ein Produkt zählt in jeder seiner Kategorien"
            >
              <HBars
                title="Top-Kategorien nach Umsatz"
                format="money"
                items={report.top.categories.map((x) => ({
                  label: x.name,
                  value: x.revenue,
                  note: `${number(x.qty)} Stück`,
                }))}
              />
            </Panel>
          </div>

          <div className="a-grid2">
            <Panel title="Umsatz nach Zahlungsart">
              <HBars
                title="Umsatz nach Zahlungsart"
                format="money"
                items={report.payments.map((x) => ({
                  label: x.label,
                  value: x.revenue,
                  note: `${number(x.orders)} Bestellung${x.orders === 1 ? "" : "en"}`,
                }))}
              />
            </Panel>
            <Panel
              title="Neue und wiederkehrende Kunden"
              description="Kundinnen und Kunden mit bezahlter Bestellung im Zeitraum (nach E-Mail)"
            >
              {report.customers.newCustomers +
                report.customers.returningCustomers ===
              0 ? (
                <p className="a-muted cx-empty">
                  Keine Daten im gewählten Zeitraum.
                </p>
              ) : (
                <div className="a-stack">
                  <Split
                    parts={[
                      { label: "Neu", value: report.customers.newCustomers },
                      {
                        label: "Wiederkehrend",
                        value: report.customers.returningCustomers,
                      },
                    ]}
                  />
                  <p className="a-muted a-small0">
                    Umsatz neu {money(report.customers.newRevenue)} ·
                    wiederkehrend {money(report.customers.returningRevenue)}
                  </p>
                </div>
              )}
            </Panel>
          </div>

          <Panel
            title="Gutscheine"
            description="Eingelöste Codes in bezahlten Bestellungen"
            flush
          >
            {report.coupons.length === 0 ? (
              <p className="a-muted cx-empty st-pad">
                Im Zeitraum wurden keine Gutscheine eingelöst.
              </p>
            ) : (
              <div className="a-tablewrap">
                <table className="a-table a-table--stack">
                  <thead>
                    <tr>
                      <th scope="col">Code</th>
                      <th scope="col" className="a-num">
                        Bestellungen
                      </th>
                      <th scope="col" className="a-num">
                        Rabatt
                      </th>
                      <th scope="col" className="a-num">
                        Umsatz
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.coupons.map((c) => (
                      <tr key={c.code}>
                        <td>
                          <code>{c.code}</code>
                        </td>
                        <td className="a-num" data-label="Bestellungen">
                          {number(c.orders)}
                        </td>
                        <td className="a-num" data-label="Rabatt">
                          {money(c.discount)}
                        </td>
                        <td className="a-num" data-label="Umsatz">
                          {money(c.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {modules.analytics && (
        <section id="besucher" className="st-ga" aria-labelledby="st-ga-title">
          <div className="st-ga__head">
            <h2 id="st-ga-title">Besucher der Website</h2>
            <p className="a-muted">Google Analytics 4 · {range.label}</p>
          </div>
          {!ga4 ? (
            <Panel>
              <div className="a-setup">
                <p className="a-setup__title">
                  <Icon name="chart" size={18} />
                  Google Analytics ist nicht verbunden
                </p>
                <ol className="a-steps">
                  <li>
                    In der Google Cloud Console ein Dienstkonto erstellen und
                    einen JSON-Schlüssel herunterladen.
                  </li>
                  <li>
                    Die «Google Analytics Data API» für das Projekt aktivieren.
                  </li>
                  <li>
                    In Google Analytics unter Verwaltung → Zugriffsverwaltung
                    für Properties das Dienstkonto als «Betrachter» hinzufügen.
                  </li>
                  <li>
                    In den Umgebungsvariablen (.env bzw. Coolify) eintragen:{" "}
                    <code>GA4_PROPERTY_ID</code> (nur Ziffern),{" "}
                    <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> und{" "}
                    <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> – dann
                    die App neu starten.
                  </li>
                </ol>
              </div>
            </Panel>
          ) : !ga4.ok ? (
            <p className="a-alert a-alert--error" role="alert">
              <Icon name="alert" size={16} />
              <span>{ga4.error}</span>
            </p>
          ) : (
            <>
              <div className="a-kpis">
                <Stat
                  label="Besucher"
                  value={number(ga4.r.totals.users)}
                  delta={change(ga4.r.totals.users, ga4.r.previous.users)}
                />
                <Stat
                  label="Sitzungen"
                  value={number(ga4.r.totals.sessions)}
                  delta={change(ga4.r.totals.sessions, ga4.r.previous.sessions)}
                />
                <Stat
                  label="Seitenaufrufe"
                  value={number(ga4.r.totals.views)}
                  delta={change(ga4.r.totals.views, ga4.r.previous.views)}
                />
                <Stat
                  label="Interaktionsrate"
                  value={`${Math.round(ga4.r.totals.engagement * 100)} %`}
                  hint={`${number(ga4.r.totals.newUsers)} neue Besucher`}
                />
              </div>
              <Panel title="Besucher pro Tag">
                <LineChart
                  title="Besucher pro Tag"
                  labels={ga4.r.days.map((d) => bucketLabel(d.date, "day"))}
                  shortLabels={ga4.r.days.map((d) =>
                    bucketLabel(d.date, "day", true),
                  )}
                  series={[
                    {
                      name: "Besucher",
                      values: ga4.r.days.map((d) => d.users),
                    },
                  ]}
                  height={220}
                />
              </Panel>
              <div className="a-grid2">
                <Panel title="Meistbesuchte Seiten">
                  <HBars
                    title="Seitenaufrufe je Seite"
                    items={ga4.r.pages.map((x) => ({
                      label: x.path,
                      value: x.views,
                      note: `${number(x.users)} Besucher`,
                    }))}
                  />
                </Panel>
                <Panel title="Herkunft der Besuche">
                  <HBars
                    title="Sitzungen je Kanal"
                    items={ga4.r.sources.map((x) => ({
                      label: x.source,
                      value: x.sessions,
                    }))}
                  />
                </Panel>
              </div>
              <Panel title="Geräte">
                <HBars
                  title="Sitzungen je Gerät"
                  items={ga4.r.devices.map((x) => ({
                    label: x.device,
                    value: x.sessions,
                  }))}
                />
              </Panel>
              <p className="a-footnote">
                Zahlen von Google werden 15 Minuten zwischengespeichert. Stand:{" "}
                {new Date(ga4.r.fetchedAt).toLocaleTimeString("de-CH", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Zurich",
                })}{" "}
                Uhr.
              </p>
            </>
          )}
        </section>
      )}
    </>
  );
}
