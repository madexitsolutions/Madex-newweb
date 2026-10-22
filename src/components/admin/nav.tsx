"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./kit";
import { MadexCredit } from "./madex";

export type NavGroupView = { group: string; items: { href: string; label: string; icon: IconName; badge?: number }[] };

/** Sidebar on desktop, top bar with a slide-in menu on small screens. */
export function AdminNav({ groups, user, brand, siteUrl, signOut }: { groups: NavGroupView[]; user: { name: string; role: string }; brand: ReactNode; siteUrl?: string; signOut: () => Promise<void> }) {
  const path = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const total = groups.flatMap((g) => g.items).reduce((n, i) => n + (i.badge ?? 0), 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <aside className={`a-side${open ? " is-open" : ""}`}>
      <div className="a-side__bar">
        <Link href="/admin" className="a-side__brand" aria-label="Übersicht">
          {brand}
        </Link>
        <button type="button" className="a-side__toggle" aria-expanded={open} aria-controls="a-side-menu" onClick={() => setOpenOn(open ? null : path)}>
          <Icon name={open ? "close" : "menu"} size={20} />
          <span>{open ? "Schliessen" : "Menü"}</span>
          {!open && total > 0 && <span className="a-nav__badge">{total}</span>}
        </button>
      </div>
      <div className="a-side__menu" id="a-side-menu">
        <nav className="a-nav" aria-label="Hauptmenü">
          {groups.map((g) => (
            <div key={g.group} className="a-nav__group">
              <p className="a-nav__label">{g.group}</p>
              {g.items.map((i) => {
                const active = i.href === "/admin" ? path === "/admin" : path === i.href || path.startsWith(i.href + "/");
                return (
                  <Link key={i.href} href={i.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
                    <Icon name={i.icon} />
                    <span className="a-nav__text">{i.label}</span>
                    {i.badge ? (
                      <span className="a-nav__badge" aria-label={`${i.badge} offen`}>
                        {i.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="a-side__foot">
          <Link href="/admin/konto" className="a-side__link a-side__user">
            <Icon name="user" size={16} />
            <span>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </span>
          </Link>
          {siteUrl && (
            <a href={siteUrl} target="_blank" rel="noopener" className="a-side__link">
              <Icon name="external" size={16} />
              Website öffnen
            </a>
          )}
          <form action={signOut}>
            <button type="submit" className="a-side__link">
              <Icon name="logout" size={16} />
              Abmelden
            </button>
          </form>
          <MadexCredit light className="a-side__madex" />
        </div>
      </div>
      {open && <button type="button" className="a-side__scrim" aria-label="Menü schliessen" tabIndex={-1} onClick={() => setOpenOn(null)} />}
    </aside>
  );
}
