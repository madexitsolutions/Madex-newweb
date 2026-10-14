"use client";

import { Float, RoundedBox, useTexture } from "@react-three/drei";
import { useEffect } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig } from "./kit";

const COVERS = ["/media/2026/04/autopozzo.webp", "/media/2026/04/miladopiz.webp", "/media/2026/04/serrano-2.webp"];

/** Three floating screens showing real projects. */
export default function PortfolioScene() {
  const tex = useTexture(COVERS);
  useEffect(() => {
    tex.forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    });
  }, [tex]);
  const frames = [
    { p: [-0.9, 0.55, -0.6], r: [0, 0.35, 0.03], s: 0.85 },
    { p: [0.25, -0.1, 0.4], r: [0, -0.25, -0.02], s: 1.05 },
    { p: [1.15, 0.95, -0.9], r: [0, -0.5, 0.04], s: 0.75 },
  ];
  return (
    <SceneRig>
      {frames.map((f, i) => (
        <Float key={i} speed={1.2 + i * 0.3} floatIntensity={0.6} rotationIntensity={0.2}>
          <group position={f.p as [number, number, number]} rotation={f.r as [number, number, number]} scale={f.s}>
            <RoundedBox args={[2.1, 1.5, 0.08]} radius={0.06} smoothness={4}>
              <Glossy color={i === 1 ? C.teal : C.petrol} />
            </RoundedBox>
            <mesh position={[0, 0, 0.045]}>
              <planeGeometry args={[1.96, 1.36]} />
              <meshBasicMaterial map={tex[i]} toneMapped={false} />
            </mesh>
          </group>
        </Float>
      ))}
    </SceneRig>
  );
}
