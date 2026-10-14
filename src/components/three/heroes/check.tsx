"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig, useExtrude } from "./kit";

/** Clipboard being scanned – checkmarks pop in one after another. */
export default function CheckScene() {
  const tick = useExtrude((s) => {
    s.moveTo(-0.2, 0.02);
    s.lineTo(-0.07, -0.12);
    s.lineTo(0.22, 0.17);
    s.lineTo(0.17, 0.22);
    s.lineTo(-0.07, -0.02);
    s.lineTo(-0.15, 0.07);
  }, 0.06, 0.015);
  const checks = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime % 4;
    if (beam.current) beam.current.position.y = 1 - (t / 4) * 2.4;
    checks.current?.children.forEach((c, i) => {
      const on = t > 0.6 + i * 0.75;
      c.scale.setScalar(THREE.MathUtils.lerp(c.scale.x, on ? 1 : 0.001, 0.18));
    });
  });
  const rows = [0.75, 0.25, -0.25, -0.75];
  return (
    <SceneRig>
      <group rotation={[0.1, -0.4, 0.04]}>
        <RoundedBox args={[2.2, 2.9, 0.1]} radius={0.1}>
          <Glossy color={C.petrol} />
        </RoundedBox>
        <RoundedBox args={[1.95, 2.55, 0.04]} radius={0.05} position={[0, -0.08, 0.06]}>
          <meshStandardMaterial color="#f4fbfa" />
        </RoundedBox>
        <RoundedBox args={[0.8, 0.26, 0.14]} radius={0.06} position={[0, 1.42, 0.06]}>
          <Glossy color={C.teal} metal={0.5} />
        </RoundedBox>
        {rows.map((y) => (
          <group key={y}>
            <RoundedBox args={[0.32, 0.32, 0.03]} radius={0.05} position={[-0.6, y - 0.08, 0.09]}>
              <meshStandardMaterial color="#d7e7e6" />
            </RoundedBox>
            <mesh position={[0.25, y - 0.08, 0.09]}>
              <planeGeometry args={[1, 0.08]} />
              <meshBasicMaterial color="#9bb7b9" />
            </mesh>
          </group>
        ))}
        <group ref={checks}>
          {rows.map((y) => (
            <mesh key={y} geometry={tick} position={[-0.6, y - 0.08, 0.16]} scale={0.001}>
              <Glossy color={C.teal} emissive={C.teal} emissiveIntensity={0.5} />
            </mesh>
          ))}
        </group>
        <mesh ref={beam} position={[0, 1, 0.18]}>
          <planeGeometry args={[2.3, 0.05]} />
          <meshBasicMaterial color={C.glow} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      </group>
    </SceneRig>
  );
}
