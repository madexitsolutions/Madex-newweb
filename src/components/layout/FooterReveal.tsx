"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Footer content rises out of the page as the visitor reaches the end. A fixed
 * small distance (a percentage of the tall mobile footer would hide its top),
 * only on larger screens and without reduced motion.
 */
export function FooterReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [wide, setWide] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const y = useTransform(scrollYProgress, [0, 1], [-60, 0]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div ref={ref} style={{ overflow: "hidden", background: "var(--night)" }}>
      <motion.div style={{ y: wide && !reduce ? y : 0 }}>{children}</motion.div>
    </div>
  );
}
