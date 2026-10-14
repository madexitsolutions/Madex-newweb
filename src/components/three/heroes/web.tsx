"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { C, Glossy, Glow, SceneRig, useExtrude } from "./kit";

/** Browser window whose layout layers peel apart in depth. */
function Browser() {
  const layers = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    layers.current?.children.forEach((c, i) => {
      c.position.z = 0.08 + (i + 1) * (0.16 + Math.sin(t * 1.2 + i) * 0.05);
    });
  });
  return (
    <group>
      <RoundedBox args={[3.2, 2.1, 0.12]} radius={0.08} smoothness={4}>
        <Glossy color={C.night} rough={0.35} />
      </RoundedBox>
      {/* title bar */}
      <mesh position={[0, 0.88, 0.07]}>
        <boxGeometry args={[3.1, 0.22, 0.02]} />
        <Glossy color={C.petrol} />
      </mesh>
      {[-1.42, -1.28, -1.14].map((x, i) => (
        <mesh key={x} position={[x, 0.88, 0.09]}>
          <circleGeometry args={[0.04, 20]} />
          <Glow color={[C.sun, C.glow, "#ffffff"][i]} />
        </mesh>
      ))}
      <mesh position={[0.2, 0.88, 0.09]}>
        <planeGeometry args={[1.6, 0.1]} />
        <meshBasicMaterial color="#0b3d42" />
      </mesh>
      <group ref={layers}>
        {/* hero block */}
        <RoundedBox args={[2.9, 0.75, 0.04]} radius={0.03} position={[0, 0.3, 0]}>
          <Glossy color={C.teal} emissive={C.teal} emissiveIntensity={0.2} />
        </RoundedBox>
        {/* cards */}
        <group position={[0, -0.5, 0]}>
          {[-1, 0, 1].map((i) => (
            <RoundedBox key={i} args={[0.88, 0.62, 0.04]} radius={0.03} position={[i * 0.98, 0, 0]}>
              <Glossy color={i === 0 ? C.glow : "#e9f4f3"} rough={0.25} />
            </RoundedBox>
          ))}
        </group>
        {/* cta pill */}
        <RoundedBox args={[0.7, 0.16, 0.05]} radius={0.07} position={[-0.95, 0.22, 0]}>
          <Glossy color="#ffffff" />
        </RoundedBox>
      </group>
    </group>
  );
}

function CodeSymbol() {
  const chevron = useExtrude((s) => {
    s.moveTo(0, 0);
    s.lineTo(0.42, 0.42);
    s.lineTo(0.42, 0.24);
    s.lineTo(0.2, 0);
    s.lineTo(0.42, -0.24);
    s.lineTo(0.42, -0.42);
  }, 0.14, 0.025);
  const slash = useExtrude((s) => {
    s.moveTo(-0.06, -0.5);
    s.lineTo(0.1, -0.5);
    s.lineTo(0.06, 0.5);
    s.lineTo(-0.1, 0.5);
  }, 0.14, 0.025);
  return (
    <group>
      <mesh geometry={chevron} position={[-0.5, 0, 0]}>
        <Glossy color={C.glow} emissive={C.teal} emissiveIntensity={0.25} />
      </mesh>
      <mesh geometry={slash} rotation={[0, 0, -0.32]}>
        <Glossy color="#ffffff" />
      </mesh>
      <mesh geometry={chevron} position={[0.5, 0, 0]} rotation={[0, Math.PI, 0]}>
        <Glossy color={C.glow} emissive={C.teal} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

function Phone() {
  return (
    <group>
      <RoundedBox args={[0.7, 1.4, 0.08]} radius={0.1} smoothness={4}>
        <Glossy color="#0a2b2f" metal={0.5} />
      </RoundedBox>
      <RoundedBox args={[0.6, 1.26, 0.02]} radius={0.06} position={[0, 0, 0.045]}>
        <meshStandardMaterial color={C.teal} emissive={C.teal} emissiveIntensity={0.35} />
      </RoundedBox>
      {[0.35, 0.05, -0.25].map((y, i) => (
        <mesh key={y} position={[0, y, 0.06]}>
          <planeGeometry args={[i ? 0.44 : 0.5, i ? 0.16 : 0.28]} />
          <meshBasicMaterial color={i ? "#e9f4f3" : C.glow} />
        </mesh>
      ))}
    </group>
  );
}

export default function WebScene() {
  return (
    <SceneRig>
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.4}>
        <group rotation={[0.08, -0.35, 0.02]}>
          <Browser />
        </group>
      </Float>
      <Float speed={2} rotationIntensity={0.4} floatIntensity={0.8}>
        <group position={[-1.75, 1.3, 0.9]} scale={0.75}>
          <CodeSymbol />
        </group>
      </Float>
      <Float speed={1.7} rotationIntensity={0.3} floatIntensity={0.6}>
        <group position={[1.8, -0.75, 1]} rotation={[0.1, -0.5, 0.1]} scale={0.95}>
          <Phone />
        </group>
      </Float>
    </SceneRig>
  );
}
