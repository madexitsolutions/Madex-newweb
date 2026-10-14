"use client";

import { Float, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, Glow, SceneRig, roundRect, useExtrude } from "./kit";

function Bubble({ color, w = 1.3, h = 0.8, flip = false }: { color: string; w?: number; h?: number; flip?: boolean }) {
  const geo = useExtrude((s) => {
    roundRect(s, -w / 2, -h / 2, w, h, 0.22);
  }, 0.16, 0.04, [w, h, flip]);
  const tail = useExtrude((s) => {
    s.moveTo(0, 0);
    s.lineTo(flip ? 0.22 : -0.22, -0.3);
    s.lineTo(flip ? -0.15 : 0.25, 0);
  }, 0.16, 0.03, [flip]);
  return (
    <group>
      <mesh geometry={geo}>
        <Glossy color={color} />
      </mesh>
      <mesh geometry={tail} position={[flip ? w / 2 - 0.3 : -w / 2 + 0.3, -h / 2 - 0.08, 0]}>
        <Glossy color={color} />
      </mesh>
      {[-0.28, 0, 0.28].map((x, i) => (
        <mesh key={x} position={[x * (w / 1.3), 0, 0.13]}>
          <sphereGeometry args={[0.07, 20, 20]} />
          <Glow color={i === 1 ? "#ffffff" : C.mint} />
        </mesh>
      ))}
    </group>
  );
}

function Heart() {
  const geo = useExtrude((s) => {
    s.moveTo(0, -0.45);
    s.bezierCurveTo(-0.15, -0.3, -0.6, -0.05, -0.6, 0.25);
    s.bezierCurveTo(-0.6, 0.55, -0.2, 0.62, 0, 0.35);
    s.bezierCurveTo(0.2, 0.62, 0.6, 0.55, 0.6, 0.25);
    s.bezierCurveTo(0.6, -0.05, 0.15, -0.3, 0, -0.45);
  }, 0.3, 0.08);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const beat = 1 + Math.max(0, Math.sin(t * 4)) ** 8 * 0.18;
    ref.current?.scale.setScalar(beat);
  });
  return (
    <mesh ref={ref} geometry={geo}>
      <Glossy color="#ff5a7a" emissive="#ff2d55" emissiveIntensity={0.25} />
    </mesh>
  );
}

function Network() {
  const nodes = useMemo(
    () => [
      [-1.8, -1.3, -0.6],
      [-0.6, -1.7, 0.2],
      [0.9, -1.5, -0.4],
      [2.0, -0.6, -0.2],
      [-2.1, 0.2, -0.8],
    ].map((p) => new THREE.Vector3(...(p as [number, number, number]))),
    [],
  );
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    ref.current?.children.forEach((c, i) => {
      if (c.type === "Mesh") c.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 2 + i) * 0.12);
    });
  });
  return (
    <group ref={ref}>
      {nodes.map((n, i) => (
        <mesh key={i} position={n}>
          <sphereGeometry args={[0.16, 24, 24]} />
          <Glossy color={i % 2 ? C.teal : C.petrol} emissive={C.glow} emissiveIntensity={0.15} />
        </mesh>
      ))}
      {nodes.slice(1).map((n, i) => (
        <Line key={i} points={[nodes[i], n]} color={C.glow} lineWidth={1} transparent opacity={0.45} />
      ))}
    </group>
  );
}

export default function SocialScene() {
  return (
    <SceneRig>
      <Network />
      <Float speed={1.5} rotationIntensity={0.25} floatIntensity={0.6}>
        <group position={[-0.55, 0.7, 0.2]} rotation={[0, 0.25, 0.04]}>
          <Bubble color={C.teal} w={1.7} h={1} />
        </group>
      </Float>
      <Float speed={1.8} rotationIntensity={0.25} floatIntensity={0.6}>
        <group position={[0.9, -0.35, 0.6]} rotation={[0, -0.35, -0.04]}>
          <Bubble color="#e9f4f3" w={1.3} h={0.75} flip />
        </group>
      </Float>
      <Float speed={2.2} rotationIntensity={0.6} floatIntensity={1}>
        <group position={[1.35, 1.25, 0.4]} scale={0.85}>
          <Heart />
        </group>
      </Float>
      <Float speed={2.6} floatIntensity={1.2}>
        <group position={[-1.75, -0.45, 0.9]}>
          <mesh>
            <sphereGeometry args={[0.24, 32, 32]} />
            <Glossy color={C.sun} />
          </mesh>
          <mesh position={[0, 0, 0.23]}>
            <circleGeometry args={[0.09, 20]} />
            <Glow color="#ffffff" />
          </mesh>
        </group>
      </Float>
    </SceneRig>
  );
}
