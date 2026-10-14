"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { MarkSvg } from "@/components/ui/MarkSvg";
import { useLenis } from "./SmoothScroll";

type Phase = "idle" | "cover" | "reveal";
type Ctx = { navigate: (href: string) => void; phase: Phase };

const TransitionContext = createContext<Ctx>({ navigate: () => {}, phase: "idle" });

export const useTransition = () => useContext(TransitionContext);

const COVER_MS = 750;
const REVEAL_MS = 900;

export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const lenis = useLenis();
  const [phase, setPhase] = useState<Phase>("idle");
  const [label, setLabel] = useState("");
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const navigate = useCallback(
    (href: string) => {
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname && !url.hash) {
        lenis?.scrollTo(0);
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        router.push(href);
        return;
      }
      pending.current = url.pathname;
      setLabel(labelFor(url.pathname));
      setPhase("cover");
      lenis?.stop();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => router.push(href), COVER_MS);
    },
    [router, lenis],
  );

  useEffect(() => {
    if (phase !== "cover" || pending.current === null) return;
    if (pathname !== pending.current) return;
    pending.current = null;
    window.scrollTo(0, 0);
    lenis?.scrollTo(0, { immediate: true, force: true });
    lenis?.start();
    // allow the new page to paint before lifting the curtain
    const t = setTimeout(() => setPhase("reveal"), 120);
    const t2 = setTimeout(() => setPhase("idle"), 120 + REVEAL_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [pathname, phase, lenis]);

  return (
    <TransitionContext.Provider value={{ navigate, phase }}>
      {children}
      <div className={`pt pt--${phase}`} aria-hidden="true">
        <div className="pt__layer pt__layer--a" />
        <div className="pt__layer pt__layer--b">
          <div className="pt__center">
            <MarkSvg className="pt__mark" />
            <span className="pt__label">{label}</span>
          </div>
        </div>
      </div>
      <style>{`
        .pt{position:fixed;inset:0;z-index:9000;pointer-events:none}
        .pt__layer{position:absolute;inset:0;transform:translateY(100%);will-change:transform}
        .pt__layer--a{background:var(--teal)}
        .pt__layer--b{background:var(--night);display:grid;place-items:center}
        .pt--cover{pointer-events:all}
        .pt--cover .pt__layer--a{transform:translateY(0);transition:transform .6s var(--ease-in-out)}
        .pt--cover .pt__layer--b{transform:translateY(0);transition:transform .6s .09s var(--ease-in-out)}
        .pt--reveal .pt__layer--a{transform:translateY(-100%);transition:transform .75s .1s var(--ease-in-out)}
        .pt--reveal .pt__layer--b{transform:translateY(-100%);transition:transform .75s var(--ease-in-out)}
        .pt--idle .pt__layer{transition:none}
        .pt__center{display:grid;justify-items:center;gap:22px;opacity:0;transform:translateY(20px);transition:opacity .4s,transform .6s var(--ease-out)}
        .pt--cover .pt__center{opacity:1;transform:none;transition-delay:.35s}
        .pt__mark{width:min(140px,30vw);height:auto}
        .pt__mark path{animation:ptPulse 1.2s var(--ease-in-out) infinite alternate}
        .pt__mark path:nth-child(2){animation-delay:.12s}.pt__mark path:nth-child(3){animation-delay:.24s}
        .pt__label{font:600 clamp(18px,2.4vw,30px)/1 var(--font-display);color:#e9f4f3;letter-spacing:-.01em}
        @keyframes ptPulse{from{transform:translateY(0)}to{transform:translateY(-14px)}}
      `}</style>
    </TransitionContext.Provider>
  );
}

const LABELS: Record<string, string> = {
  "/": "Home",
  "/marketing-solutions": "Marketing Lösungen",
  "/uber-uns": "Über uns",
  "/das-team": "Das Team",
  "/blog": "Blog",
  "/karriere": "Karriere",
  "/portfolio": "Portfolio",
  "/website-portfolio": "Website Portfolio",
  "/graphic-design-portfolio": "Graphic Design Portfolio",
  "/werbevideos-portfolio": "Werbevideos Portfolio",
  "/partners": "Partner",
  "/kontakt": "Kontakt",
  "/kostenlose-prufung": "Kostenlose Prüfung",
  "/agb": "AGB",
  "/datenschutz": "Datenschutz",
};

function labelFor(path: string): string {
  const clean = path.replace(/\/$/, "") || "/";
  if (LABELS[clean]) return LABELS[clean];
  if (clean.startsWith("/marketing-solutions/")) return "Marketing Lösungen";
  return "Madex IT Solutions";
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode };

/** Internal link that plays the page transition. External/hash/modified clicks behave normally. */
export function Link({ href, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useTransition();
  const external = /^(https?:|mailto:|tel:)/.test(href);
  if (external) {
    return (
      <a href={href} onClick={onClick} {...rest}>
        {children}
      </a>
    );
  }
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (href.startsWith("#")) return;
    e.preventDefault();
    navigate(href);
  };
  return (
    <NextLink href={href} onClick={handle} {...rest}>
      {children}
    </NextLink>
  );
}
