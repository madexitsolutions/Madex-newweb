"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useRef } from "react";
import { CanvasShell } from "./CanvasShell";
import { MarkSvg } from "@/components/ui/MarkSvg";
import { heroScenes, type HeroSceneKey } from "./heroes/registry";

const ShaderBackdrop = dynamic(() => import("./ShaderBackdrop"), { ssr: false });
const ServicesOrbit = dynamic(() => import("./ServicesOrbit"), { ssr: false });
const FloatingMark = dynamic(() => import("./FloatingMark"), { ssr: false });
const SceneLights = dynamic(() => import("./SceneLights"), { ssr: false });

function useScrollProgress(distance = 1) {
  const ref = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      ref.current = window.scrollY / (window.innerHeight * distance);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [distance]);
  return ref;
}

export function BackdropCanvas({ className, intensity = 1, withMark = false, scene, sceneProps }: { className?: string; intensity?: number; withMark?: boolean; scene?: HeroSceneKey; sceneProps?: { image?: string } }) {
  const progress = useScrollProgress(1);
  const Themed = scene ? heroScenes[scene] : null;
  return (
    <CanvasShell
      className={className}
      eager
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 7], fov: 38 }}
      fallback={<div className="backdrop-fallback" />}
    >
      <ShaderBackdrop intensity={intensity} />
      {Themed ? (
        <Suspense fallback={null}>
          <SceneLights />
          <Themed {...sceneProps} />
        </Suspense>
      ) : (
        withMark && <FloatingMark scrollRef={progress} />
      )}
    </CanvasShell>
  );
}

export function OrbitCanvas({ className, count, focus, highlight, onSelect, onHover }: { className?: string; count: number; focus: number; highlight: number | null; onSelect: (i: number) => void; onHover: (i: number | null) => void }) {
  return (
    <CanvasShell className={className} camera={{ position: [0, 1.4, 7.4], fov: 40 }} fallback={<div className="orbit-fallback"><MarkSvg /></div>}>
      <ServicesOrbit count={count} focus={focus} highlight={highlight} onSelect={onSelect} onHover={onHover} />
    </CanvasShell>
  );
}
