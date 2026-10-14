"use client";

import { Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig } from "./kit";

/** Three interlocking rings – Zusammenarbeit, Ehrlichkeit, Innovation. */
export default function AboutScene() {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    ref.current?.children.forEach((c, i) => {
      c.rotation.x = Math.PI / 2 + Math.sin(t * 0.5 + i * 2) * 0.35 + (i === 1 ? Math.PI / 2 : 0);
      c.rotation.y = t * 0.3 * (i % 2 ? -1 : 1) + i * 1.1;
    });
  });
  const rings = [
    { c: C.petrol, p: [-0.55, 0.25, 0] },
    { c: C.teal, p: [0.55, 0.25, 0] },
    { c: C.glow, p: [0, -0.55, 0] },
  ];
  return (
    <SceneRig>
      <Float speed={1.3} floatIntensity={0.5} rotationIntensity={0.2}>
        <group ref={ref}>
          {rings.map((r, i) => (
            <mesh key={i} position={r.p as [number, number, number]}>
              <torusGeometry args={[1.05, 0.13, 32, 128]} />
              <Glossy color={r.c} metal={0.35} emissive={i === 2 ? C.teal : "#000"} emissiveIntensity={0.15} />
            </mesh>
          ))}
        </group>
      </Float>
      <mesh>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </SceneRig>
  );
}
