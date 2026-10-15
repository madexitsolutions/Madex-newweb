"use client";

import dynamic from "next/dynamic";
import type { CanvasProps } from "@react-three/fiber";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { hasWebGL, isLowPower } from "@/lib/hooks";

const Canvas = dynamic(() => import("./CanvasRoot"), { ssr: false });

type Props = {
  children: ReactNode;
  fallback: ReactNode;
  className?: string;
  camera?: CanvasProps["camera"];
  eager?: boolean;
  dpr?: [number, number];
};

/**
 * Mounts a WebGL canvas only when it approaches the viewport, pauses rendering
 * when off-screen and renders a static fallback for reduced motion, missing
 * WebGL or weak devices. Canvas content is always decorative.
 */
export function CanvasShell({ children, fallback, className, camera, eager = false, dpr = [1, 1.75] }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"pending" | "webgl" | "fallback">("pending");
  const [near, setNear] = useState(eager);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !hasWebGL() || isLowPower()) {
      setMode("fallback");
      return;
    }
    // three.js is ~230 KB gzipped: fetch it only once the page has painted and gone idle
    let idle = 0;
    const start = () => {
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
      idle = ric(() => setMode("webgl"), { timeout: 2000 }) as number;
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      window.cancelIdleCallback?.(idle);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setNear(true);
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} aria-hidden="true" style={{ position: "relative" }}>
      {mode === "fallback" && fallback}
      {mode === "webgl" && near && (
        <Canvas
          dpr={dpr}
          camera={camera ?? { position: [0, 0, 6], fov: 40 }}
          frameloop={visible ? "always" : "never"}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          style={{ position: "absolute", inset: 0 }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          {children}
        </Canvas>
      )}
    </div>
  );
}
