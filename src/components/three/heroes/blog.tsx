"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig } from "./kit";

/** An open notebook whose pages keep turning. */
export default function BlogScene() {
  const pages = useRef<THREE.Group>(null);
  const N = 6;
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    pages.current?.children.forEach((p, i) => {
      // pages lie flat with the spine along z – flip them over the spine
      const k = (t * 0.28 + i / N) % 1;
      const eased = k < 0.15 ? 0 : k > 0.85 ? 1 : (k - 0.15) / 0.7;
      p.rotation.z = eased * Math.PI * 0.985;
    });
  });
  return (
    <SceneRig>
      <group rotation={[0.75, -0.35, 0.08]} scale={1.15}>
        {/* covers */}
        <RoundedBox args={[1.6, 0.08, 2.1]} radius={0.04} position={[-0.82, -0.08, 0]}>
          <Glossy color={C.petrol} />
        </RoundedBox>
        <RoundedBox args={[1.6, 0.08, 2.1]} radius={0.04} position={[0.82, -0.08, 0]}>
          <Glossy color={C.petrol} />
        </RoundedBox>
        <mesh position={[-0.8, 0.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.5, 2]} />
          <meshStandardMaterial color="#f4fbfa" />
        </mesh>
        <mesh position={[0.8, 0.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.5, 2]} />
          <meshStandardMaterial color="#f4fbfa" />
        </mesh>
        {[-0.6, -0.35, -0.1, 0.15, 0.4].map((z) => (
          <mesh key={z} position={[-0.85, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.1, 0.06]} />
            <meshBasicMaterial color={z < -0.5 ? C.teal : "#9bb7b9"} />
          </mesh>
        ))}
        <group ref={pages}>
          {Array.from({ length: N }, (_, i) => (
            <group key={i}>
              <mesh position={[0.75, 0.01 + i * 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[1.5, 2]} />
                <meshStandardMaterial color={i % 2 ? "#e9f4f3" : "#ffffff"} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </SceneRig>
  );
}
