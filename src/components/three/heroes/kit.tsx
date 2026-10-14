"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

export const C = {
  petrol: "#025159",
  teal: "#028D86",
  glow: "#4fe0d2",
  mint: "#9ff3ea",
  white: "#f4fbfa",
  sun: "#ffbe11",
  night: "#011b1e",
};

/**
 * Places a hero object to the right of the headline on desktop and below it on
 * mobile, adds pointer parallax and a gentle scroll-driven drift.
 */
export function SceneRig({ children, scale = 1, tilt = 0.35, y = 0 }: { children: ReactNode; scale?: number; tilt?: number; y?: number }) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const { viewport, size, pointer } = useThree();
  const mobile = size.width < 900;
  const s = (mobile ? 0.44 : Math.min(0.74, Math.max(0.6, size.width / 2100))) * scale;
  const px = mobile ? 0 : viewport.width * 0.255;
  // on mobile the scene sits in the space reserved below the copy
  const py = mobile ? -viewport.height / 2 + 1.25 : y - 0.15;

  useFrame((state, d) => {
    const scroll = Math.min(1.2, window.scrollY / window.innerHeight);
    if (outer.current) {
      outer.current.position.y = THREE.MathUtils.damp(outer.current.position.y, py + scroll * 1.1, 4, d);
    }
    if (inner.current) {
      inner.current.rotation.y = THREE.MathUtils.damp(inner.current.rotation.y, pointer.x * tilt + scroll * 0.6, 3, d);
      inner.current.rotation.x = THREE.MathUtils.damp(inner.current.rotation.x, -pointer.y * tilt * 0.6, 3, d);
    }
  });

  return (
    <group ref={outer} position={[px, py, 0]} scale={s}>
      <group ref={inner}>{children}</group>
    </group>
  );
}

type MatProps = { color?: string; rough?: number; metal?: number; emissive?: string; emissiveIntensity?: number; opacity?: number };

/** Glossy clear-coated brand material. */
export function Glossy({ color = C.petrol, rough = 0.18, metal = 0.2, emissive, emissiveIntensity = 0, opacity }: MatProps) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={rough}
      metalness={metal}
      clearcoat={1}
      clearcoatRoughness={0.08}
      envMapIntensity={1.3}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={emissiveIntensity}
      transparent={opacity !== undefined}
      opacity={opacity ?? 1}
    />
  );
}

/** Frosted glass (no transmission pass – cheap on mobile). */
export function Frost({ color = C.mint, opacity = 0.18 }: { color?: string; opacity?: number }) {
  return <meshPhysicalMaterial color={color} roughness={0.15} metalness={0} clearcoat={1} transparent opacity={opacity} envMapIntensity={1.6} depthWrite={false} side={THREE.DoubleSide} />;
}

/** Unlit glowing material for accents. */
export function Glow({ color = C.glow, opacity = 1 }: { color?: string; opacity?: number }) {
  return <meshBasicMaterial color={color} toneMapped={false} transparent={opacity < 1} opacity={opacity} />;
}

/** Build an extruded geometry from a 2D path (points in a unit-ish space, y up). */
export function useExtrude(build: (s: THREE.Shape) => void, depth = 0.2, bevel = 0.03, deps: unknown[] = []) {
  const key = JSON.stringify([depth, bevel, ...deps]);
  return useMemo(() => {
    const shape = new THREE.Shape();
    build(shape);
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 24 });
    g.center();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Rounded rectangle path helper. */
export function roundRect(s: THREE.Shape | THREE.Path, x: number, y: number, w: number, h: number, r: number) {
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
}

/** Gentle bob for individual elements. */
export function useBob(ref: React.RefObject<THREE.Object3D | null>, { speed = 1, amp = 0.08, phase = 0, rot = 0 } = {}) {
  const base = useRef<number | null>(null);
  useFrame((state) => {
    const o = ref.current;
    if (!o) return;
    if (base.current === null) base.current = o.position.y;
    const t = state.clock.elapsedTime * speed + phase;
    o.position.y = base.current + Math.sin(t) * amp;
    if (rot) o.rotation.z = Math.sin(t * 0.7) * rot;
  });
}
