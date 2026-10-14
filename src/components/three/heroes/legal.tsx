"use client";

import { Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig, useExtrude } from "./kit";

/** Shield with padlock – Datenschutz & Rechtliches. */
export default function LegalScene() {
  const shield = useExtrude((s) => {
    s.moveTo(0, 1.25);
    s.bezierCurveTo(0.45, 1.05, 0.8, 1.0, 1.0, 1.0);
    s.bezierCurveTo(1.0, 0.1, 0.75, -0.75, 0, -1.25);
    s.bezierCurveTo(-0.75, -0.75, -1.0, 0.1, -1.0, 1.0);
    s.bezierCurveTo(-0.8, 1.0, -0.45, 1.05, 0, 1.25);
  }, 0.3, 0.07);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ring.current) ring.current.rotation.z = s.clock.elapsedTime * 0.5;
  });
  return (
    <SceneRig>
      <Float speed={1.3} floatIntensity={0.5} rotationIntensity={0.3}>
        <group rotation={[0, -0.3, 0]}>
          <mesh geometry={shield}>
            <Glossy color={C.petrol} metal={0.35} />
          </mesh>
          <group position={[0, -0.05, 0.3]} scale={0.8}>
            <mesh position={[0, -0.15, 0]}>
              <boxGeometry args={[0.9, 0.7, 0.25]} />
              <Glossy color={C.teal} metal={0.5} />
            </mesh>
            <mesh position={[0, 0.25, 0]}>
              <torusGeometry args={[0.3, 0.07, 16, 48, Math.PI]} />
              <Glossy color="#dfe9e8" metal={0.9} rough={0.15} />
            </mesh>
            <mesh position={[0, -0.12, 0.13]}>
              <circleGeometry args={[0.08, 24]} />
              <meshBasicMaterial color={C.night} />
            </mesh>
          </group>
        </group>
      </Float>
      <mesh ref={ring}>
        <torusGeometry args={[1.85, 0.012, 8, 160]} />
        <meshBasicMaterial color={C.glow} transparent opacity={0.5} toneMapped={false} />
      </mesh>
    </SceneRig>
  );
}
