"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "./kit";
import { MADEX } from "./madex";

export type RailData = {
  siteUrl: string;
  maintenance: boolean;
  totp: boolean;
  inquiries: { open: number; latest: { id: string; who: string; subject: string; at: string }[]; due: { id: string; who: string; subject: string; at: string }[] } | null;
  seo: { avg: number; weak: number; weakest: { path: string; title: string; score: number }[] } | null;
  media: { files: number; bytes: number } | null;
};

const ago = (iso: string) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 60) return `vor ${Math.max(1, min)} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return d === 1 ? "gestern" : `vor ${d} Tagen`;
};
const mb = (b: number) => `${(b / 1024 / 1024).toLocaleString("de-CH", { maximumFractionDigits: 1 })} MB`;
const tone = (n: number) => (n >= 85 ? "ok" : n >= 70 ? "info" : n >= 50 ? "warn" : "bad");

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="a-rail__card">
      <h2 className="a-rail__title">{title}</h2>
      {children}
      {action}
    </section>
  );
}

function More({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="a-link a-rail__more">
      {children}
      <Icon name="arrow" size={14} />
    </Link>
  );
}

function FollowUps({ d }: { d: NonNullable<RailData["inquiries"]> }) {
  if (!d.due.length) return null;
  return (
    <Card title={`Nachfassen fällig (${d.due.length})`}>
      <ul className="a-rail__list">
        {d.due.map((i) => (
          <li key={i.id}>
            <Link href={`/admin/anfragen/${i.id}`}>
              <strong>{i.who}</strong>
              <span>{i.subject || "Ohne Betreff"}</span>
              <small className="a-rail__pts a-rail__pts--warn">seit {new Date(i.at).toLocaleDateString("de-CH", { day: "numeric", month: "short" })}</small>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Inquiries({ d }: { d: NonNullable<RailData["inquiries"]> }) {
  return (
    <Card title={d.open ? `Neue Anfragen (${d.open})` : "Anfragen"} action={<More href="/admin/anfragen">Alle Anfragen</More>}>
      {d.latest.length ? (
        <ul className="a-rail__list">
          {d.latest.map((i) => (
            <li key={i.id}>
              <Link href={`/admin/anfragen/${i.id}`}>
                <strong>{i.who}</strong>
                <span>{i.subject || "Ohne Betreff"}</span>
                <small>{ago(i.at)}</small>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="a-rail__hint">Alle Anfragen sind beantwortet.</p>
      )}
    </Card>
  );
}

function Seo({ d, linkWeakest }: { d: NonNullable<RailData["seo"]>; linkWeakest: boolean }) {
  return (
    <Card title="SEO auf einen Blick" action={!linkWeakest ? <More href="/admin/seo">Zur SEO-Übersicht</More> : undefined}>
      <div className={`a-rail__score a-rail__score--${tone(d.avg)}`}>
        <strong>{d.avg}</strong>
        <span>
          Ø Bewertung aller Seiten
          <small>{d.weak ? `${d.weak} mit Verbesserungsbedarf` : "Alle Seiten gut aufgestellt"}</small>
        </span>
      </div>
      {d.weakest.length > 0 && (
        <>
          <p className="a-rail__label">Zuerst verbessern</p>
          <ul className="a-rail__list">
            {d.weakest.map((p) => (
              <li key={p.path}>
                <Link href={`/admin/seo?bearbeiten=${encodeURIComponent(p.path)}`} scroll={false}>
                  <strong>{p.title || p.path}</strong>
                  <span className="a-mono-path">{p.path}</span>
                  <small className={`a-rail__pts a-rail__pts--${tone(p.score)}`}>{p.score}</small>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function Website({ d }: { d: RailData }) {
  return (
    <Card title="Website">
      <p className="a-rail__status">
        <span className={`a-dot ${d.maintenance ? "a-dot--warn" : "a-dot--ok"}`} />
        {d.maintenance ? "Wartungsmodus – Besucher sehen die Wartungsseite" : "Online für alle Besucher"}
      </p>
      <a href={d.siteUrl} target="_blank" rel="noopener" className="a-btn a-btn--ghost a-btn--sm a-rail__wide">
        <Icon name="external" size={15} />
        Website ansehen
      </a>
    </Card>
  );
}

function Tips({ title, items }: { title: string; items: string[] }) {
  return (
    <Card title={title}>
      <ul className="a-rail__tips">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </Card>
  );
}

function Support() {
  return (
    <Card title="Fragen oder Änderungswünsche?">
      <a href={`mailto:${MADEX.email}?subject=${encodeURIComponent("Support-Anfrage Dashboard")}`} className="a-rail__contact">
        <Icon name="mail" size={15} />
        {MADEX.email}
      </a>
      <a href={MADEX.phoneHref} className="a-rail__contact">
        <Icon name="phone" size={15} />
        {MADEX.phone}
      </a>
    </Card>
  );
}

/** Which cards a page gets – the most useful first, the website state always last. */
export function RailCards({ data }: { data: RailData }) {
  const path = usePathname() ?? "/admin";
  const on = (p: string) => path === p || path.startsWith(`${p}/`);
  const cards: ReactNode[] = [];

  if (path === "/admin") {
    // the overview already lists new enquiries in the main column
    if (data.inquiries) cards.push(<FollowUps key="f" d={data.inquiries} />);
    if (data.seo) cards.push(<Seo key="s" d={data.seo} linkWeakest={false} />);
    cards.push(<Support key="h" />);
  } else if (on("/admin/anfragen")) {
    if (data.inquiries) cards.push(<FollowUps key="f" d={data.inquiries} />, <Inquiries key="i" d={data.inquiries} />);
    cards.push(<Tips key="t" title="Tipps" items={["Anfragen innerhalb von 24 Stunden beantworten – die Chance auf einen Auftrag ist dann am grössten.", "Erledigte Anfragen abschliessen, damit die Liste übersichtlich bleibt."]} />);
  } else if (on("/admin/seo")) {
    if (data.seo) cards.push(<Seo key="s" d={data.seo} linkWeakest />);
    cards.push(
      <Tips
        key="t"
        title="So wirkt es bei Google"
        items={["Titel mit Leistung und Ort, z. B. «Webdesign Schaffhausen».", "Beschreibung mit Nutzen und Aufruf – sie entscheidet, ob jemand klickt.", "Änderungen erscheinen bei Google meist nach einigen Tagen."]}
      />,
    );
  } else if (on("/admin/medien")) {
    if (data.media) cards.push(<Card key="m" title="Mediathek"><p className="a-rail__big"><strong>{data.media.files.toLocaleString("de-CH")}</strong> Dateien · {mb(data.media.bytes)}</p></Card>);
    cards.push(<Tips key="t" title="Bilder für die Website" items={["Fotos mit höchstens 2000 px Breite hochladen – die Website verkleinert sie automatisch.", "Alt-Text beschreibt das Bild für Google und Screenreader."]} />);
  } else if (on("/admin/benutzer") || on("/admin/sicherheit") || on("/admin/konto")) {
    cards.push(
      <Card key="sec" title="Ihr Konto">
        <p className="a-rail__status">
          <span className={`a-dot ${data.totp ? "a-dot--ok" : "a-dot--warn"}`} />
          {data.totp ? "Zwei-Faktor-Anmeldung aktiv" : "Zwei-Faktor-Anmeldung nicht aktiv"}
        </p>
        {!data.totp && <p className="a-rail__hint">Mit einem zweiten Faktor (App auf dem Handy) bleibt das Dashboard auch bei einem gestohlenen Passwort geschützt.</p>}
      </Card>,
    );
    cards.push(<Tips key="t" title="Sicherheit" items={["Jede Person bekommt ein eigenes Konto – Zugänge nie teilen.", "Nur die Rechte vergeben, die jemand für seine Arbeit braucht."]} />);
  } else {
    if (data.inquiries?.open) cards.push(<Inquiries key="i" d={data.inquiries} />);
  }
  cards.push(<Website key="w" d={data} />);

  return (
    <aside className="a-rail" aria-label="Hinweise zu dieser Seite">
      {cards}
    </aside>
  );
}
