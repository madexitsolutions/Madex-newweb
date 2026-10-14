"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

/** Footer content rises out of the page as the visitor reaches the end. */
export function FooterReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-22%", "0%"]);
  return (
    <div ref={ref} style={{ overflow: "hidden", background: "var(--night)" }}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
