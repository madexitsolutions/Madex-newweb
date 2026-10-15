"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Frost, Glossy, Glow, SceneRig, useExtrude } from "./kit";

const GUNMETAL = "#1c464b";

/** Film reel: disc with five windows and a hub, spinning. */
function Reel({ position, speed = 1 }: { position: [number, number, number]; speed?: number }) {
  const ref = useRef<THREE.Group>(null);
  const disc = useExtrude((s) => {
    s.absarc(0, 0, 0.56, 0, Math.PI * 2, false);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
      const h = new THREE.Path();
      h.absarc(Math.cos(a) * 0.31, Math.sin(a) * 0.31, 0.12, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
    const hub = new THREE.Path();
    hub.absarc(0, 0, 0.055, 0, Math.PI * 2, true);
    s.holes.push(hub);
  }, 0.09, 0.025);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.z -= d * 1.2 * speed;
  });
  return (
    <group position={position}>
      <group ref={ref}>
        <mesh geometry={disc}>
          <Glossy color={C.teal} metal={0.55} rough={0.22} />
        </mesh>
        {/* wound film around the hub */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 40]} />
          <Glossy color="#0a2427" rough={0.5} />
        </mesh>
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.22, 24]} />
        <Glossy color="#dfe9e8" metal={0.8} rough={0.2} />
      </mesh>
    </group>
  );
}

function MovieCamera() {
  return (
    <group>
      {/* body */}
      <RoundedBox args={[1.9, 1.05, 0.78]} radius={0.12} smoothness={6}>
        <Glossy color={GUNMETAL} metal={0.55} rough={0.28} />
      </RoundedBox>
      {/* side panel + grille */}
      <RoundedBox args={[1.25, 0.62, 0.04]} radius={0.04} position={[-0.18, -0.02, 0.4]}>
        <Glossy color={C.petrol} metal={0.4} rough={0.3} />
      </RoundedBox>
      {[-0.12, 0, 0.12].map((y) => (
        <mesh key={y} position={[0.28, y - 0.02, 0.425]}>
          <boxGeometry args={[0.28, 0.035, 0.01]} />
          <meshStandardMaterial color="#9ff3ea" emissive="#4fe0d2" emissiveIntensity={0.3} />
        </mesh>
      ))}
      {/* REC light */}
      <mesh position={[-0.68, 0.22, 0.425]}>
        <circleGeometry args={[0.055, 24]} />
        <Glow color="#ff4b4b" />
      </mesh>
      {/* top handle */}
      <mesh position={[-0.05, 0.62, 0]}>
        <boxGeometry args={[0.7, 0.07, 0.12]} />
        <Glossy color="#0d2a2d" metal={0.6} />
      </mesh>
      {/* reels */}
      <Reel position={[-0.5, 1.08, 0]} />
      <Reel position={[0.5, 1.12, 0]} speed={1.3} />
      {/* film loop between reels */}
      <mesh position={[0, 0.98, -0.02]}>
        <boxGeometry args={[1.0, 0.02, 0.06]} />
        <meshStandardMaterial color="#082022" />
      </mesh>
      {/* lens: mount, barrel, hood, glass */}
      <group position={[0.95, -0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh position={[0, 0.07, 0]}>
          <cylinderGeometry args={[0.33, 0.33, 0.14, 48]} />
          <Glossy color="#0d2a2d" metal={0.7} rough={0.25} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.27, 0.29, 0.34, 48]} />
          <Glossy color={GUNMETAL} metal={0.6} rough={0.2} />
        </mesh>
        <mesh position={[0, 0.32, 0]}>
          <torusGeometry args={[0.29, 0.02, 12, 48]} />
          <Glossy color={C.glow} metal={0.3} emissive={C.teal} emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.42, 0.29, 0.28, 48, 1, true]} />
          <Glossy color="#0d2a2d" metal={0.5} rough={0.35} />
        </mesh>
        <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.27, 48]} />
          <meshPhysicalMaterial color="#0b3f45" roughness={0.05} metalness={0.2} clearcoat={1} envMapIntensity={2.2} />
        </mesh>
        <mesh position={[0.08, 0.505, -0.08]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.07, 24]} />
          <Frost color="#ffffff" opacity={0.35} />
        </mesh>
      </group>
    </group>
  );
}

