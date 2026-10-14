"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Suspense, useEffect, useRef } from "react";
import { CanvasShell } from "./CanvasShell";
import { MarkSvg } from "@/components/ui/MarkSvg";
import type { RingItem } from "./ProjectRing";
import { heroScenes, type HeroSceneKey } from "./heroes/registry";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });
const ShaderBackdrop = dynamic(() => import("./ShaderBackdrop"), { ssr: false });
const ServicesOrbit = dynamic(() => import("./ServicesOrbit"), { ssr: false });
const ProjectRing = dynamic(() => import("./ProjectRing"), { ssr: false });
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

export function HeroCanvas({ className }: { className?: string }) {
  const progress = useScrollProgress(1);
  return (
    <CanvasShell
      className={className}
      eager
      camera={{ position: [0, 0, 7], fov: 38 }}
      fallback={
        <div className="hero-fallback">
          <Image src="/media/brand/business-cover.webp" alt="" fill priority sizes="100vw" style={{ objectFit: "cover", opacity: 0.35 }} />
          <MarkSvg className="hero-fallback__mark" />
        </div>
      }
    >
      <HeroScene scrollRef={progress} />
    </CanvasShell>
  );
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

export function RingCanvas({ className, items, onOpen, onHover }: { className?: string; items: RingItem[]; onOpen: (href: string) => void; onHover?: (t: string | null) => void }) {
  return (
    <CanvasShell className={className} camera={{ position: [0, 1, 10], fov: 40 }} fallback={null}>
      <ProjectRing items={items} onOpen={onOpen} onHover={onHover} />
    </CanvasShell>
  );
}
