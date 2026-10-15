"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig } from "./kit";

/*
 * Contact: an open envelope with a letter sliding out, a ringing smartphone
 * and a map pin for the office.
 * Layout (local units):
 *   envelope  x -1.45 … 0.85, y -0.95 … 1.2 (flap), z -0.3 … 0.2
 *   phone     x 1.3 … 2.2,   y -0.5 … 1.2,  z 0.7
 *   pin       x -2.2 … -1.6, y 0.55 … 1.75, z -0.6
 * Inside the envelope, back → front: back panel z 0, letter z 0.06, pocket z 0.13.
 */
const W = 2.1;
const H = 1.35;
const CYCLE = 6;

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

function extrude(shape: THREE.Shape, depth: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 24 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function Envelope() {
  const { pocket, bottom, flap } = useMemo(() => {
    const p = new THREE.Shape();
    p.moveTo(-W / 2, -H / 2);
    p.lineTo(W / 2, -H / 2);
    p.lineTo(W / 2, H / 2 - 0.08);
    p.lineTo(0, -0.02);
    p.lineTo(-W / 2, H / 2 - 0.08);
    p.closePath();
    const b = new THREE.Shape();
    b.moveTo(-W / 2 + 0.03, -H / 2 + 0.03);
    b.lineTo(W / 2 - 0.03, -H / 2 + 0.03);
    b.quadraticCurveTo(0.12, -0.2, 0, -0.2);
    b.quadraticCurveTo(-0.12, -0.2, -W / 2 + 0.03, -H / 2 + 0.03);
    const f = new THREE.Shape();
    f.moveTo(-W / 2, 0);
    f.lineTo(W / 2, 0);
    f.lineTo(0.1, 0.74);
    f.quadraticCurveTo(0, 0.8, -0.1, 0.74);
    f.closePath();
    return { pocket: extrude(p, 0.03, 0.015), bottom: extrude(b, 0.012, 0.008), flap: extrude(f, 0.02, 0.01) };
  }, []);
  const letter = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime % CYCLE;
    const out = smooth((t - 0.4) / 1.4) - smooth((t - 4.4) / 1.2);
    if (letter.current) letter.current.position.y = -0.04 + out * 0.6;
  });
  return (
    <group>
      {/* back panel (inside of the envelope) */}
      <RoundedBox args={[W, H, 0.05]} radius={0.04} smoothness={4}>
        <Glossy color={C.petrol} rough={0.3} />
      </RoundedBox>
      {/* open flap, hinged on the top edge and leaning back */}
      <group position={[0, H / 2 - 0.01, -0.01]} rotation={[-0.38, 0, 0]}>
        <mesh geometry={flap}>
          <Glossy color="#036a6d" rough={0.28} />
        </mesh>
      </group>
      {/* letter */}
      <group ref={letter} position={[0, -0.04, 0.065]}>
        <RoundedBox args={[W - 0.24, H - 0.14, 0.02]} radius={0.01} smoothness={2}>
          <meshPhysicalMaterial color="#fbfefd" roughness={0.45} clearcoat={0.3} />
        </RoundedBox>
        <group position={[0, 0, 0.012]}>
          <mesh position={[-0.68, 0.42, 0]}>
            <circleGeometry args={[0.08, 32]} />
            <meshBasicMaterial color={C.sun} />
          </mesh>
          <mesh position={[-0.3, 0.42, 0]}>
            <planeGeometry args={[0.55, 0.06]} />
            <meshBasicMaterial color={C.petrol} />
          </mesh>
          {[0.22, 0.1, -0.02].map((y, i) => (
            <mesh key={y} position={[-0.76 + (i === 2 ? 0.55 : 0.68) / 2, y, 0]}>
              <planeGeometry args={[i === 2 ? 0.55 : 1.36 - i * 0.2, 0.04]} />
              <meshBasicMaterial color="#9bb8b7" />
            </mesh>
          ))}
        </group>
      </group>
      {/* front pocket with a raised bottom fold */}
      <mesh geometry={pocket} position={[0, 0, 0.13]}>
        <Glossy color={C.teal} rough={0.22} />
      </mesh>
      <mesh geometry={bottom} position={[0, 0, 0.165]}>
        <Glossy color="#07a39a" rough={0.22} />
      </mesh>
      {/* seal where the folds meet */}
      <mesh position={[0, -0.25, 0.185]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.025, 32]} />
        <meshStandardMaterial color={C.sun} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Handset glyph: a curved bar with rounded ends. */
