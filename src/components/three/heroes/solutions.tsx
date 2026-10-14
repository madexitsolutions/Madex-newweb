"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { MarkModel } from "../HeroScene";
import { C, Glossy, SceneRig } from "./kit";

/** Eight modules (one per solution) assembling around the Madex mark. */
export default function SolutionsScene() {
  const ref = useRef<THREE.Group>(null);
  const colors = [C.petrol, C.teal, C.glow, C.petrol, C.teal, C.sun, C.petrol, C.teal];
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    ref.current?.children.forEach((c, i) => {
      const a = (i / 8) * Math.PI * 2 + t * 0.25;
      const breathe = 1.75 + Math.sin(t * 0.9 + i) * 0.18;
      c.position.set(Math.cos(a) * breathe, Math.sin(a * 2 + t) * 0.35, Math.sin(a) * breathe);
      c.rotation.set(t * 0.4 + i, t * 0.3 + i * 0.5, 0);
    });
  });
  return (
    <SceneRig>
      <group scale={0.55}>
        <MarkModel />
      </group>
      <group ref={ref} rotation={[0.35, 0, 0]}>
        {colors.map((c, i) => (
          <RoundedBox key={i} args={[0.42, 0.42, 0.42]} radius={0.08} smoothness={4}>
            <Glossy color={c} />
          </RoundedBox>
        ))}
      </group>
    </SceneRig>
  );
}
