"use client";

import { motion, useInView, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import {
  Children,
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type PointerEvent,
  type ReactNode,
} from "react";

const ease = [0.16, 1, 0.3, 1] as const;

/** Fade + rise when entering the viewport. */
export function Reveal({
  children,
  delay = 0,
  y = 40,
  className,
  as = "div",
  once = true,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "span" | "p" | "figure";
  once?: boolean;
  style?: CSSProperties;
}) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 1.1, delay, ease }}
    >
      {children}
    </Comp>
  );
}

/** Staggered children reveal. */
export function Stagger({ children, className, gap = 0.08, as = "div" }: { children: ReactNode; className?: string; gap?: number; as?: "div" | "ul" | "ol" }) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {Children.map(children, (child) => (
        <motion.div
          style={{ display: "contents" }}
          variants={{ hidden: { opacity: 0, y: 36 }, show: { opacity: 1, y: 0, transition: { duration: 0.9, ease } } }}
        >
          {child}
        </motion.div>
      ))}
    </Comp>
  );
}

/** Stagger item helper that actually animates (display:contents children can't transform). */
export function StaggerItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" | "article" }) {
  const Comp = motion[as];
  return (
    <Comp className={className} variants={{ hidden: { opacity: 0, y: 40 }, show: { opacity: 1, y: 0, transition: { duration: 0.9, ease } } }}>
      {children}
    </Comp>
  );
}

export function StaggerGroup({ children, className, gap = 0.08, as = "div" }: { children: ReactNode; className?: string; gap?: number; as?: "div" | "ul" | "ol" }) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </Comp>
  );
}

/**
 * Splits a heading into words that slide up from a mask. Text stays real text
 * for screen readers and SEO.
 */
export function SplitText({
  text,
  as = "h2",
  className,
  delay = 0,
  stagger = 0.045,
  immediate = false,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  stagger?: number;
  immediate?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const show = immediate || inView;
  const lines = text.split("\n");
  let wordIndex = 0;
  return createElement(
    as,
    { ref, className, "aria-label": text.replace(/\n/g, " ") },
    lines.map((line, li) => (
      <span key={li} className="split-row" aria-hidden="true" style={{ display: "block" }}>
        {line.split(" ").map((word, wi) => {
          const i = wordIndex++;
          return (
            <span key={wi} className="split-line" style={{ display: "inline-block", marginRight: "0.24em" }}>
              <motion.span
                initial={{ y: "110%", rotate: 4 }}
                animate={show ? { y: "0%", rotate: 0 } : undefined}
                transition={{ duration: 1.05, delay: delay + i * stagger, ease }}
              >
                {word}
              </motion.span>
            </span>
          );
        })}
      </span>
    )),
  );
}

/** Vertical parallax based on element position in viewport. */
export function Parallax({ children, speed = 0.15, className, style }: { children: ReactNode; speed?: number; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [`${speed * 100}%`, `${-speed * 100}%`]);
  return (
    <motion.div ref={ref} className={className} style={{ ...style, y }}>
      {children}
    </motion.div>
  );
}

/** Image that scales down/clips in while scrolling into view. */
export function ScrollZoom({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.25, 1]);
  const clip = useTransform(scrollYProgress, [0, 1], ["inset(12% 10% 12% 10% round 36px)", "inset(0% 0% 0% 0% round 28px)"]);
  return (
    <motion.div ref={ref} className={className} style={{ ...style, clipPath: clip, overflow: "hidden" }}>
      <motion.div style={{ scale, height: "100%" }}>{children}</motion.div>
    </motion.div>
  );
}

/** Element follows the pointer slightly (buttons, icons). */
export function Magnetic({ children, strength = 0.35, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 200, damping: 15, mass: 0.4 });
  const y = useSpring(0, { stiffness: 200, damping: 15, mass: 0.4 });
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = ref.current!.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };
  return (
    <motion.div ref={ref} className={className} style={{ x, y, display: "inline-block" }} onPointerMove={onMove} onPointerLeave={reset}>
      {children}
    </motion.div>
  );
}

/** 3D tilt card with moving glare. */
export function Tilt({ children, className, max = 10, style }: { children: ReactNode; className?: string; max?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(0, { stiffness: 150, damping: 18 });
  const ry = useSpring(0, { stiffness: 150, damping: 18 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const glare = useTransform([gx, gy] as MotionValue<number>[], ([a, b]) => `radial-gradient(circle at ${a}% ${b}%, rgba(255,255,255,.28), transparent 55%)`);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = ref.current!.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * max * 2);
    rx.set(-(py - 0.5) * max * 2);
    gx.set(px * 100);
    gy.set(py * 100);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };
  return (
    <div style={{ perspective: 1100, ...style }} className={className}>
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={reset}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", height: "100%", position: "relative" }}
      >
        {children}
        <motion.div aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", background: glare, mixBlendMode: "soft-light" }} />
      </motion.div>
    </div>
  );
}

/** Animated number when scrolled into view. */
export function CountUp({ to, duration = 1.8, prefix = "", suffix = "" }: { to: number; duration?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      setVal(Math.round(to * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return (
    <span ref={ref}>
      {prefix}
      {val}
      {suffix}
    </span>
  );
}

/** Infinite horizontal marquee; speed reacts to scroll velocity. */
export function Marquee({ children, speed = 40, reverse = false, className }: { children: ReactNode; speed?: number; reverse?: boolean; className?: string }) {
  return (
    <div className={`marquee ${className ?? ""}`}>
      <div className="marquee__track" style={{ animationDuration: `${speed}s`, animationDirection: reverse ? "reverse" : "normal" }}>
        <div className="marquee__group">{children}</div>
        <div className="marquee__group" aria-hidden="true">
          {children}
        </div>
      </div>
      <style>{`
        .marquee{overflow:hidden;position:relative;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
        .marquee__track{display:flex;width:max-content;animation:marquee linear infinite}
        .marquee:hover .marquee__track{animation-play-state:paused}
        .marquee__group{display:flex;align-items:center;flex:none}
        @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
      `}</style>
    </div>
  );
}
