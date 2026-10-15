"use client";

import { RoundedBox, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig } from "./kit";

/** Laptop opening to reveal a project screenshot (project pages now use the CSS DeviceStage instead). */
export default function LaptopScene({ image = "/media/2026/04/autopozzo.webp" }: { image?: string }) {
  const tex = useTexture(image);
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  }, [tex]);
  const lid = useRef<THREE.Group>(null);
  useFrame((s, d) => {
    const t = s.clock.elapsedTime;
    if (lid.current) lid.current.rotation.x = THREE.MathUtils.damp(lid.current.rotation.x, t < 0.4 ? Math.PI / 2 : -0.12, 2.2, d);
  });
  const aspect = tex.image ? (tex.image as HTMLImageElement).width / (tex.image as HTMLImageElement).height : 1.4;
  const sw = 2.9;
  const sh = 1.82;
  // cover-fit the screenshot into the screen
  tex.repeat.set(aspect > sw / sh ? sw / sh / aspect : 1, aspect > sw / sh ? 1 : aspect / (sw / sh));
  tex.offset.set((1 - tex.repeat.x) / 2, (1 - tex.repeat.y) / 2);
  return (
    <SceneRig scale={0.95} y={-0.1}>
      <group rotation={[0.32, -0.42, 0]}>
        <RoundedBox args={[3.2, 0.1, 2.1]} radius={0.04} position={[0, -1, 0.2]}>
          <Glossy color="#c9d6d5" metal={0.7} rough={0.25} />
        </RoundedBox>
        <mesh position={[0, -0.94, 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.7, 1]} />
          <meshStandardMaterial color="#2a3b3d" />
        </mesh>
        <group ref={lid} position={[0, -0.95, -0.85]} rotation={[Math.PI / 2, 0, 0]}>
          <group position={[0, 1.05, 0]}>
            <RoundedBox args={[3.2, 2.05, 0.07]} radius={0.04}>
              <Glossy color="#c9d6d5" metal={0.7} rough={0.25} />
            </RoundedBox>
            <mesh position={[0, 0, 0.04]}>
              <planeGeometry args={[sw, sh]} />
              <meshBasicMaterial map={tex} toneMapped={false} />
            </mesh>
          </group>
        </group>
        <mesh position={[0, -1.06, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.5, 3.4]} />
          <meshBasicMaterial color={C.glow} transparent opacity={0.08} />
        </mesh>
      </group>
    </SceneRig>
  );
}
