"use client";

import { Float, Line, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, Glow, SceneRig, useExtrude } from "./kit";

const CURVE = new THREE.CubicBezierCurve3(
  new THREE.Vector3(-2.0, -0.7, 0.2),
  new THREE.Vector3(-1.1, 1.75, 0.3),
  new THREE.Vector3(0.7, -1.85, 0.1),
  new THREE.Vector3(1.85, 0.75, 0.2),
);
const SEGMENTS = 160;
const CYCLE = 6.5;

/** Pen-tool nib as in design software: pointed nib with slit and hole on a collar. */
function PenTool() {
  const nib = useExtrude((s) => {
    s.moveTo(0, -1.0);
    s.bezierCurveTo(0.16, -0.62, 0.5, -0.25, 0.5, 0.18);
    s.lineTo(0.5, 0.42);
    s.lineTo(-0.5, 0.42);
    s.lineTo(-0.5, 0.18);
    s.bezierCurveTo(-0.5, -0.25, -0.16, -0.62, 0, -1.0);
    const hole = new THREE.Path();
    hole.absarc(0, -0.12, 0.1, 0, Math.PI * 2, true);
    s.holes.push(hole);
  }, 0.16, 0.035);
  const collar = useExtrude((s) => {
    s.moveTo(-0.56, 0);
    s.lineTo(0.56, 0);
    s.lineTo(0.5, 0.42);
    s.quadraticCurveTo(0.5, 0.5, 0.42, 0.5);
    s.lineTo(-0.42, 0.5);
    s.quadraticCurveTo(-0.5, 0.5, -0.5, 0.42);
    s.lineTo(-0.56, 0);
  }, 0.24, 0.04);
  return (
    <group>
      <mesh geometry={nib} position={[0, -0.29, 0]}>
        <Glossy color="#eef6f5" metal={0.25} rough={0.14} />
      </mesh>
      {/* slit from hole to tip */}
      <mesh position={[0, -0.95, 0.1]}>
        <boxGeometry args={[0.025, 0.55, 0.02]} />
        <meshStandardMaterial color="#0b2b2e" />
      </mesh>
      <mesh geometry={collar} position={[0, 0.38, 0]}>
        <Glossy color={C.petrol} metal={0.35} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <boxGeometry args={[1.02, 0.05, 0.27]} />
        <Glossy color={C.teal} emissive={C.teal} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

/** The curve being drawn, anchor points, handles and the pen following the tip. */
function DrawingPath() {
  const tube = useMemo(() => new THREE.TubeGeometry(CURVE, SEGMENTS, 0.035, 10, false), []);
  const pen = useRef<THREE.Group>(null);
  const handles: [THREE.Vector3, THREE.Vector3][] = [
    [CURVE.v0, CURVE.v1],
    [CURVE.v3, CURVE.v2],
  ];
  useFrame((s) => {
    const t = (s.clock.elapsedTime % CYCLE) / CYCLE;
    const p = Math.min(1, t / 0.75);
    const eased = 1 - Math.pow(1 - p, 2);
    const visible = t > 0.92 ? 0 : eased;
    const per = 10 * 6; // radial segments * 6 indices
    tube.setDrawRange(0, Math.floor(visible * SEGMENTS) * per);
    if (pen.current) {
      const tip = CURVE.getPoint(Math.max(0.001, eased));
      pen.current.position.copy(tip);
      pen.current.rotation.z = -0.5 + Math.sin(s.clock.elapsedTime * 2) * 0.04;
    }
  });
  return (
    <group>
      <mesh geometry={tube}>
        <meshStandardMaterial color={C.glow} emissive={C.glow} emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      {/* guide line (the full path, faint) */}
      <Line points={CURVE.getPoints(80)} color={C.mint} lineWidth={1} transparent opacity={0.18} />
      {handles.map(([a, b], i) => (
        <group key={i}>
          <Line points={[a, b]} color={C.mint} lineWidth={1.2} transparent opacity={0.65} />
          <mesh position={b}>
            <sphereGeometry args={[0.075, 24, 24]} />
            <Glossy color="#ffffff" />
          </mesh>
        </group>
      ))}
      {[CURVE.v0, CURVE.v3].map((a, i) => (
        <group key={i} position={a}>
          <mesh>
            <boxGeometry args={[0.2, 0.2, 0.06]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 0, 0.032]}>
            <planeGeometry args={[0.12, 0.12]} />
            <meshBasicMaterial color={C.teal} />
          </mesh>
        </group>
      ))}
      <group ref={pen}>
        <group position={[0, 0, 0.15]} rotation={[0.15, -0.35, 0]} scale={0.95}>
          <group position={[0, 1.0, 0]}>
            <PenTool />
          </group>
        </group>
      </group>
    </group>
  );
}

/** Stacked layers / artboards. */
function Layers() {
  const colors = [C.petrol, C.teal, "#f4fbfa"];
  return (
    <group position={[-1.75, 1.2, -0.9]} rotation={[-0.5, 0.45, 0.1]}>
      {colors.map((c, i) => (
        <Float key={c} speed={1.4 + i * 0.3} floatIntensity={0.25} rotationIntensity={0}>
          <RoundedBox args={[1.1, 0.75, 0.04]} radius={0.06} position={[i * 0.12, i * 0.16, i * 0.22]}>
            <Glossy color={c} rough={0.25} opacity={i === 2 ? 0.92 : undefined} />
          </RoundedBox>
        </Float>
      ))}
      <mesh position={[0.05, 0.25, 0.47]}>
        <circleGeometry args={[0.12, 32]} />
        <meshBasicMaterial color={C.sun} />
      </mesh>
      <mesh position={[0.35, 0.18, 0.47]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.18, 0.18]} />
        <meshBasicMaterial color={C.teal} />
      </mesh>
    </group>
  );
}

