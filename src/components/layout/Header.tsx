"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { mainNav, site } from "@/content/site";
import { services } from "@/content/services";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Link } from "./Transition";
import { useLenis } from "./SmoothScroll";

const ease = [0.16, 1, 0.3, 1] as const;

export function Header() {
  const pathname = usePathname();
  const lenis = useLenis();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      setHidden(y > 300 && y > last + 2);
      if (y < last - 2) setHidden(false);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [pathname]);

  useEffect(() => {
    if (mobile) lenis?.stop();
    else lenis?.start();
    document.body.style.overflow = mobile ? "hidden" : "";
  }, [mobile, lenis]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const enter = (label: string) => {
    clearTimeout(closeTimer.current);
    setOpen(label);
  };
  const leave = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 160);
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <>
      <header className={`hd${scrolled ? " hd--scrolled" : ""}${hidden && !open && !mobile ? " hd--hidden" : ""}`}>
        <div className="hd__bar">
          <Link href="/" className="hd__logo" aria-label="Madex IT Solutions – Startseite">
            <Logo tone="light" className="hd__logo-img" title="Madex IT Solutions" />
          </Link>

          <nav className="hd__nav" aria-label="Hauptnavigation">
            <ul className="hd__list">
              {mainNav.map((item) => (
                <li
                  key={item.label}
                  className="hd__li"
                  onPointerEnter={() => item.children && enter(item.label)}
                  onPointerLeave={() => item.children && leave()}
                >
                  <Link href={item.href} className={`hd__link${isActive(item.href) ? " is-active" : ""}`} aria-current={pathname === item.href ? "page" : undefined}>
                    {item.label}
                  </Link>
                  {item.children && (
                    <button
                      className="hd__caret"
                      aria-expanded={open === item.label}
                      aria-label={`Untermenü ${item.label} ${open === item.label ? "schliessen" : "öffnen"}`}
                      onClick={() => setOpen(open === item.label ? null : item.label)}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                        <path d="M1 3.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                  <AnimatePresence>
                    {item.children && open === item.label && (
                      <motion.div
                        className={`hd__drop${item.mega ? " hd__drop--mega" : ""}`}
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.45, ease }}
                        onPointerEnter={() => enter(item.label)}
                        onPointerLeave={leave}
                      >
                        {item.mega ? (
                          <div className="mega">
                            <ul className="mega__grid">
                              {services.map((s, i) => (
                                <motion.li key={s.slug} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, duration: 0.5, ease }}>
                                  <Link href={`/marketing-solutions/${s.slug}`} className="mega__item">
                                    <span className="mega__icon">
                                      <Icon name={s.icon} size={22} />
                                    </span>
                                    <span>
                                      <strong>{s.name}</strong>
                                      <small>{s.short}</small>
                                    </span>
                                  </Link>
                                </motion.li>
                              ))}
                            </ul>
                            <Link href="/marketing-solutions" className="mega__promo">
                              <Image src="/media/2023/05/te.webp" alt="" width={420} height={512} className="mega__promo-img" />
                              <span className="mega__promo-text">
                                Entdecken Sie alle Lösungen
                                <Icon name="arrow-up-right" size={18} />
                              </span>
                            </Link>
                          </div>
                        ) : (
                          <ul className="drop">
                            {item.children.map((c) => (
                              <li key={c.href}>
                                <Link href={c.href} className="drop__item">
                                  <strong>{c.label}</strong>
                                  {c.description && <small>{c.description}</small>}
                                  <Icon name="arrow" size={16} className="drop__arrow" />
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hd__actions">
            <a href={site.contact.phonePrimary.href} className="hd__phone">
              <Icon name="phone" size={16} />
              <span>{site.contact.phonePrimary.label}</span>
            </a>
            <Link href="/kostenlose-prufung" className="btn btn--sm hd__cta">
              Gratis-Analyse anfordern
            </Link>
            <button className={`hd__burger${mobile ? " is-open" : ""}`} aria-label={mobile ? "Menü schliessen" : "Menü öffnen"} aria-expanded={mobile} aria-controls="mobile-menu" onClick={() => setMobile(!mobile)}>
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobile && (
          <motion.div
            id="mobile-menu"
            className="mm"
            initial={{ clipPath: "circle(0% at calc(100% - 40px) 40px)" }}
            animate={{ clipPath: "circle(150% at calc(100% - 40px) 40px)" }}
            exit={{ clipPath: "circle(0% at calc(100% - 40px) 40px)" }}
            transition={{ duration: 0.8, ease: [0.83, 0, 0.17, 1] }}
          >
            <nav aria-label="Mobile Navigation" className="mm__nav" data-lenis-prevent>
              <ul>
                <li>
                  <Link href="/" className="mm__link">
                    Home
                  </Link>
                </li>
                {mainNav.map((item, i) => (
                  <motion.li key={item.label} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.06, duration: 0.7, ease }}>
                    <Link href={item.href} className="mm__link">
                      {item.label}
                    </Link>
                    {item.children && (
                      <ul className="mm__sub">
                        {item.children.map((c) => (
                          <li key={c.href}>
                            <Link href={c.href}>{c.label}</Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </motion.li>
                ))}
              </ul>
              <div className="mm__foot">
                <a href={site.contact.phonePrimary.href}>{site.contact.phonePrimary.label}</a>
                <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
                <Link href="/kostenlose-prufung" className="btn">
                  Gratis-Analyse anfordern
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .hd{position:fixed;inset:0 0 auto 0;z-index:800;padding:14px var(--gutter) 0;transition:transform .6s var(--ease-out)}
        .hd--hidden{transform:translateY(-120%)}
        .hd__bar{max-width:1560px;margin:0 auto;height:66px;display:flex;align-items:center;gap:24px;padding:0 12px 0 22px;border-radius:999px;
          color:#fff;transition:background .5s,box-shadow .5s,border-color .5s;border:1px solid transparent}
        .hd--scrolled .hd__bar{background:rgba(1,27,30,.72);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);
          border-color:rgba(255,255,255,.09);box-shadow:0 20px 50px -30px rgba(0,0,0,.6)}
        .hd__logo{flex:none;display:flex;align-items:center;height:44px;padding:0 4px;transition:transform .5s var(--ease-out),opacity .3s}
        .hd__logo:hover{transform:scale(1.04)}
        .hd__logo-img{width:clamp(124px,9.5vw,148px);height:auto;display:block}
        .hd__nav{margin-inline:auto}
        .hd__list{display:flex;list-style:none;margin:0;padding:0;gap:2px}
        .hd__li{position:relative;display:flex;align-items:center}
        .hd__link{position:relative;padding:10px 12px;font-weight:400;font-size:15px;letter-spacing:.01em;opacity:.88;transition:opacity .3s}
        .hd__link::after{content:"";position:absolute;left:12px;right:12px;bottom:4px;height:2px;border-radius:2px;background:var(--teal-glow);transform:scaleX(0);transform-origin:right;transition:transform .45s var(--ease-out)}
        .hd__link:hover,.hd__link.is-active{opacity:1}
        .hd__link:hover::after,.hd__link.is-active::after{transform:scaleX(1);transform-origin:left}
        .hd__caret{margin-left:-6px;width:28px;height:28px;display:grid;place-items:center;opacity:.7;border-radius:50%}
        .hd__caret[aria-expanded="true"] svg{transform:rotate(180deg)}
        .hd__caret svg{transition:transform .35s}
        .hd__drop{position:absolute;top:calc(100% + 18px);left:50%;translate:-50% 0;transform-origin:top center;background:rgba(255,255,255,.97);color:var(--text);
          border-radius:26px;box-shadow:0 40px 90px -30px rgba(1,27,30,.55);padding:12px;min-width:330px}
        .hd__drop::before{content:"";position:absolute;inset:-20px 0 auto 0;height:20px}
        .hd__drop--mega{position:fixed;top:92px;left:50%;width:min(1060px,calc(100vw - 2*var(--gutter)))}
        .drop{list-style:none;margin:0;padding:0;display:grid;gap:2px}
        .drop__item{display:grid;grid-template-columns:1fr auto;align-items:center;padding:14px 18px;border-radius:16px;transition:background .3s}
        .drop__item strong{font:600 16px/1.2 var(--font-display)}
        .drop__item small{grid-column:1;color:var(--text-soft);font-size:13px}
        .drop__arrow{grid-row:1/span 2;grid-column:2;color:var(--teal-ink);transform:translateX(-8px);opacity:0;transition:.35s var(--ease-out)}
        .drop__item:hover{background:rgba(2,141,134,.08)}
        .drop__item:hover .drop__arrow{transform:none;opacity:1}
        .mega{display:grid;grid-template-columns:1fr 260px;gap:12px}
        .mega__grid{list-style:none;margin:0;padding:6px;display:grid;grid-template-columns:1fr 1fr;gap:4px}
        .mega__item{display:flex;gap:14px;padding:14px;border-radius:16px;transition:background .3s}
        .mega__item:hover{background:rgba(2,141,134,.08)}
        .mega__item strong{display:block;font:600 15px/1.25 var(--font-display);margin-bottom:3px}
        .mega__item small{display:block;font-size:13px;line-height:1.45;color:var(--text-soft)}
        .mega__icon{flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--teal),var(--petrol));transition:transform .4s var(--ease-out)}
        .mega__item:hover .mega__icon{transform:rotate(-8deg) scale(1.08)}
        .mega__promo{position:relative;border-radius:20px;overflow:hidden;background:linear-gradient(160deg,var(--teal),var(--petrol));display:flex;align-items:flex-end;min-height:300px}
        .mega__promo-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center 20%;transition:transform .8s var(--ease-out)}
        .mega__promo:hover .mega__promo-img{transform:scale(1.06) rotate(-2deg)}
        .mega__promo-text{position:relative;display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;padding:18px 20px;color:#fff;font:600 17px/1.2 var(--font-display);background:linear-gradient(transparent,rgba(1,27,30,.75))}
        .hd__actions{display:flex;align-items:center;gap:14px;flex:none}
        .hd__phone{display:flex;align-items:center;gap:8px;font-size:14px;opacity:.85}
        .hd__phone:hover{opacity:1}
        .hd__burger{display:none;width:48px;height:48px;border-radius:50%;background:var(--teal);position:relative}
        .hd__burger span{position:absolute;left:14px;right:14px;height:2px;background:#fff;border-radius:2px;transition:transform .45s var(--ease-out)}
        .hd__burger span:first-child{top:19px}.hd__burger span:last-child{top:27px}
        .hd__burger.is-open span:first-child{transform:translateY(4px) rotate(45deg)}
        .hd__burger.is-open span:last-child{transform:translateY(-4px) rotate(-45deg)}
        @media(max-width:1280px){.hd__phone{display:none}}
        @media(max-width:1100px){.hd__nav,.hd__cta{display:none}.hd__burger{display:block}.hd__actions{margin-left:auto}}
        .mm{position:fixed;inset:0;z-index:790;background:radial-gradient(120% 80% at 100% 0%,var(--petrol),var(--night) 60%);color:#fff;overflow:hidden}
        .mm__nav{height:100%;overflow-y:auto;padding:110px var(--gutter) 40px;display:flex;flex-direction:column}
        .mm__nav>ul{list-style:none;margin:0;padding:0}
        .mm__link{display:block;font:700 clamp(30px,8vw,52px)/1.1 var(--font-display);padding:8px 0;letter-spacing:-.02em}
        .mm__sub{list-style:none;margin:0 0 14px;padding:0 0 0 4px;display:flex;flex-wrap:wrap;gap:8px 18px}
        .mm__sub a{font-size:15px;opacity:.7}
        .mm__foot{margin-top:auto;padding-top:36px;display:grid;gap:12px;justify-items:start;font-size:16px}
      `}</style>
    </>
  );
}
