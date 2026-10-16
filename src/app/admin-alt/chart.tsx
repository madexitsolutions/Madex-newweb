/** Small dependency-free bar chart (server-rendered SVG). */
export function Bars({ data, label }: { data: { date: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 100 / data.length;
  return (
    <figure className="a-chart">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={label}>
        {data.map((d, i) => {
          const h = (d.count / max) * 36;
          return (
            <rect key={d.date} x={i * w + w * 0.15} y={40 - h} width={w * 0.7} height={Math.max(h, 0.4)} rx={0.6} className={d.count ? "a-chart__bar" : "a-chart__zero"}>
              <title>{`${new Date(d.date).toLocaleDateString("de-CH")}: ${d.count}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption>
        <span>{new Date(data[0].date).toLocaleDateString("de-CH", { day: "numeric", month: "short" })}</span>
        <span>Heute</span>
      </figcaption>
    </figure>
  );
}
