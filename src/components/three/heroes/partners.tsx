"use client";

import { Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig, useExtrude } from "./kit";

const W = 1.3;

/** Classic jigsaw edge with a knob (out) or socket (in) on the right side. */
function jigsaw(s: THREE.Shape, knob: 1 | -1, topKnob: 1 | -1 | 0) {
  const h = W / 2;
  s.moveTo(-h, -h);
  s.lineTo(h, -h);
  // right edge with knob
  s.lineTo(h, -0.16);
  s.bezierCurveTo(h + knob * 0.1, -0.24, h + knob * 0.36, -0.28, h + knob * 0.36, 0);
  s.bezierCurveTo(h + knob * 0.36, 0.28, h + knob * 0.1, 0.24, h, 0.16);
  s.lineTo(h, h);
  // top edge
  if (topKnob) {
    s.lineTo(0.16, h);
    s.bezierCurveTo(0.24, h + topKnob * 0.1, 0.28, h + topKnob * 0.36, 0, h + topKnob * 0.36);
    s.bezierCurveTo(-0.28, h + topKnob * 0.36, -0.24, h + topKnob * 0.1, -0.16, h);
  }
  s.lineTo(-h, h);
  s.lineTo(-h, -h);
}

export default function PartnersScene() {
  const left = useExtrude((s) => jigsaw(s, 1, 1), 0.3, 0.06);
  const right = useExtrude((s) => jigsaw(s, -1, -1), 0.3, 0.06);
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime % 5;
    // apart → glide together → click (hold) → drift apart
    const k = t < 1.6 ? 1 - t / 1.6 : t < 3.8 ? 0 : (t - 3.8) / 1.2;
    const gap = (1 - Math.cos(Math.min(1, k) * Math.PI)) / 2;
    if (a.current) {
      a.current.position.set(-W / 2 - 0.02 - gap * 0.9, gap * 0.25, 0);
      a.current.rotation.set(0, gap * 0.35, -gap * 0.18);
    }
    if (b.current) {
      b.current.position.set(W / 2 + 0.02 + gap * 0.9, -gap * 0.25, 0);
      b.current.rotation.set(0, -gap * 0.35, gap * 0.18);
    }
    if (ring.current) {
      const since = t - 1.6;
      const on = since > 0 && since < 1.2;
      const p = on ? since / 1.2 : 0;
      ring.current.visible = on;
      ring.current.scale.setScalar(0.3 + p * 1.6);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.8;
    }
  });
  return (
    <SceneRig scale={1.05}>
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.35}>
        <group rotation={[0.25, -0.4, 0.05]}>
          <group ref={a}>
            <mesh geometry={left} position={[0.18, 0.18, 0]}>
              <Glossy color={C.teal} rough={0.2} />
            </mesh>
          </group>
          <group ref={b}>
            {/* rotated so its socket faces the left piece's knob */}
            <mesh geometry={right} rotation={[0, 0, Math.PI]}>
              <Glossy color="#e9f4f3" rough={0.18} />
            </mesh>
          </group>
          <mesh ref={ring} position={[0, 0, 0.25]}>
            <ringGeometry args={[0.32, 0.36, 64]} />
            <meshBasicMaterial color={C.glow} transparent opacity={0.8} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </Float>
    </SceneRig>
  );
}
