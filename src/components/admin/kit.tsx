import Link from "next/link";
import type { ReactNode } from "react";

/* ---------- Icons: one 24px grid, 1.75 stroke, round caps ---------- */

const PATHS = {
  home: "M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9",
  inbox: "M3 13h5l1.5 3h5L16 13h5M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z",
  chat: "M4 5h16v11H9l-5 4V5zM8 9.5h8M8 12.5h5",
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 21 21",
  chart: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6M20 16v-9",
  bot: "M12 3v3M6 8h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM9 13h.01M15 13h.01M9.5 16.5h5",
  box: "M12 3 4 7v10l8 4 8-4V7l-8-4zM4 7l8 4 8-4M12 11v10",
  shield: "M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3zM9 12l2 2 4-4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c.8-4 4-6 8-6s7.2 2 8 6",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  logout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14",
  check: "M5 12.5 10 17l9-10",
  alert: "M12 8v5M12 16.5h.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  eye: "M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  plug: "M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8zM12 17v4",
  book: "M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4V4zM5 16a4 4 0 0 1 4-4h10",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4",
  building: "M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 10h3a1 1 0 0 1 1 1v10M3 21h18M8.5 8h3M8.5 12h3M8.5 16h3",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  cart: "M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 8H6.2M9 20.5h.01M18 20.5h.01",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9zM7.5 7.5h.01",
  users: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7",
  percent: "M19 5 5 19M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM16.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  truck: "M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M9 13h6M9 17h4",
  image: "M4 5h16v14H4zM4 15l4.5-4.5 4 4 2.5-2.5L20 17M15.5 9.5h.01",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  key: "M15 7a4 4 0 1 1-3.9 4.9L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0 1 15 7zM16.5 8.5h.01",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 0 0 4 0",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  layers: "M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  copy: "M8 8h12v12H8zM4 16V4h12",
  refresh: "M20 11a8 8 0 0 0-14.9-3.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.9 3.5L20 15M20 20v-5h-5",
  filter: "M3 5h18l-7 8v6l-4 2v-8L3 5z",
  store: "M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0",
  lock: "M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11",
  upload: "M12 16V4M7.5 8.5 12 4l4.5 4.5M5 20h14",
  print: "M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z",
  sparkle: "M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8z",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  phone: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2",
  monitor: "M3 5h18v11H3zM8 20h8M12 16v4",
  palette: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-7.8-9-7.8zM7.5 11.5h.01M10.5 7.5h.01M15 7.5h.01",
  code: "M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14",
  megaphone: "M3 10v4h3l7 4V6L6 10H3zM16 9a3.5 3.5 0 0 1 0 6M18.5 6.5a7 7 0 0 1 0 11",
  cookie: "M20.5 12.5A8.5 8.5 0 1 1 11.5 3.5a3 3 0 0 0 4 3.5 3 3 0 0 0 5 5.5zM8.5 9.5h.01M8 14.5h.01M12.5 12.5h.01M15 16.5h.01",
  wrench: "M14.5 6.5a4 4 0 0 0 5 5L21 13l-8 8-3-3 1.5-1.5a4 4 0 0 1-5-5L4 9l2-2 2.5 2.5a4 4 0 0 1 6-3zM3 21l5-5",
  shuffle: "M4 7h3l10 10h3M4 17h3l3-3M14 10l3-3h3M17 4l3 3-3 3M17 14l3 3-3 3",
  pages: "M8 3h9a2 2 0 0 1 2 2v12M5 7h9a2 2 0 0 1 2 2v12H7a2 2 0 0 1-2-2V7zM8 12h5M8 16h5",
  menuedit: "M4 6h16M4 12h10M4 18h7M17 15l3 3-3 3",
  type: "M5 6V4h14v2M12 4v16M9 20h6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`a-ico${className ? " " + className : ""}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ---------- Page header: crumb, title, one-line description, actions on the right ---------- */

export function PageHeader({ title, description, actions, crumb, meta }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; crumb?: { href: string; label: string }; meta?: ReactNode }) {
  return (
    <header className="a-head">
      <div className="a-head__text">
        {crumb && (
          <Link href={crumb.href} className="a-crumb">
            <Icon name="back" size={15} />
            {crumb.label}
          </Link>
        )}
        <div className="a-head__title">
          <h1>{title}</h1>
          {meta}
        </div>
        {description && <p className="a-head__desc">{description}</p>}
      </div>
      {actions && <div className="a-head__actions">{actions}</div>}
    </header>
  );
}

