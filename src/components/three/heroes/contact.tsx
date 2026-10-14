"use client";

import { Line, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig } from "./kit";

function Plane() {
  // folded paper plane from four triangles
  const geo = useMemo(() => {
    const v = new Float32Array([
      // left wing
      0, 0, 0.9, -0.75, 0.05, -0.6, 0, 0, -0.45,
      // right wing
      0, 0, 0.9, 0, 0, -0.45, 0.75, 0.05, -0.6,
      // keel left
      0, 0, 0.9, 0, 0, -0.45, 0, -0.25, -0.5,
      // keel right
      0, 0, 0.9, 0, -0.25, -0.5, 0, 0, -0.45,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo}>
      <meshPhysicalMaterial color="#f4fbfa" roughness={0.35} clearcoat={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function ContactScene() {
  const plane = useRef<THREE.Group>(null);
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [[-2, -0.6, 0.4], [-0.9, 1.2, -0.6], [0.9, 1.5, 0.5], [2, 0.2, -0.3], [0.6, -1.2, 0.6], [-1.2, -1.4, -0.4]].map((p) => new THREE.Vector3(...(p as [number, number, number]))),
        true,
      ),
    [],
  );
  const trail = useMemo(() => curve.getPoints(160), [curve]);
  useFrame((s) => {
    const t = (s.clock.elapsedTime * 0.07) % 1;
    const p = curve.getPointAt(t);
    const n = curve.getPointAt((t + 0.01) % 1);
    if (plane.current) {
      plane.current.position.copy(p);
      plane.current.lookAt(n);
    }
  });
  return (
    <SceneRig scale={1.25}>
      <Line points={trail} color={C.glow} lineWidth={1.2} transparent opacity={0.35} dashed dashSize={0.12} gapSize={0.1} />
      <group ref={plane} scale={0.75}>
        <Plane />
      </group>
      <group rotation={[0.2, -0.35, 0]}>
        <RoundedBox args={[2, 1.3, 0.12]} radius={0.06}>
          <Glossy color={C.teal} />
        </RoundedBox>
        {/* envelope flap */}
        <mesh position={[0, 0.2, 0.07]}>
          <shapeGeometry args={[new THREE.Shape([new THREE.Vector2(-0.98, 0.43), new THREE.Vector2(0.98, 0.43), new THREE.Vector2(0, -0.25)])]} />
          <meshStandardMaterial color={C.petrol} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.05, 0.08]}>
          <circleGeometry args={[0.16, 32]} />
          <meshBasicMaterial color={C.sun} />
        </mesh>
      </group>
    </SceneRig>
  );
}
