"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Frost, Glossy, Glow, SceneRig, useExtrude } from "./kit";

function Camera() {
  const lens = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (lens.current) lens.current.rotation.z = s.clock.elapsedTime * 0.4;
  });
  return (
    <group>
      <RoundedBox args={[2, 1.3, 0.8]} radius={0.14} smoothness={4}>
        <Glossy color={C.night} rough={0.35} metal={0.3} />
      </RoundedBox>
      <RoundedBox args={[0.7, 0.3, 0.55]} radius={0.08} position={[-0.45, 0.75, 0]}>
        <Glossy color={C.petrol} />
      </RoundedBox>
      <mesh position={[0.62, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.12, 32]} />
        <Glossy color={C.teal} metal={0.6} />
      </mesh>
      <group ref={lens} position={[0.05, -0.02, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        {[
          [0.58, 0.2, C.petrol],
          [0.5, 0.42, "#0a2b2f"],
          [0.42, 0.62, C.teal],
        ].map(([r, y, c], i) => (
          <mesh key={i} position={[0, (y as number) / 2, 0]}>
            <cylinderGeometry args={[r as number, r as number, 0.2, 48]} />
            <Glossy color={c as string} metal={0.55} />
          </mesh>
        ))}
        <mesh position={[0, 0.74, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.36, 48]} />
          <Frost color={C.glow} opacity={0.45} />
        </mesh>
      </group>
      <mesh position={[-0.75, 0.38, 0.41]}>
        <circleGeometry args={[0.05, 16]} />
        <Glow color="#ff4d4d" />
      </mesh>
    </group>
  );
}

function FilmStrip() {
  const ref = useRef<THREE.Group>(null);
  const frames = 16;
  const R = 1.85;
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.25;
  });
  const items = useMemo(() => Array.from({ length: frames }, (_, i) => (i / frames) * Math.PI * 2), []);
  return (
    <group rotation={[0.35, 0, 0.15]}>
      <group ref={ref}>
        {items.map((a, i) => (
          <group key={i} position={[Math.sin(a) * R, 0, Math.cos(a) * R]} rotation={[0, a, 0]}>
            <mesh>
              <boxGeometry args={[0.82, 0.62, 0.02]} />
              <meshStandardMaterial color="#071f22" />
            </mesh>
            <mesh position={[0, 0, 0.012]}>
              <planeGeometry args={[0.62, 0.38]} />
              <meshBasicMaterial color={i % 3 === 0 ? C.teal : i % 3 === 1 ? C.petrol : "#0f6f73"} />
            </mesh>
            {[-0.26, -0.09, 0.09, 0.26].map((x) => (
              <group key={x}>
                <mesh position={[x, 0.255, 0.012]}>
                  <planeGeometry args={[0.07, 0.05]} />
                  <meshBasicMaterial color={C.mint} />
                </mesh>
                <mesh position={[x, -0.255, 0.012]}>
                  <planeGeometry args={[0.07, 0.05]} />
                  <meshBasicMaterial color={C.mint} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

function PlayButton() {
  const tri = useExtrude((s) => {
    s.moveTo(-0.22, 0.3);
    s.lineTo(0.32, 0);
    s.lineTo(-0.22, -0.3);
  }, 0.12, 0.03);
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 0.12, 48]} />
        <Glossy color="#ffffff" />
      </mesh>
      <mesh geometry={tri} rotation={[-Math.PI / 2, 0, 0]} position={[0.02, 0.1, 0]}>
        <Glossy color={C.teal} emissive={C.teal} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

export default function VideoScene() {
  return (
    <SceneRig scale={0.95}>
      <FilmStrip />
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.5}>
        <group rotation={[0.15, -0.5, 0.05]}>
          <Camera />
        </group>
      </Float>
      <Float speed={2.2} floatIntensity={0.9} rotationIntensity={0.5}>
        <group position={[1.25, 1.3, 1]} rotation={[Math.PI / 2, 0, 0]} scale={0.6}>
          <PlayButton />
        </group>
      </Float>
    </SceneRig>
  );
}