/* ---------- Tabs as links (state lives in searchParams) ---------- */

export type TabItem = { key: string; label: string; href: string; count?: number; icon?: IconName };

export function Tabs({ items, active, label, variant = "line" }: { items: TabItem[]; active: string; label: string; variant?: "line" | "segment" }) {
  return (
    <nav className={`a-tabs a-tabs--${variant}`} aria-label={label}>
      {items.map((t) => {
        const on = t.key === active;
        return (
          <Link key={t.key} href={t.href} className={on ? "is-active" : undefined} aria-current={on ? "page" : undefined} scroll={false}>
            {t.icon && <Icon name={t.icon} size={16} />}
            <span>{t.label}</span>
            {t.count !== undefined && <span className="a-tabs__count">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/* ---------- Empty state that says what to do ---------- */

export function Empty({ icon = "inbox", title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="a-emptystate">
      <span className="a-emptystate__icon">
        <Icon name={icon} size={22} />
      </span>
      <p className="a-emptystate__title">{title}</p>
      {children && <p className="a-emptystate__text">{children}</p>}
      {action}
    </div>
  );
}

/* ---------- Panel with header row ---------- */

export function Panel({ title, description, action, children, flush, id, className }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean; id?: string; className?: string }) {
  return (
    <section className={`a-panel${flush ? " a-panel--flush" : ""}${className ? " " + className : ""}`} id={id}>
      {(title || action) && (
        <div className="a-panel__head">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p className="a-panel__desc">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- Form section: label + help on the left, fields on the right ---------- */

export function FormSection({ title, help, children }: { title: string; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="a-fsec">
      <div className="a-fsec__intro">
        <h3>{title}</h3>
        {help && <p>{help}</p>}
      </div>
      <div className="a-fsec__body">{children}</div>
    </div>
  );
}

/* ---------- Pagination ---------- */

export function Pager({ page, pages, href, total, from, to }: { page: number; pages: number; href: (p: number) => string; total: number; from: number; to: number }) {
  if (total === 0) return null;
  const nums: (number | "gap")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "gap") nums.push("gap");
  }
  return (
    <div className="a-pager">
      <span className="a-pager__info">
        {from}–{to} von {total}
      </span>
      {pages > 1 && (
        <nav aria-label="Seiten" className="a-pager__nav">
          {page > 1 ? (
            <Link href={href(page - 1)} scroll={false} aria-label="Vorherige Seite">
              <Icon name="back" size={16} />
            </Link>
          ) : (
            <span aria-hidden="true" className="is-off">
              <Icon name="back" size={16} />
            </span>
          )}
          {nums.map((n, i) =>
            n === "gap" ? (
              <span key={`g${i}`} className="a-pager__gap">
                …
              </span>
            ) : (
              <Link key={n} href={href(n)} scroll={false} className={n === page ? "is-active" : undefined} aria-current={n === page ? "page" : undefined}>
                {n}
              </Link>
            ),
          )}
          {page < pages ? (
            <Link href={href(page + 1)} scroll={false} aria-label="Nächste Seite">
              <Icon name="arrow" size={16} />
            </Link>
          ) : (
            <span aria-hidden="true" className="is-off">
              <Icon name="arrow" size={16} />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}

/** Builds "?a=1&b=2" from an object, dropping empty values. */
export function qs(params: Record<string, string | number | undefined | null | false>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== false && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
}

/** First value of a search param. */
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
