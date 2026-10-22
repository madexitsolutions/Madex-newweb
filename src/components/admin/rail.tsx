import Link from "next/link";
import type { CurrentUser } from "@/server/auth/session";
import type { Settings } from "@/server/settings";
import { AVAILABLE_PLUGINS, websiteEditing } from "@/modules/registry";
import { Icon, type IconName } from "./kit";
import { MADEX, MadexMark } from "./madex";

/**
 * Right-hand column on wide screens (≥ 1500 px): quick actions, the state of the
 * website and the support contact of Madex. Hidden on smaller screens.
 */
export function Rail({ user, modules, siteUrl }: { user: CurrentUser; modules: Settings["modules"]; siteUrl: string }) {
  const can = (p: Parameters<CurrentUser["permissions"]["has"]>[0]) => user.permissions.has(p);
  type Quick = { href: string; label: string; icon: IconName };
  const quick = ([
    websiteEditing && can("website.manage") && { href: "/admin/seiten/neu", label: "Seite", icon: "pages" },
    modules.blog && can("content.manage") && { href: "/admin/beitraege/neu", label: "Beitrag", icon: "file" },
    modules.shop && can("products.manage") && { href: "/admin/produkte/neu", label: "Produkt", icon: "box" },
    can("media.manage") && { href: "/admin/medien", label: "Bild hochladen", icon: "upload" },
    can("users.manage") && { href: "/admin/benutzer?einladen=1", label: "Benutzer", icon: "users" },
  ] as (Quick | false)[]).filter((x): x is Quick => Boolean(x));
  const active = AVAILABLE_PLUGINS.filter((p) => modules[p.key]);

  return (
    <aside className="a-rail" aria-label="Schnellzugriff und Hilfe">
      {quick.length > 0 && (
        <section className="a-rail__card">
          <h2 className="a-rail__title">Neu erstellen</h2>
          <div className="a-rail__quick">
            {quick.map((q) => (
              <Link key={q.href} href={q.href}>
                <Icon name={q.icon} size={16} />
                {q.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="a-rail__card">
        <h2 className="a-rail__title">Website</h2>
        <p className="a-rail__status">
          <span className={`a-dot ${modules.maintenance ? "a-dot--warn" : "a-dot--ok"}`} />
          {modules.maintenance ? "Wartungsmodus – Besucher sehen die Wartungsseite" : "Online für alle Besucher"}
        </p>
        <a href={siteUrl} target="_blank" rel="noopener" className="a-btn a-btn--ghost a-btn--sm a-rail__wide">
          <Icon name="external" size={15} />
          Website ansehen
        </a>
        {can("settings.manage") && (
          <div className="a-rail__plugins">
            <p className="a-rail__label">
              Aktive Plugins <span>{active.length}</span>
            </p>
            {active.length > 0 ? (
              <ul>
                {active.map((p) => (
                  <li key={p.key}>
                    <Icon name={p.icon} size={14} />
                    {p.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="a-rail__hint">Noch keine. Shop, Kontaktformular, Google Analytics und mehr lassen sich mit einem Klick aktivieren.</p>
            )}
            <Link href="/admin/plugins" className="a-link">
              Plugins verwalten
              <Icon name="arrow" size={14} />
            </Link>
          </div>
        )}
      </section>

      <section className="a-rail__card a-rail__madex">
        <MadexMark size={16} />
        <h2 className="a-rail__title">Hilfe von Madex</h2>
        <p>Diese Website und das Dashboard wurden von {MADEX.name} entwickelt. Bei Fragen oder Änderungswünschen sind wir für Sie da.</p>
        <a href={`mailto:${MADEX.email}?subject=${encodeURIComponent("Support-Anfrage Dashboard")}`} className="a-rail__contact">
          <Icon name="mail" size={15} />
          {MADEX.email}
        </a>
        <a href={MADEX.phoneHref} className="a-rail__contact">
          <Icon name="phone" size={15} />
          {MADEX.phone}
        </a>
      </section>
    </aside>
  );
}