/** Clapperboard whose top bar snaps shut every few seconds. */
function Clapper() {
  const arm = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime % 3.2;
    const open = t < 2.6 ? Math.min(1, t / 0.5) : Math.max(0, 1 - (t - 2.6) / 0.08);
    if (arm.current) arm.current.rotation.z = open * 0.45;
  });
  const stripes = (y: number) =>
    [0, 1, 2, 3, 4].map((i) => (
      <mesh key={i} position={[-0.42 + i * 0.21, y, 0.032]} rotation={[0, 0, 0.6]}>
        <planeGeometry args={[0.09, 0.26]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    ));
  return (
    <group>
      <RoundedBox args={[1.05, 0.72, 0.06]} radius={0.03}>
        <Glossy color="#24555a" rough={0.3} />
      </RoundedBox>
      {[0.08, -0.1, -0.26].map((y) => (
        <mesh key={y} position={[0, y, 0.032]}>
          <planeGeometry args={[0.86, 0.012]} />
          <meshBasicMaterial color="#9ff3ea" transparent opacity={0.5} />
        </mesh>
      ))}
      <group position={[0, 0.44, 0]}>
        <mesh>
          <boxGeometry args={[1.05, 0.16, 0.06]} />
          <Glossy color="#10292c" />
        </mesh>
        <group>{stripes(0)}</group>
      </group>
      <group ref={arm} position={[-0.52, 0.6, 0]}>
        <group position={[0.52, 0.02, 0]}>
          <mesh>
            <boxGeometry args={[1.05, 0.16, 0.06]} />
            <Glossy color="#10292c" />
          </mesh>
          {stripes(0)}
        </group>
      </group>
    </group>
  );
}

function PlayButton() {
  const tri = useExtrude((s) => {
    s.moveTo(-0.2, 0.28);
    s.lineTo(0.3, 0);
    s.lineTo(-0.2, -0.28);
  }, 0.1, 0.035);
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.12, 64]} />
        <Glossy color="#f4fbfa" rough={0.15} />
      </mesh>
      <mesh geometry={tri} position={[0.03, 0, 0.09]}>
        <Glossy color={C.teal} emissive={C.teal} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

/** A strip of film arcing behind the camera, frames sliding along it. */
function FilmArc() {
  const ref = useRef<THREE.Group>(null);
  const n = 11;
  const R = 2.3;
  const items = useMemo(() => Array.from({ length: n }, (_, i) => i), []);
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime * 0.12;
    ref.current.children.forEach((c, i) => {
      const a = -1.15 + (((i / n) * 2.3 + t) % 2.3);
      c.position.set(Math.sin(a) * R, 0.15 + Math.sin(a * 1.4) * 0.25, Math.cos(a) * R - 2.6);
      c.rotation.set(0, a, 0);
      const edge = Math.min(1, (1.15 - Math.abs(a)) * 3);
      c.scale.setScalar(Math.max(0.001, edge));
    });
  });
  return (
    <group ref={ref}>
      {items.map((i) => (
        <group key={i}>
          <mesh>
            <boxGeometry args={[0.64, 0.5, 0.015]} />
            <meshStandardMaterial color="#061a1c" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.009]}>
            <planeGeometry args={[0.5, 0.3]} />
            <meshStandardMaterial color={i % 3 === 0 ? C.teal : i % 3 === 1 ? "#0f6f73" : C.petrol} emissive={C.teal} emissiveIntensity={0.15} />
          </mesh>
          {[-0.2, -0.067, 0.067, 0.2].map((x) =>
            [0.205, -0.205].map((y) => (
              <mesh key={`${x}${y}`} position={[x, y, 0.009]}>
                <planeGeometry args={[0.055, 0.04]} />
                <meshBasicMaterial color="#cfeeea" />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

export default function VideoScene() {
  return (
    <SceneRig scale={0.92}>
      <FilmArc />
      <Float speed={1.3} rotationIntensity={0.18} floatIntensity={0.45}>
        <group rotation={[0.12, -0.55, 0.02]} position={[-0.1, -0.15, 0]}>
          <MovieCamera />
        </group>
      </Float>
      <Float speed={1.8} rotationIntensity={0.3} floatIntensity={0.7}>
        <group position={[-1.75, -1.15, 0.6]} rotation={[0.1, 0.45, 0.12]} scale={0.8}>
          <Clapper />
        </group>
      </Float>
      <Float speed={2.2} floatIntensity={0.9} rotationIntensity={0.35}>
        <group position={[1.6, 1.45, 0.7]} rotation={[0.15, -0.35, 0]} scale={0.62}>
          <PlayButton />
        </group>
      </Float>
    </SceneRig>
  );
}