/** Colour fan that keeps opening and closing. */
function Swatches() {
  const ref = useRef<THREE.Group>(null);
  const colors = [C.petrol, C.teal, C.glow, "#9ff3ea", C.sun, "#ffffff"];
  useFrame((s) => {
    if (!ref.current) return;
    const open = 0.5 + Math.sin(s.clock.elapsedTime * 0.7) * 0.5;
    ref.current.children.forEach((c, i) => {
      if (i < colors.length) c.rotation.z = (i - (colors.length - 1) / 2) * 0.2 * (0.25 + open * 0.75);
    });
  });
  return (
    <group ref={ref} position={[1.75, -1.55, 0.5]} rotation={[0.1, -0.3, 0]}>
      {colors.map((c, i) => (
        <group key={c}>
          <RoundedBox args={[0.3, 1.15, 0.025]} radius={0.012} position={[0, 0.58, i * 0.03]}>
            <Glossy color={c} rough={0.3} />
          </RoundedBox>
        </group>
      ))}
      <mesh position={[0, 0.08, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.24, 20]} />
        <Glossy color="#e8f1f0" metal={0.85} rough={0.2} />
      </mesh>
    </group>
  );
}

/** Colour wheel from a conic gradient texture. */
function ColorWheel() {
  const tex = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createConicGradient(0, size / 2, size / 2);
    ["#ff5f6d", "#ffbe11", "#4fe0d2", "#19b3a9", "#2b6cff", "#b06bff", "#ff5f6d"].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const r = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.75, "rgba(255,255,255,0)");
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.z += d * 0.3;
  });
  return (
    <group position={[0.15, 1.6, -0.7]} rotation={[0.2, -0.3, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.08, 64]} />
        <Glossy color="#eef6f5" />
      </mesh>
      <mesh ref={ref} position={[0, 0, 0.045]}>
        <circleGeometry args={[0.44, 64]} />
        <meshStandardMaterial map={tex} roughness={0.35} />
      </mesh>
      <mesh position={[0.18, 0.12, 0.06]}>
        <torusGeometry args={[0.06, 0.018, 12, 32]} />
        <Glow color="#ffffff" />
      </mesh>
    </group>
  );
}

export default function DesignScene() {
  return (
    <SceneRig scale={0.86}>
      <Layers />
      <DrawingPath />
      <Swatches />
      <Float speed={2} floatIntensity={0.6} rotationIntensity={0.3}>
        <ColorWheel />
      </Float>
    </SceneRig>
  );
}
