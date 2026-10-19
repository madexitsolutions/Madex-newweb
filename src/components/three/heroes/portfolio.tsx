"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig } from "./kit";
import { layoutA, layoutB, layoutC, skeletonTexture } from "./skeleton";

/** Soft light band that sweeps across a skeleton, like a loading shimmer. */
function useShimmer() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 4;
    const c = canvas.getContext("2d")!;
    const g = c.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 4);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(0.45, 1);
    return t;
  }, []);
}

/** Three floating screens with website skeletons in the Madex palette. */
export default function PortfolioScene() {
  const textures = useMemo(() => [layoutA, layoutB, layoutC].map((d) => skeletonTexture(d)), []);
  const shimmer = useShimmer();
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

  const sweep = useMemo(
    () =>
      [0, 1, 2].map(() => {
        const s = shimmer.clone();
        s.needsUpdate = true;
        return s;
      }),
    [shimmer],
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    sweep.forEach((tex, i) => {
      tex.offset.x = -((t * 0.35 + i * 0.33) % 1.6) + 0.6;
    });
  });

  const frames = [
    { p: [-1.05, 0.6, -0.7], r: [0, 0.35, 0.03], s: 0.82 },
    { p: [0.25, -0.15, 0.4], r: [0, -0.22, -0.02], s: 1.05 },
    { p: [1.25, 1.0, -1.0], r: [0, -0.5, 0.04], s: 0.74 },
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
              <meshBasicMaterial map={textures[i]} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, 0.047]}>
              <planeGeometry args={[1.96, 1.36]} />
              <meshBasicMaterial map={sweep[i]} transparent opacity={0.35} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
        </Float>
      ))}
    </SceneRig>
  );
}
