"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "../actions";
import { Icon, type IconName } from "../kit";

type Item = { href: string; label: string; icon: IconName; badge?: boolean };

const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Kunden",
    items: [
      { href: "/admin-alt", label: "Übersicht", icon: "home" },
      { href: "/admin-alt/anfragen", label: "Anfragen", icon: "inbox", badge: true },
      { href: "/admin-alt/chats", label: "Chat-Verläufe", icon: "chat" },
    ],
  },
  {
    label: "Website",
    items: [
      { href: "/admin-alt/seo", label: "SEO", icon: "search" },
      { href: "/admin-alt/analytics", label: "Google Analytics", icon: "chart" },
    ],
  },
  {
    label: "Assistent",
    items: [
      { href: "/admin-alt/chatbot", label: "Chatbot & Wissen", icon: "bot" },
      { href: "/admin-alt/pakete", label: "Pakete", icon: "box" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin-alt/sicherheit", label: "Sicherheit", icon: "shield" },
      { href: "/admin-alt/konto", label: "Konto", icon: "user" },
    ],
  },
];

/** Sidebar on desktop, top bar with a slide-in menu on small screens. */
export function AdminNav({ openRequests, username, brand }: { openRequests: number; username: string; brand: ReactNode }) {
  const path = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <aside className={`a-side${open ? " is-open" : ""}`}>
      <div className="a-side__bar">
        <Link href="/admin-alt" className="a-side__brand" aria-label="Madex Admin – Übersicht">
          {brand}
        </Link>
        <button type="button" className="a-side__toggle" aria-expanded={open} aria-controls="a-side-menu" onClick={() => setOpenOn(open ? null : path)}>
          <Icon name={open ? "close" : "menu"} size={20} />
          <span>{open ? "Schliessen" : "Menü"}</span>
          {!open && openRequests > 0 && <span className="a-nav__badge">{openRequests}</span>}
        </button>
      </div>
      <div className="a-side__menu" id="a-side-menu">
        <nav className="a-nav" aria-label="Admin">
          {GROUPS.map((g) => (
            <div key={g.label} className="a-nav__group">
              <p className="a-nav__label">{g.label}</p>
              {g.items.map((i) => {
                const active = i.href === "/admin-alt" ? path === "/admin-alt" : path.startsWith(i.href);
                return (
                  <Link key={i.href} href={i.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
                    <Icon name={i.icon} />
                    <span className="a-nav__text">{i.label}</span>
                    {i.badge && openRequests > 0 && (
                      <span className="a-nav__badge" aria-label={`${openRequests} neu`}>
                        {openRequests}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="a-side__foot">
          <p className="a-side__user">
            <Icon name="user" size={16} />
            <span>
              Angemeldet als <strong>{username}</strong>
            </span>
          </p>
          <a href="/" target="_blank" rel="noopener" className="a-side__link">
            <Icon name="external" size={16} />
            Website öffnen
          </a>
          <form action={signOut}>
            <button type="submit" className="a-side__link">
              <Icon name="logout" size={16} />
              Abmelden
            </button>
          </form>
        </div>
      </div>
      {open && <button type="button" className="a-side__scrim" aria-label="Menü schliessen" tabIndex={-1} onClick={() => setOpenOn(null)} />}
    </aside>
  );
}
