"use client";

import { Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig } from "./kit";

/** 404: a glossy question mark slowly turning, small fragments drifting around it. */
function QuestionMark() {
  const geo = useMemo(() => {
    const path = new THREE.CatmullRomCurve3(
      [
        [-0.62, 0.62, 0],
        [-0.5, 1.05, 0],
        [-0.05, 1.3, 0],
        [0.45, 1.18, 0],
        [0.66, 0.8, 0],
        [0.5, 0.38, 0],
        [0.12, 0.12, 0],
        [0.02, -0.15, 0],
        [0.02, -0.45, 0],
      ].map((p) => new THREE.Vector3(...(p as [number, number, number]))),
      false,
      "catmullrom",
      0.5,
    );
    return new THREE.TubeGeometry(path, 160, 0.17, 32, false);
  }, []);
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.5) * 0.6;
  });
  return (
    <group ref={ref} position={[0, -0.2, 0]}>
      <mesh geometry={geo}>
        <Glossy color={C.teal} rough={0.12} />
      </mesh>
      {/* rounded caps */}
      <mesh position={[-0.62, 0.62, 0]}>
        <sphereGeometry args={[0.17, 32, 32]} />
        <Glossy color={C.teal} rough={0.12} />
      </mesh>
      <mesh position={[0.02, -0.45, 0]}>
        <sphereGeometry args={[0.17, 32, 32]} />
        <Glossy color={C.teal} rough={0.12} />
      </mesh>
      <mesh position={[0.02, -0.95, 0]}>
        <sphereGeometry args={[0.22, 48, 48]} />
        <Glossy color={C.sun} rough={0.15} />
      </mesh>
    </group>
  );
}

function Fragments() {
  const items = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        pos: [Math.cos(i * 0.7) * (2.0 + (i % 3) * 0.4), Math.sin(i * 1.3) * 1.6, -0.6 + Math.sin(i * 0.9) * 0.6] as [number, number, number],
        s: 0.05 + (i % 4) * 0.025,
        c: [C.petrol, C.glow, "#f4fbfa", C.teal][i % 4],
      })),
    [],
  );
  return (
    <>
      {items.map((it, i) => (
        <Float key={i} speed={1 + (i % 3) * 0.6} rotationIntensity={2} floatIntensity={1.2}>
          <mesh position={it.pos}>
            <boxGeometry args={[it.s * 2, it.s * 2, it.s * 2]} />
            <Glossy color={it.c} rough={0.2} />
          </mesh>
        </Float>
      ))}
    </>
  );
}

export default function LostScene() {
  return (
    <SceneRig scale={1.1}>
      <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.6}>
        <QuestionMark />
      </Float>
      <Fragments />
    </SceneRig>
  );
}
