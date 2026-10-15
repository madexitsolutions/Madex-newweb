"use client";

import { Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { MarkModel } from "../HeroScene";
import { C, Glossy, SceneRig } from "./kit";

/** The Madex mark at the centre, its eight solutions travelling on two orbits. */
const ORBITS = [
  { r: 1.9, tilt: [0.95, 0.2, 0.4] as [number, number, number], speed: 0.32, items: 4, color: C.teal },
  { r: 2.35, tilt: [1.05, -0.25, -0.5] as [number, number, number], speed: -0.22, items: 4, color: C.glow },
];

function Orbit({ r, tilt, speed, items, color, offset }: (typeof ORBITS)[number] & { offset: number }) {
  const group = useRef<THREE.Group>(null);
  const colors = useMemo(() => [C.teal, C.sun, "#f4fbfa", C.petrol], []);
  useFrame((s) => {
    const t = s.clock.elapsedTime * speed + offset;
    group.current?.children.forEach((c, i) => {
      const a = t + (i / items) * Math.PI * 2;
      c.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    });
  });
  return (
    <group rotation={tilt}>
      <mesh>
        <torusGeometry args={[r, 0.008, 8, 200]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} toneMapped={false} />
      </mesh>
      <group ref={group}>
        {Array.from({ length: items }, (_, i) => (
          <group key={i}>
            <mesh>
              <sphereGeometry args={[0.15 + (i % 2) * 0.05, 48, 48]} />
              <Glossy color={colors[(i + offset * 2) % colors.length]} rough={0.12} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.3, 24, 24]} />
              <meshBasicMaterial color={C.glow} transparent opacity={0.06} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export default function SolutionsScene() {
  return (
    <SceneRig scale={0.95}>
      <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.4}>
        <group scale={0.85}>
          <MarkModel />
        </group>
      </Float>
      {ORBITS.map((o, i) => (
        <Orbit key={i} {...o} offset={i} />
      ))}
    </SceneRig>
  );
}
