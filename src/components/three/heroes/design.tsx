"use client";

import { Float, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, Glow, SceneRig, useExtrude } from "./kit";

/** Pen-tool nib (generic vector-pen silhouette). */
function PenNib() {
  const geo = useExtrude((s) => {
    s.moveTo(0, 1.25);
    s.bezierCurveTo(0.12, 1.0, 0.52, 0.45, 0.6, 0.05);
    s.lineTo(0.42, -0.35);
    s.lineTo(0.42, -0.62);
    s.lineTo(-0.42, -0.62);
    s.lineTo(-0.42, -0.35);
    s.lineTo(-0.6, 0.05);
    s.bezierCurveTo(-0.52, 0.45, -0.12, 1.0, 0, 1.25);
    const hole = new THREE.Path();
    hole.absarc(0, 0.2, 0.12, 0, Math.PI * 2, true);
    s.holes.push(hole);
  }, 0.22, 0.04);
  const body = useExtrude((s) => {
    s.moveTo(-0.42, -0.7);
    s.lineTo(0.42, -0.7);
    s.lineTo(0.42, -1.25);
    s.quadraticCurveTo(0.42, -1.35, 0.32, -1.35);
    s.lineTo(-0.32, -1.35);
    s.quadraticCurveTo(-0.42, -1.35, -0.42, -1.25);
  }, 0.24, 0.04);
  return (
    <group>
      <mesh geometry={geo}>
        <Glossy color={C.teal} metal={0.35} />
      </mesh>
      <mesh geometry={body} position={[0, -1.03, 0]}>
        <Glossy color={C.petrol} />
      </mesh>
      <mesh position={[0, 0.98, 0.14]}>
        <cylinderGeometry args={[0.012, 0.012, 0.55, 8]} />
        <Glow color={C.mint} />
      </mesh>
    </group>
  );
}

/** Animated Bézier path with anchor squares and handle lines – the pen is "drawing". */
function Path() {
  const curve = useMemo(
    () =>
      new THREE.CubicBezierCurve3(new THREE.Vector3(-2.1, -0.9, 0), new THREE.Vector3(-1.2, 1.7, 0.3), new THREE.Vector3(0.9, -1.8, -0.2), new THREE.Vector3(2.0, 0.8, 0)),
    [],
  );
  const pts = useMemo(() => curve.getPoints(80), [curve]);
  const line = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const [lineObj] = useMemo(() => [{ count: pts.length }], [pts]);
  useFrame((_, d) => {
    progress.current = (progress.current + d * 0.22) % 1.4;
    const p = Math.min(1, progress.current);
    const l = line.current?.children[0] as unknown as { geometry: { instanceCount: number } } | undefined;
    if (l?.geometry) l.geometry.instanceCount = Math.max(1, Math.floor(p * (lineObj.count - 1)));
  });
  const anchors = [curve.v0, curve.v3];
  const handles: [THREE.Vector3, THREE.Vector3][] = [
    [curve.v0, curve.v1],
    [curve.v3, curve.v2],
  ];
  return (
    <group>
      <group ref={line}>
        <Line points={pts} color={C.glow} lineWidth={3.5} />
      </group>
      {handles.map(([a, b], i) => (
        <group key={i}>
          <Line points={[a, b]} color={C.mint} lineWidth={1.2} transparent opacity={0.7} dashed dashSize={0.08} gapSize={0.06} />
          <mesh position={b}>
            <sphereGeometry args={[0.07, 20, 20]} />
            <Glow color={C.white} />
          </mesh>
        </group>
      ))}
      {anchors.map((a, i) => (
        <mesh key={i} position={a} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.16, 0.16, 0.16]} />
          <meshStandardMaterial color="#ffffff" emissive={C.teal} emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Swatches() {
  const ref = useRef<THREE.Group>(null);
  const colors = [C.petrol, C.teal, C.glow, C.sun, "#ffffff"];
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime;
    ref.current.children.forEach((c, i) => {
      c.rotation.z = -0.55 + i * 0.22 + Math.sin(t * 0.8) * 0.06 * i;
    });
  });
  return (
    <group ref={ref} position={[1.7, -1.35, 0.4]}>
      {colors.map((c, i) => (
        <group key={c}>
          <mesh position={[0, 0.55, i * 0.025]}>
            <boxGeometry args={[0.32, 1.1, 0.02]} />
            <Glossy color={c} rough={0.3} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0, 0.15]}>
        <cylinderGeometry args={[0.05, 0.05, 0.3, 16]} />
        <Glossy color="#ffffff" metal={0.8} />
      </mesh>
    </group>
  );
}

export default function DesignScene() {
  return (
    <SceneRig scale={0.95}>
      <Path />
      <Float speed={1.6} rotationIntensity={0.25} floatIntensity={0.5}>
        <group position={[0.15, 0.55, 0.6]} rotation={[0.25, -0.3, -0.55]} scale={0.72}>
          <PenNib />
        </group>
      </Float>
      <Swatches />
      <Float speed={2.2} floatIntensity={0.8}>
        <mesh position={[-1.8, 1.25, -0.4]}>
          <torusGeometry args={[0.32, 0.11, 24, 64]} />
          <Glossy color={C.teal} />
        </mesh>
      </Float>
      <Float speed={1.8} floatIntensity={0.7}>
        <mesh position={[-1.5, -1.5, 0.3]} rotation={[0.4, 0.3, 0]}>
          <boxGeometry args={[0.45, 0.45, 0.45]} />
          <Glossy color={C.petrol} />
        </mesh>
      </Float>
      <Float speed={2.4} floatIntensity={0.9}>
        <mesh position={[1.25, 1.55, -0.3]}>
          <icosahedronGeometry args={[0.28, 0]} />
          <Glossy color={C.sun} rough={0.25} />
        </mesh>
      </Float>
    </SceneRig>
  );
}
