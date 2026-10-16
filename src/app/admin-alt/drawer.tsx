"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./kit";

/** Side panel whose open state lives in the URL; Escape or the backdrop returns to `closeHref`. */
export function Drawer({ closeHref, title, subtitle, children, footer }: { closeHref: string; title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);

  return (
    <div className="a-drawer-root">
      <Link href={closeHref} scroll={false} className="a-drawer__scrim" aria-label="Schliessen" tabIndex={-1} />
      <aside className="a-drawer" role="dialog" aria-modal="false" aria-labelledby="a-drawer-title">
        <header className="a-drawer__head">
          <div>
            <h2 id="a-drawer-title" ref={ref} tabIndex={-1}>
              {title}
            </h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <Link href={closeHref} scroll={false} className="a-iconbtn" aria-label="Schliessen">
            <Icon name="close" size={20} />
          </Link>
        </header>
        <div className="a-drawer__body">{children}</div>
        {footer && <footer className="a-drawer__foot">{footer}</footer>}
      </aside>
    </div>
  );
}
