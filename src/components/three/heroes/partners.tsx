"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig, useExtrude } from "./kit";

/** Two puzzle pieces that keep finding each other – "Gemeinsam stärker". */
function usePiece(male: boolean) {
  return useExtrude((s) => {
    const w = 1.2;
    s.moveTo(-w / 2, -w / 2);
    s.lineTo(w / 2, -w / 2);
    s.lineTo(w / 2, -0.2);
    if (male) {
      s.absarc(w / 2 + 0.16, 0, 0.24, -Math.PI * 0.62, Math.PI * 0.62, false);
    } else {
      s.absarc(w / 2 - 0.16, 0, 0.24, -Math.PI * 0.38, Math.PI * 0.38, true);
    }
    s.lineTo(w / 2, 0.2);
    s.lineTo(w / 2, w / 2);
    s.lineTo(-w / 2, w / 2);
    s.lineTo(-w / 2, -w / 2);
  }, 0.32, 0.06, [male]);
}

export default function PartnersScene() {
  const male = usePiece(true);
  const female = usePiece(false);
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const gap = (Math.sin(t * 0.9) * 0.5 + 0.5) ** 2 * 0.9;
    if (a.current) {
      a.current.position.x = -0.68 - gap;
      a.current.rotation.z = -gap * 0.25;
    }
    if (b.current) {
      b.current.position.x = 0.68 + gap;
      b.current.rotation.z = gap * 0.25;
    }
  });
  return (
    <SceneRig scale={1.15}>
      <group rotation={[0.2, -0.35, 0]}>
        <group ref={a}>
          <mesh geometry={male}>
            <Glossy color={C.teal} />
          </mesh>
        </group>
        <group ref={b}>
          <mesh geometry={female} rotation={[0, Math.PI, 0]}>
            <Glossy color="#0b6c74" emissive={C.petrol} emissiveIntensity={0.25} />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.3]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color={C.glow} toneMapped={false} />
        </mesh>
      </group>
    </SceneRig>
  );
}
