"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { C, Frost, Glossy, Glow, SceneRig } from "./kit";

/** Magnifier sweeping over search results; the top result lifts and glows. */
export default function SeoScene() {
  const lens = useRef<THREE.Group>(null);
  const first = useRef<THREE.Group>(null);
  useFrame((s, d) => {
    const t = s.clock.elapsedTime;
    if (lens.current) {
      lens.current.position.x = Math.sin(t * 0.6) * 0.9 + 0.3;
      lens.current.position.y = 0.35 + Math.cos(t * 0.9) * 0.35;
    }
    if (first.current) first.current.position.z = THREE.MathUtils.damp(first.current.position.z, 0.35 + Math.sin(t * 1.5) * 0.08, 4, d);
  });
  const rows = [0.95, 0.3, -0.35, -1.0];
  return (
    <SceneRig>
      <group rotation={[0.05, -0.35, 0]}>
        {/* search bar */}
        <RoundedBox args={[3, 0.42, 0.1]} radius={0.2} position={[0, 1.75, 0]}>
          <Glossy color="#ffffff" rough={0.3} />
        </RoundedBox>
        <mesh position={[-1.2, 1.75, 0.07]}>
          <torusGeometry args={[0.09, 0.025, 12, 32]} />
          <Glow color={C.teal} />
        </mesh>
        <mesh position={[-0.3, 1.75, 0.07]}>
          <planeGeometry args={[1.4, 0.07]} />
          <meshBasicMaterial color="#9bb7b9" />
        </mesh>
        {rows.map((y, i) => (
          <group key={y} ref={i === 0 ? first : undefined} position={[0, y, 0]}>
            <RoundedBox args={[3, 0.5, 0.06]} radius={0.06}>
              <Glossy color={i === 0 ? C.teal : C.night} emissive={i === 0 ? C.teal : "#000"} emissiveIntensity={i === 0 ? 0.3 : 0} rough={0.3} />
            </RoundedBox>
            <mesh position={[-1.25, 0.1, 0.04]}>
              <circleGeometry args={[0.1, 24]} />
              <Glow color={i === 0 ? C.sun : C.glow} opacity={i === 0 ? 1 : 0.6} />
            </mesh>
            <mesh position={[-0.2, 0.1, 0.04]}>
              <planeGeometry args={[1.7, 0.08]} />
              <meshBasicMaterial color={i === 0 ? "#ffffff" : "#4b7d81"} />
            </mesh>
            <mesh position={[-0.45, -0.08, 0.04]}>
              <planeGeometry args={[1.2, 0.05]} />
              <meshBasicMaterial color={i === 0 ? "#bff5ee" : "#2b5c60"} />
            </mesh>
          </group>
        ))}
        <group ref={lens} position={[0.3, 0.35, 0.9]}>
          <mesh>
            <torusGeometry args={[0.55, 0.08, 24, 72]} />
            <Glossy color={C.petrol} metal={0.5} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.52, 48]} />
            <Frost opacity={0.22} />
          </mesh>
          <mesh position={[0.62, -0.62, 0]} rotation={[0, 0, Math.PI / 4]}>
            <capsuleGeometry args={[0.09, 0.6, 8, 16]} />
            <Glossy color={C.teal} />
          </mesh>
        </group>
      </group>
      <Float speed={2} floatIntensity={1}>
        <mesh position={[1.9, 1.5, -0.3]}>
          <octahedronGeometry args={[0.22]} />
          <Glossy color={C.sun} />
        </mesh>
      </Float>
    </SceneRig>
  );
}
