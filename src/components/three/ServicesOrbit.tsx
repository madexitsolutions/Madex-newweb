"use client";

import { Float } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { MarkModel, Particles, StudioLights } from "./HeroScene";

const R = 2.7;

function Node({ index, count, active, onSelect, onHover }: { index: number; count: number; active: boolean; onSelect: (i: number) => void; onHover: (i: number | null) => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const angle = (index / count) * Math.PI * 2;
  const pos = useMemo(() => new THREE.Vector3(Math.cos(angle) * R, Math.sin(index * 1.7) * 0.35, Math.sin(angle) * R), [angle, index]);
  useFrame((state, d) => {
    const t = state.clock.elapsedTime;
    if (mesh.current) {
      const s = THREE.MathUtils.damp(mesh.current.scale.x, active ? 1.7 : 1, 6, d);
      mesh.current.scale.setScalar(s);
      mesh.current.rotation.x = t * 0.6 + index;
      mesh.current.rotation.y = t * 0.4;
      const m = mesh.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, active ? 1.6 : 0.25, 5, d);
    }
    if (halo.current) {
      const hs = THREE.MathUtils.damp(halo.current.scale.x, active ? 2.6 : 0.001, 5, d);
      halo.current.scale.setScalar(hs);
      halo.current.lookAt(state.camera.position);
    }
  });
  const noRay = () => null;
  return (
    <group position={pos}>
      {/* stable, invisible hit area – visual scaling never moves the pointer target */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(index);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(index);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHover(null);
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[0.46, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={mesh} raycast={noRay}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color={index % 3 === 2 ? "#028D86" : "#025159"} emissive="#4fe0d2" emissiveIntensity={0.25} roughness={0.2} metalness={0.4} flatShading />
      </mesh>
      <mesh ref={halo} raycast={noRay}>
        <ringGeometry args={[0.22, 0.25, 48]} />
        <meshBasicMaterial color="#4fe0d2" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Links({ count, active }: { count: number; active: number }) {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const b = ((i + 1) / count) * Math.PI * 2;
      const p = [Math.cos(a) * R, Math.sin(i * 1.7) * 0.35, Math.sin(a) * R];
      const q = [Math.cos(b) * R, Math.sin((i + 1) * 1.7) * 0.35, Math.sin(b) * R];
      pts.push(0, 0, 0, ...p, ...p, ...q);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [count]);
  const mat = useRef<THREE.LineBasicMaterial>(null);
  useFrame((s) => {
    if (mat.current) mat.current.opacity = 0.22 + Math.sin(s.clock.elapsedTime * 2) * 0.06 + (active >= 0 ? 0.1 : 0);
  });
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial ref={mat} color="#4fe0d2" transparent opacity={0.25} />
    </lineSegments>
  );
}

/**
 * `focus` (driven by the HTML list) rotates the orbit; `highlight` (pointer on a
 * node) only lights the node up. Rotating on node hover would move the node away
 * from the cursor and cause hover flicker.
 */
export default function ServicesOrbit({ count, focus, highlight, onSelect, onHover }: { count: number; focus: number; highlight: number | null; onSelect: (i: number) => void; onHover: (i: number | null) => void }) {
  const active = highlight ?? focus;
  const orbit = useRef<THREE.Group>(null);
  const { size } = useThree();
  useFrame((state, d) => {
    if (!orbit.current) return;
    if (highlight !== null) {
      // hold still while the pointer is on a node
    } else if (focus >= 0) {
      // bring the focused node to the front (towards +z)
      const target = -((focus / count) * Math.PI * 2) + Math.PI / 2;
      let cur = orbit.current.rotation.y;
      const diff = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
      cur += diff * Math.min(1, d * 4);
      orbit.current.rotation.y = cur;
    } else {
      orbit.current.rotation.y += d * 0.12;
    }
    orbit.current.rotation.x = THREE.MathUtils.damp(orbit.current.rotation.x, 0.32 + state.pointer.y * 0.1, 3, d);
  });
  const scale = size.width < 700 ? 0.78 : 1;
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 5, 4]} intensity={1.4} />
      <StudioLights />
      <group scale={scale}>
        <group ref={orbit}>
          <Links count={count} active={active} />
          {Array.from({ length: count }, (_, i) => (
            <Node key={i} index={i} count={count} active={i === active} onSelect={onSelect} onHover={onHover} />
          ))}
        </group>
        <Float speed={2} floatIntensity={0.5} rotationIntensity={0.3}>
          <group scale={0.42}>
            <MarkModel />
          </group>
        </Float>
      </group>
      <Particles count={600} radius={7} />
    </>
  );
}
