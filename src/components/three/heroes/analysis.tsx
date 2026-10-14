"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig } from "./kit";

/** Exploding pie chart over a data grid with scatter points. */
function Pie() {
  const slices = [
    { a: 0.34, c: C.teal },
    { a: 0.26, c: C.petrol },
    { a: 0.22, c: C.glow },
    { a: 0.18, c: C.sun },
  ];
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) ref.current.rotation.y = t * 0.25;
    ref.current?.children.forEach((c, i) => {
      const mid = c.userData.mid as number;
      const out = 0.06 + (i === Math.floor(t / 2) % slices.length ? 0.22 : 0);
      c.position.x = THREE.MathUtils.lerp(c.position.x, Math.cos(mid) * out, 0.08);
      c.position.z = THREE.MathUtils.lerp(c.position.z, -Math.sin(mid) * out, 0.08);
    });
  });
  let start = 0;
  return (
    <group ref={ref}>
      {slices.map((s, i) => {
        const len = s.a * Math.PI * 2;
        const mid = start + len / 2;
        const el = (
          <mesh key={i} userData={{ mid }}>
            <cylinderGeometry args={[1, 1, 0.32 + i * 0.08, 48, 1, false, start, len]} />
            <Glossy color={s.c} />
          </mesh>
        );
        start += len;
        return el;
      })}
    </group>
  );
}

export default function AnalysisScene() {
  return (
    <SceneRig>
      <group rotation={[0.45, -0.4, 0]}>
        <gridHelper args={[4.4, 11, C.glow, "#0e4a50"]} position={[0, -0.25, 0]} />
        <group position={[-0.55, 0.05, 0.1]}>
          <Pie />
        </group>
        {[0.7, 1.1, 0.5, 1.5].map((h, i) => (
          <RoundedBox key={i} args={[0.28, h, 0.28]} radius={0.04} position={[1.15 + (i % 2) * 0.42, -0.25 + h / 2, -0.8 + Math.floor(i / 2) * 0.55]}>
            <Glossy color={i === 3 ? C.teal : C.petrol} />
          </RoundedBox>
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <Float key={i} speed={1 + (i % 4) * 0.3} floatIntensity={0.6}>
            <mesh position={[-1.9 + ((i * 37) % 38) / 10, 0.4 + ((i * 13) % 12) / 10, 1.2 - ((i * 7) % 10) / 10]}>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshBasicMaterial color={i % 3 ? C.glow : C.sun} toneMapped={false} />
            </mesh>
          </Float>
        ))}
      </group>
    </SceneRig>
  );
}
