"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/anfragen", label: "Anfragen", badge: true },
  { href: "/admin/chats", label: "Chat-Verläufe" },
  { href: "/admin/seo", label: "SEO" },
  { href: "/admin/analytics", label: "Google Analytics" },
  { href: "/admin/chatbot", label: "Chatbot & Wissen" },
  { href: "/admin/pakete", label: "Pakete" },
  { href: "/admin/sicherheit", label: "Sicherheit" },
  { href: "/admin/konto", label: "Konto" },
];

export function AdminNav({ openRequests }: { openRequests: number }) {
  const path = usePathname();
  return (
    <nav className="a-nav" aria-label="Admin">
      {ITEMS.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
            {i.label}
            {i.badge && openRequests > 0 && <span className="a-nav__badge">{openRequests}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
