"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, Glow, SceneRig, useExtrude } from "./kit";

/** Growing bar chart with a rising arrow – "mehr Sichtbarkeit, mehr Anfragen". */
export default function DigitalScene() {
  const bars = useRef<THREE.Group>(null);
  const heights = [0.6, 0.95, 1.3, 1.75, 2.3];
  const curve = useMemo(() => new THREE.CatmullRomCurve3(heights.map((h, i) => new THREE.Vector3(-1.6 + i * 0.8, h - 0.95, 0.45))), []); // eslint-disable-line react-hooks/exhaustive-deps
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 80, 0.045, 12, false), [curve]);
  const head = useExtrude((s) => {
    s.moveTo(0, 0.28);
    s.lineTo(0.24, -0.12);
    s.lineTo(-0.24, -0.12);
  }, 0.12, 0.02);
  const end = curve.getPoint(1);
  const dir = curve.getTangent(1);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    bars.current?.children.forEach((b, i) => {
      const grow = 0.85 + Math.sin(t * 1.4 - i * 0.6) * 0.15;
      b.scale.y = THREE.MathUtils.lerp(b.scale.y, grow, 0.08);
      b.position.y = -1.2 + (heights[i] * b.scale.y) / 2;
    });
  });
  return (
    <SceneRig>
      <group rotation={[0.1, -0.45, 0]}>
        <RoundedBox args={[4.2, 0.08, 1.6]} radius={0.03} position={[0, -1.24, 0]}>
          <Glossy color={C.night} rough={0.4} />
        </RoundedBox>
        <group ref={bars}>
          {heights.map((h, i) => (
            <RoundedBox key={i} args={[0.5, h, 0.5]} radius={0.06} position={[-1.6 + i * 0.8, -1.2 + h / 2, 0]}>
              <Glossy color={i === heights.length - 1 ? C.teal : C.petrol} emissive={i === heights.length - 1 ? C.teal : "#000"} emissiveIntensity={0.25} />
            </RoundedBox>
          ))}
        </group>
        <mesh geometry={tube}>
          <Glow color={C.glow} />
        </mesh>
        <mesh geometry={head} position={end} rotation={[0, 0, Math.atan2(dir.y, dir.x) - Math.PI / 2]}>
          <Glow color={C.glow} />
        </mesh>
        {heights.map((h, i) => (
          <mesh key={i} position={[-1.6 + i * 0.8, h - 0.95, 0.45]}>
            <sphereGeometry args={[0.075, 20, 20]} />
            <Glow color="#ffffff" />
          </mesh>
        ))}
      </group>
      {[
        [-1.9, 1.3, 0.3, C.sun],
        [1.9, 1.6, -0.4, C.glow],
        [1.6, -1.7, 0.6, C.teal],
      ].map(([x, y, z, c], i) => (
        <Float key={i} speed={2 + i * 0.4} floatIntensity={0.8} rotationIntensity={1}>
          <mesh position={[x as number, y as number, z as number]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.07, 40]} />
            <Glossy color={c as string} metal={0.6} rough={0.2} />
          </mesh>
        </Float>
      ))}
    </SceneRig>
  );
}
