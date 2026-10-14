"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { C, Glossy, Glow, SceneRig } from "./kit";

/** Local visibility: bouncing map pin with ripples, a search bar and an ad card. */
function Pin() {
  const ref = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      ref.current.position.y = 0.3 + Math.abs(Math.sin(t * 1.6)) * 0.45;
      ref.current.rotation.y = t * 0.6;
    }
    rings.current?.children.forEach((r, i) => {
      const p = (t * 0.45 + i / 3) % 1;
      r.scale.setScalar(0.4 + p * 2.2);
      ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.7;
    });
  });
  return (
    <group>
      <group ref={ref}>
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.55, 48, 48]} />
          <Glossy color={C.teal} emissive={C.teal} emissiveIntensity={0.15} />
        </mesh>
        <mesh position={[0, -0.05, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.47, 0.95, 48]} />
          <Glossy color={C.teal} emissive={C.teal} emissiveIntensity={0.15} />
        </mesh>
        <mesh position={[0, 0.55, 0.5]}>
          <circleGeometry args={[0.2, 32]} />
          <Glow color="#ffffff" />
        </mesh>
        <mesh position={[0, 0.55, -0.5]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[0.2, 32]} />
          <Glow color="#ffffff" />
        </mesh>
      </group>
      <group ref={rings} position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <ringGeometry args={[0.48, 0.52, 64]} />
            <meshBasicMaterial color={C.glow} transparent opacity={0.6} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, -0.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 64]} />
        <meshStandardMaterial color={C.night} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

export default function GoogleScene() {
  return (
    <SceneRig>
      <group rotation={[0.25, -0.3, 0]}>
        <Pin />
      </group>
      <Float speed={1.6} rotationIntensity={0.2} floatIntensity={0.5}>
        <group position={[-0.2, 1.65, 0.4]} rotation={[0, 0.2, 0]} scale={0.85}>
          <RoundedBox args={[2.8, 0.44, 0.12]} radius={0.21} smoothness={4}>
            <Glossy color="#ffffff" rough={0.3} />
          </RoundedBox>
          <mesh position={[-1.1, 0, 0.08]}>
            <torusGeometry args={[0.09, 0.025, 12, 32]} />
            <Glow color={C.teal} />
          </mesh>
          <mesh position={[-0.25, 0, 0.08]}>
            <planeGeometry args={[1.3, 0.07]} />
            <meshBasicMaterial color="#9bb7b9" />
          </mesh>
          {[C.teal, C.petrol, C.sun].map((c, i) => (
            <mesh key={c} position={[0.8 + i * 0.16, 0, 0.08]}>
              <circleGeometry args={[0.05, 16]} />
              <Glow color={c} />
            </mesh>
          ))}
        </group>
      </Float>
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.7}>
        <group position={[1.45, -0.15, 0.9]} rotation={[0, -0.4, 0.05]} scale={0.85}>
          <RoundedBox args={[1.25, 0.85, 0.08]} radius={0.08}>
            <Glossy color={C.night} rough={0.35} />
          </RoundedBox>
          <RoundedBox args={[0.42, 0.18, 0.04]} radius={0.05} position={[-0.3, 0.22, 0.05]}>
            <Glossy color={C.sun} />
          </RoundedBox>
          <mesh position={[0, -0.02, 0.05]}>
            <planeGeometry args={[1, 0.08]} />
            <meshBasicMaterial color="#e9f4f3" />
          </mesh>
          <mesh position={[-0.12, -0.2, 0.05]}>
            <planeGeometry args={[0.76, 0.06]} />
            <meshBasicMaterial color="#4b7d81" />
          </mesh>
        </group>
      </Float>
      <Float speed={2.4} floatIntensity={1}>
        <mesh position={[-1.9, -0.3, 0.6]}>
          <torusKnotGeometry args={[0.2, 0.06, 100, 16]} />
          <Glossy color={C.glow} />
        </mesh>
      </Float>
    </SceneRig>
  );
}