function Handset() {
  return (
    <group rotation={[0, 0, -Math.PI / 4]}>
      <mesh rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.09, 0.03, 12, 24, Math.PI]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.09, 0.01, 0]}>
          <boxGeometry args={[0.075, 0.05, 0.02]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

function Phone() {
  const body = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const btn = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const k = t % 2.6;
    const ringing = k < 1.4;
    if (body.current) body.current.rotation.z = ringing ? Math.sin(t * 38) * 0.035 * Math.sin((k / 1.4) * Math.PI) : 0;
    rings.current?.children.forEach((r, i) => {
      const p = ((t * 0.55 + i / 3) % 1);
      r.scale.setScalar(0.62 + p * 0.65);
      ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.55;
    });
    if (btn.current) btn.current.scale.setScalar(1 + (ringing ? Math.sin(t * 9) * 0.06 : 0));
  });
  return (
    <group>
      <group ref={rings} position={[0, 0, -0.12]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <ringGeometry args={[0.95, 1.0, 64]} />
            <meshBasicMaterial color={C.glow} transparent toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <group ref={body}>
        <RoundedBox args={[0.86, 1.7, 0.1]} radius={0.05} smoothness={5}>
          <Glossy color="#0d2a2d" metal={0.5} rough={0.25} />
        </RoundedBox>
        {/* screen */}
        <RoundedBox args={[0.76, 1.58, 0.01]} radius={0.004} position={[0, 0, 0.051]}>
          <meshPhysicalMaterial color="#0c4146" roughness={0.1} clearcoat={1} emissive="#0a5b5f" emissiveIntensity={0.35} />
        </RoundedBox>
        <group position={[0, 0, 0.062]}>
          {/* camera notch */}
          <mesh position={[0, 0.72, 0]}>
            <planeGeometry args={[0.2, 0.045]} />
            <meshBasicMaterial color="#061416" />
          </mesh>
          {/* caller avatar */}
          <mesh position={[0, 0.3, 0]}>
            <circleGeometry args={[0.2, 40]} />
            <meshBasicMaterial color={C.mint} />
          </mesh>
          <mesh position={[0, 0.34, 0.001]}>
            <circleGeometry args={[0.07, 32]} />
            <meshBasicMaterial color={C.teal} />
          </mesh>
          <mesh position={[0, 0.2, 0.001]}>
            <circleGeometry args={[0.11, 32, 0, Math.PI]} />
            <meshBasicMaterial color={C.teal} />
          </mesh>
          <mesh position={[0, -0.0, 0]}>
            <planeGeometry args={[0.42, 0.05]} />
            <meshBasicMaterial color="#e9f4f3" />
          </mesh>
          <mesh position={[0, -0.09, 0]}>
            <planeGeometry args={[0.26, 0.035]} />
            <meshBasicMaterial color={C.mint} transparent opacity={0.6} />
          </mesh>
          {/* answer button */}
          <group position={[0, -0.5, 0]}>
            <mesh ref={btn}>
              <circleGeometry args={[0.15, 40]} />
              <meshBasicMaterial color="#21c07a" toneMapped={false} />
            </mesh>
            <group position={[0, 0, 0.002]} scale={0.95}>
              <Handset />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function MapPin() {
  const geo = useMemo(() => {
    const cy = 0.12;
    const r = 0.3;
    const tip = -0.48;
    const a = Math.asin(r / (cy - tip));
    const s = new THREE.Shape();
    s.moveTo(0, tip);
    s.quadraticCurveTo(r * Math.cos(a) * 0.45, tip + 0.17, r * Math.cos(a), cy - r * Math.sin(a));
    s.absarc(0, cy, r, -a, Math.PI + a, false);
    s.quadraticCurveTo(-r * Math.cos(a) * 0.45, tip + 0.17, 0, tip);
    const h = new THREE.Path();
    h.absarc(0, cy, 0.11, 0, Math.PI * 2, true);
    s.holes.push(h);
    return extrude(s, 0.16, 0.05);
  }, []);
  const pin = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (pin.current) {
      pin.current.position.y = 0.53 + Math.abs(Math.sin(t * 1.4)) * 0.14;
      pin.current.rotation.y = Math.sin(t * 0.7) * 0.45;
    }
    if (ring.current) {
      const p = (t * 0.5) % 1;
      ring.current.scale.setScalar(0.5 + p * 1.2);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.7;
    }
  });
  return (
    <group>
      <group ref={pin}>
        <mesh geometry={geo}>
          <Glossy color={C.teal} rough={0.2} />
        </mesh>
        <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.115, 0.115, 0.16, 32]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.25} />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 40]} />
        <meshStandardMaterial color={C.petrol} roughness={0.4} transparent opacity={0.85} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.3, 0.33, 48]} />
        <meshBasicMaterial color={C.glow} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function ContactScene() {
  return (
    <SceneRig scale={1.02} y={0.05}>
      <Float speed={1.2} rotationIntensity={0.12} floatIntensity={0.3}>
        <group position={[-0.3, -0.35, 0]} rotation={[0.1, -0.3, 0.02]}>
          <Envelope />
        </group>
      </Float>
      <Float speed={1.6} rotationIntensity={0.15} floatIntensity={0.45}>
        <group position={[1.75, 0.35, 0.7]} rotation={[0.05, -0.42, 0.08]}>
          <Phone />
        </group>
      </Float>
      <group position={[-1.9, 0.65, -0.6]} rotation={[0.2, 0.3, 0]}>
        <MapPin />
      </group>
    </SceneRig>
  );
}
