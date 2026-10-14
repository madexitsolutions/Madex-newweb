"use client";

import { Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Frost, Glossy, SceneRig } from "./kit";

/** Rocket on the rise with an exhaust trail – "Treten Sie unserem Team bei". */
function Rocket() {
  const body = useMemo(() => {
    const pts = [
      [0, -1.1], [0.38, -1.0], [0.48, -0.4], [0.46, 0.3], [0.36, 0.8], [0.18, 1.15], [0, 1.3],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 64);
  }, []);
  return (
    <group>
      <mesh geometry={body}>
        <Glossy color="#f4fbfa" rough={0.2} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <coneGeometry args={[0.31, 0.5, 48]} />
        <Glossy color={C.teal} />
      </mesh>
      <mesh position={[0, 0.25, 0.42]}>
        <torusGeometry args={[0.17, 0.045, 16, 48]} />
        <Glossy color={C.petrol} metal={0.6} />
      </mesh>
      <mesh position={[0, 0.25, 0.43]}>
        <circleGeometry args={[0.14, 32]} />
        <Frost color={C.glow} opacity={0.6} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0, (i / 3) * Math.PI * 2, 0]}>
          <mesh position={[0.5, -0.8, 0]} rotation={[0, 0, -0.2]}>
            <boxGeometry args={[0.36, 0.55, 0.06]} />
            <Glossy color={C.teal} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -1.12, 0]}>
        <cylinderGeometry args={[0.26, 0.32, 0.12, 32]} />
        <Glossy color={C.petrol} metal={0.6} />
      </mesh>
    </group>
  );
}

function Exhaust() {
  const ref = useRef<THREE.Group>(null);
  const puffs = 18;
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    ref.current?.children.forEach((p, i) => {
      const k = (t * 0.9 + i / puffs) % 1;
      p.position.set(Math.sin(i * 12.9) * 0.25 * k, -1.3 - k * 2.2, Math.cos(i * 7.3) * 0.25 * k);
      p.scale.setScalar(0.15 + k * 0.45);
      ((p as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.75;
    });
  });
  return (
    <group ref={ref}>
      {Array.from({ length: puffs }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color={i % 3 ? C.glow : C.sun} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function CareerScene() {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (ref.current) ref.current.position.y = Math.sin(s.clock.elapsedTime * 2.2) * 0.06;
  });
  return (
    <SceneRig scale={0.95} y={0.2}>
      <group rotation={[0, 0, -0.5]}>
        <group ref={ref}>
          <Rocket />
          <Exhaust />
        </group>
      </group>
      {[[-1.8, 1.4], [1.7, 1.6], [1.9, -1.2], [-1.4, -1.6]].map(([x, y], i) => (
        <Float key={i} speed={1.5 + i * 0.3} floatIntensity={0.8}>
          <mesh position={[x, y, -0.6]}>
            <octahedronGeometry args={[0.1 + (i % 2) * 0.06]} />
            <meshBasicMaterial color={i % 2 ? C.sun : "#ffffff"} toneMapped={false} />
          </mesh>
        </Float>
      ))}
    </SceneRig>
  );
}
