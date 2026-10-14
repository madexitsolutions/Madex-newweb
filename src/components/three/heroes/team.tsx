"use client";

import { Float, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig } from "./kit";

function Person({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <Glossy color={color} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <capsuleGeometry args={[0.26, 0.42, 8, 24]} />
        <Glossy color={color} />
      </mesh>
    </group>
  );
}

/** Abstract team in a circle around a glowing core, connected by light. */
export default function TeamScene() {
  const ring = useRef<THREE.Group>(null);
  const n = 7;
  const pos = useMemo(() => Array.from({ length: n }, (_, i) => new THREE.Vector3(Math.cos((i / n) * Math.PI * 2) * 1.8, 0, Math.sin((i / n) * Math.PI * 2) * 1.8)), []);
  const colors = [C.teal, C.petrol, C.glow, C.petrol, C.teal, C.sun, C.petrol];
  useFrame((s, d) => {
    if (ring.current) ring.current.rotation.y += d * 0.22;
    ring.current?.children.forEach((c, i) => {
      if (c.userData.person) c.position.y = Math.sin(s.clock.elapsedTime * 1.6 + i) * 0.1;
    });
  });
  return (
    <SceneRig scale={0.85}>
      <group rotation={[0.35, 0, 0]}>
        <group ref={ring}>
          {pos.map((p, i) => (
            <group key={i} position={p} userData={{ person: true }}>
              <group position={[0, 0, 0]}>
                <Person color={colors[i]} />
              </group>
            </group>
          ))}
          {pos.map((p, i) => (
            <Line key={`l${i}`} points={[new THREE.Vector3(0, 0.3, 0), p.clone().setY(0.3)]} color={C.glow} lineWidth={1} transparent opacity={0.35} />
          ))}
        </group>
        <Float speed={2} floatIntensity={0.6}>
          <mesh position={[0, 0.35, 0]}>
            <icosahedronGeometry args={[0.42, 1]} />
            <meshStandardMaterial color={C.teal} emissive={C.glow} emissiveIntensity={0.9} flatShading />
          </mesh>
        </Float>
        <mesh position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 2.1, 96]} />
          <meshBasicMaterial color={C.teal} transparent opacity={0.18} />
        </mesh>
      </group>
    </SceneRig>
  );
}
