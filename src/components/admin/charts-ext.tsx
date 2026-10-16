"use client";

/**
 * Dependency-free SVG charts for statistics and the overview.
 * - <LineChart>: one or two series over time (current period solid with a 10 % area
 *   wash, comparison period as a muted line), y-axis with clean ticks, gridlines,
 *   crosshair + tooltip on hover/arrow keys, data table in <details>.
 * - <HBars>: ranked horizontal bars with values (HTML, wraps on small screens).
 * - <Delta>: signed change vs. a named period.
 * Colours come from the brand variables (--a-teal / --a-petrol); text uses ink tokens.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type ValueFormat = "money" | "number" | "percent";

export function formatValue(v: number, f: ValueFormat, compact = false) {
  if (f === "money") {
    const fr = v / 100;
    if (compact && Math.abs(fr) >= 10_000) return new Intl.NumberFormat("de-CH", { notation: "compact", maximumFractionDigits: 1 }).format(fr);
    return compact ? new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(fr) : new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2 }).format(fr);
  }
  if (f === "percent") return `${v.toLocaleString("de-CH", { maximumFractionDigits: 1 })} %`;
  if (compact && Math.abs(v) >= 10_000) return new Intl.NumberFormat("de-CH", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  return new Intl.NumberFormat("de-CH").format(v);
}

/** 0 … max in 4 clean steps (1, 2, 2.5, 5 × 10^n). */
export function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1, 2, 3, 4];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return Array.from({ length: count + 1 }, (_, i) => Math.round(i * step * 1000) / 1000);
}

export type Series = { name: string; values: number[]; tone?: "primary" | "muted" };

