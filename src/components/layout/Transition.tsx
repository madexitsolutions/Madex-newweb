"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { useLenis } from "./SmoothScroll";

type Ctx = { navigate: (href: string) => void };

const TransitionContext = createContext<Ctx>({ navigate: () => {} });

export const useTransition = () => useContext(TransitionContext);

/**
 * Client navigation without an overlay: pages swap instantly and the smooth
 * scroller is reset to the top (hash links keep their anchor).
 */
export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const lenis = useLenis();
  const first = useRef(true);

  const navigate = useCallback(
    (href: string) => {
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname && !url.hash) {
        lenis?.scrollTo(0);
        return;
      }
      router.push(href);
    },
    [router, lenis],
  );

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.location.hash) return;
    lenis?.scrollTo(0, { immediate: true, force: true });
  }, [pathname, lenis]);

  return <TransitionContext.Provider value={{ navigate }}>{children}</TransitionContext.Provider>;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode };

/** Internal links use the Next router; external, mail and phone links stay plain anchors. */
export function Link({ href, children, ...rest }: LinkProps) {
  if (/^(https?:|mailto:|tel:)/.test(href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <NextLink href={href} {...rest}>
      {children}
    </NextLink>
  );
}
