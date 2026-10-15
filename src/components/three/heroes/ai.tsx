"use client";

import { RoundedBox } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig, useBob } from "./kit";

/** Chat bubbles around a four-point spark: a website assistant answering. */
function Bubble({ position, w, color, side, phase }: { position: [number, number, number]; w: number; color: string; side: 1 | -1; phase: number }) {
  const ref = useRef<THREE.Group>(null);
  useBob(ref, { speed: 0.8, amp: 0.06, phase });
  return (
    <group ref={ref} position={position}>
      <RoundedBox args={[w, 0.62, 0.16]} radius={0.08} smoothness={4}>
        <Glossy color={color} />
      </RoundedBox>
      {/* tail */}
      <mesh position={[(side * w) / 2 - side * 0.18, -0.36, 0]} rotation={[0, 0, side * 0.6]}>
        <coneGeometry args={[0.1, 0.22, 3]} />
        <Glossy color={color} />
      </mesh>
      {/* text lines */}
      {[
        [0.12, w * 0.7],
        [-0.08, w * 0.45],
      ].map(([y, len]) => (
        <mesh key={y} position={[-w / 2 + 0.2 + len / 2, y, 0.09]}>
          <boxGeometry args={[len, 0.07, 0.01]} />
          <meshBasicMaterial color={color === C.white ? C.petrol : C.white} transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function Spark() {
  const ref = useRef<THREE.Group>(null);
  useBob(ref, { speed: 0.6, amp: 0.05, rot: 0.25 });
  const shape = useMemo(() => {
    const sh = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 0.62 : 0.17;
      const a = (i / 8) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    sh.closePath();
    return sh;
  }, []);
  return (
    <group ref={ref} position={[0.15, 0.05, 0.3]}>
      <mesh>
        <extrudeGeometry args={[shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 }]} />
        <Glossy color={C.sun} rough={0.25} />
      </mesh>
    </group>
  );
}

export default function AiScene() {
  return (
    <SceneRig scale={1.15}>
      <Bubble position={[-0.75, 1.05, 0]} w={1.9} color={C.white} side={-1} phase={0} />
      <Bubble position={[0.85, 0.05, -0.2]} w={1.6} color={C.teal} side={1} phase={1.4} />
      <Bubble position={[-0.55, -1.0, 0.1]} w={1.75} color={C.white} side={-1} phase={2.6} />
      <Spark />
    </SceneRig>
  );
}