export function LineChart({
  title,
  description,
  labels,
  shortLabels,
  series,
  format = "number",
  height = 240,
  unit,
}: {
  title: string;
  description?: string;
  /** full label per point (tooltip, table) */
  labels: string[];
  /** compact label per point (x-axis) */
  shortLabels?: string[];
  series: Series[];
  format?: ValueFormat;
  height?: number;
  /** shown above the y-axis, e.g. "CHF" */
  unit?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = labels.length;
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(format === "money" ? max / 100 : max).map((t) => (format === "money" ? t * 100 : t));
  const top = ticks[ticks.length - 1] || 1;
  const tickText = ticks.map((t) => formatValue(t, format, true));
  const padL = Math.max(28, Math.max(...tickText.map((t) => t.length)) * 7 + 12);
  const padR = 12;
  const padT = unit ? 22 : 12;
  const padB = 28;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const x = (i: number) => padL + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => padT + h - (v / top) * h;
  const short = shortLabels ?? labels;
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 64))));
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");

  const pick = (clientX: number) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const rel = clientX - rect.left - padL;
    setHover(Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (rel / w) * (n - 1)))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover), 90), width - 90);

  return (
    <figure className="cx-chart">
      <div className="cx-chart__plot" ref={wrap} style={{ height }} onMouseMove={(e) => pick(e.clientX)} onMouseLeave={() => setHover(null)}>
        <svg width={width} height={height} role="img" aria-labelledby={`${uid}-t ${uid}-d`} tabIndex={0} onKeyDown={onKey} onBlur={() => setHover(null)} className="cx-svg">
          <title id={`${uid}-t`}>{title}</title>
          <desc id={`${uid}-d`}>{description ?? `${series.map((s) => s.name).join(" und ")}, ${labels[0]} bis ${labels[n - 1]}. Pfeiltasten zeigen einzelne Werte.`}</desc>
          <defs>
            <linearGradient id={`${uid}-g`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--a-teal)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--a-teal)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {unit && (
            <text x={padL - 8} y={11} textAnchor="end" className="cx-axis">
              {unit}
            </text>
          )}
          {ticks.map((t, i) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} className={i === 0 ? "cx-base" : "cx-grid"} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="cx-axis">
                {tickText[i]}
              </text>
            </g>
          ))}
          {short.map((l, i) =>
            i % every === 0 || (i === n - 1 && (n - 1) % every > every / 2) ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"} className="cx-axis">
                {l}
              </text>
            ) : null,
          )}
          {series.map((s, si) =>
            s.tone === "muted" ? (
              <path key={si} d={path(s.values)} className="cx-line cx-line--muted" />
            ) : (
              <g key={si}>
                {n > 1 && <path d={`${path(s.values)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={`url(#${uid}-g)`} />}
                <path d={path(s.values)} className="cx-line" />
                {n === 1 && <circle cx={x(0)} cy={y(s.values[0])} r={4} className="cx-dot" />}
              </g>
            ),
          )}
          {hover !== null && (
            <g aria-hidden="true">
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + h} className="cx-cross" />
              {series.map((s, si) => (
                <circle key={si} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} className={s.tone === "muted" ? "cx-dot cx-dot--muted" : "cx-dot"} />
              ))}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className="cx-tip" style={{ left: tipLeft }} role="status">
            <strong>{labels[hover]}</strong>
            {series.map((s, si) => (
              <span key={si}>
                <i className={s.tone === "muted" ? "cx-key cx-key--muted" : "cx-key"} />
                {s.name}: <b>{formatValue(s.values[hover] ?? 0, format)}</b>
              </span>
            ))}
          </div>
        )}
      </div>
      {series.length > 1 && (
        <figcaption className="cx-legend">
          {series.map((s, si) => (
            <span key={si}>
              <i className={s.tone === "muted" ? "cx-key cx-key--muted" : "cx-key"} />
              {s.name}
            </span>
          ))}
        </figcaption>
      )}
      <details className="cx-table">
        <summary>Werte als Tabelle</summary>
        <div className="a-tablewrap">
          <table className="a-table">
            <thead>
              <tr>
                <th scope="col">Zeitraum</th>
                {series.map((s) => (
                  <th key={s.name} scope="col" className="a-num">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={i}>
                  <th scope="row">{l}</th>
                  {series.map((s) => (
                    <td key={s.name} className="a-num">
                      {formatValue(s.values[i] ?? 0, format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Ranked horizontal bars: label left, bar, value right. */
export function HBars({ title, items, format = "number", secondary, empty = "Keine Daten im gewählten Zeitraum." }: { title: string; items: { label: string; value: number; note?: string; href?: string }[]; format?: ValueFormat; secondary?: string; empty?: string }) {
  if (!items.length) return <p className="a-muted cx-empty">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="cx-hbars" aria-label={title}>
      {items.map((it, i) => (
        <li key={i}>
          <span className="cx-hbars__label">
            {it.href ? (
              <a href={it.href} className="a-rowlink">
                {it.label}
              </a>
            ) : (
              it.label
            )}
            {it.note && <small>{it.note}</small>}
          </span>
          <span className="cx-hbars__track" aria-hidden="true">
            <i style={{ width: `${Math.max(1.5, (it.value / max) * 100)}%` }} />
          </span>
          <span className="cx-hbars__value">
            {formatValue(it.value, format)}
            {secondary && <span className="sr-only"> {secondary}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** "+12.5 % vs. Vorperiode" with direction arrow; neutral when there is no base. */
export function Delta({ value, label = "vs. Vorperiode", invert = false }: { value: number | null; label?: string; invert?: boolean }) {
  if (value === null) return <span className="cx-delta cx-delta--flat">neu {label}</span>;
  const up = value > 0;
  const good = value === 0 ? null : invert ? !up : up;
  const cls = good === null ? "cx-delta--flat" : good ? "cx-delta--up" : "cx-delta--down";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return (
    <span className={`cx-delta ${cls}`}>
      <span aria-hidden="true">{value > 0 ? "▲" : value < 0 ? "▼" : "•"}</span>
      <span className="sr-only">{value > 0 ? "Zunahme" : value < 0 ? "Abnahme" : "unverändert"}</span>
      {sign}
      {Math.abs(value).toLocaleString("de-CH", { maximumFractionDigits: 1 })} % <span className="cx-delta__ctx">{label}</span>
    </span>
  );
}

/** Two-part split bar (e.g. new vs. returning customers) with a legend. */
export function Split({ parts, format = "number" }: { parts: { label: string; value: number }[]; format?: ValueFormat }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="cx-split">
      <div className="cx-split__bar" aria-hidden="true">
        {parts.map((p, i) => (total ? <i key={i} className={`cx-split__seg cx-split__seg--${i}`} style={{ width: `${(p.value / total) * 100}%` }} /> : null))}
        {!total && <i className="cx-split__seg cx-split__seg--empty" style={{ width: "100%" }} />}
      </div>
      <ul className="cx-split__legend">
        {parts.map((p, i) => (
          <li key={i}>
            <i className={`cx-key cx-split__key--${i}`} />
            <span>{p.label}</span>
            <b>{formatValue(p.value, format)}</b>
            <small>{total ? Math.round((p.value / total) * 100) : 0} %</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
