"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig, roundRect } from "./kit";

/*
 * Analysis & planning: a tilted glass dashboard with a growing bar chart and a
 * line chart, a magnifier hovering in front of the peak data point, a donut
 * chart and a roadmap with milestones below.
 * Layout (local units, nothing shares space):
 *   dashboard  x -1.6 … 1.8, y -0.75 … 1.45, z -0.3 (content up to z -0.05)
 *   magnifier  in front of the dashboard, z 0.35
 *   donut      x -2.5 … -1.5, y -2.0 … -1.0, z 0.6
 *   roadmap    x -0.95 … 2.05, y -1.85 … -1.25, z 0.55
 */
const PW = 3.4;
const PH = 2.2;
const CYCLE = 8;
const BARS = [0.42, 0.7, 0.56, 0.92, 1.18];
const LINE: [number, number][] = [
  [0.2, -0.55],
  [0.48, -0.25],
  [0.76, -0.38],
  [1.04, 0.05],
  [1.32, 0.42],
  [1.55, 0.22],
];
const PEAK = 4;

const grow = (t: number, a: number, b: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return 1 - Math.pow(1 - k, 3);
};

function Dashboard() {
  const bars = useRef<THREE.Group>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(LINE.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, "centripetal"), []);
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 120, 0.028, 8, false), [curve]);
  const dots = useRef<THREE.Group>(null);
  const fill = useMemo(() => {
    const pts = curve.getPoints(60);
    const s = new THREE.Shape();
    s.moveTo(pts[0].x, -0.78);
    pts.forEach((p) => s.lineTo(p.x, p.y));
    s.lineTo(pts[pts.length - 1].x, -0.78);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, [curve]);
  const fillMat = useRef<THREE.MeshBasicMaterial>(null);
  const rim = useMemo(() => {
    const o = new THREE.Shape();
    roundRect(o, -PW / 2, -PH / 2, PW, PH, 0.12);
    const h = new THREE.Path();
    roundRect(h, -PW / 2 + 0.018, -PH / 2 + 0.018, PW - 0.036, PH - 0.036, 0.105);
    o.holes.push(h);
    return new THREE.ShapeGeometry(o, 10);
  }, []);
  useFrame((s) => {
    const t = s.clock.elapsedTime % CYCLE;
    const out = t > CYCLE - 0.8 ? 1 - (t - (CYCLE - 0.8)) / 0.8 : 1;
    bars.current?.children.forEach((b, i) => {
      const k = Math.max(0.001, grow(t, 0.2 + i * 0.18, 1.2 + i * 0.18) * out);
      b.scale.y = k;
      b.position.y = -0.78 + (BARS[i] * k) / 2;
    });
    const d = grow(t, 1.0, 2.6) * out;
    tube.setDrawRange(0, Math.floor(d * 120) * 8 * 6);
    dots.current?.children.forEach((c, i) => {
      const at = i / (LINE.length - 1);
      c.scale.setScalar(d >= at - 0.001 ? 1 : 0.001);
    });
    if (fillMat.current) fillMat.current.opacity = 0.14 * grow(t, 2.2, 3.0) * out;
  });
  return (
    <group>
      {/* glass panel + thin glowing frame */}
      <RoundedBox args={[PW, PH, 0.05]} radius={0.12} smoothness={5}>
        <meshPhysicalMaterial color="#bff6ef" roughness={0.12} metalness={0} clearcoat={1} transparent opacity={0.22} envMapIntensity={1.6} depthWrite={false} />
      </RoundedBox>
      <RoundedBox args={[PW, PH, 0.02]} radius={0.12} smoothness={5} position={[0, 0, -0.04]}>
        <meshStandardMaterial color="#0a3a3f" roughness={0.4} transparent opacity={0.35} depthWrite={false} />
      </RoundedBox>
      <mesh geometry={rim} position={[0, 0, 0.028]}>
        <meshBasicMaterial color={C.glow} transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <group position={[-0.1, 0, 0.03]}>
        {/* header */}
        {[C.sun, C.glow, C.mint].map((c, i) => (
          <mesh key={c} position={[-1.4 + i * 0.13, 0.86, 0]}>
            <circleGeometry args={[0.04, 20]} />
            <meshBasicMaterial color={c} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[-0.65, 0.86, 0]}>
          <planeGeometry args={[0.8, 0.06]} />
          <meshBasicMaterial color={C.mint} transparent opacity={0.6} />
        </mesh>
        {/* gridlines + baseline */}
        {[-0.38, 0.02, 0.42].map((y) => (
          <mesh key={y} position={[0.05, y, 0]}>
            <planeGeometry args={[3.0, 0.008]} />
            <meshBasicMaterial color={C.mint} transparent opacity={0.18} />
          </mesh>
        ))}
        <mesh position={[0.05, -0.78, 0]}>
          <planeGeometry args={[3.0, 0.016]} />
          <meshBasicMaterial color={C.mint} transparent opacity={0.6} />
        </mesh>
        {/* separator between the two charts */}
        <mesh position={[0.02, -0.15, 0]}>
          <planeGeometry args={[0.01, 1.3]} />
          <meshBasicMaterial color={C.mint} transparent opacity={0.22} />
        </mesh>
        {/* bars grow out of the panel */}
        <group ref={bars} position={[0, 0, 0.1]}>
          {BARS.map((h, i) => (
            <RoundedBox key={i} args={[0.17, h, 0.16]} radius={0.04} smoothness={4} position={[-1.3 + i * 0.27, -0.78 + h / 2, 0]}>
              <Glossy color={i === BARS.length - 1 ? C.glow : i % 2 ? C.teal : C.petrol} emissive={i === BARS.length - 1 ? C.teal : undefined} emissiveIntensity={i === BARS.length - 1 ? 0.35 : 0} />
            </RoundedBox>
          ))}
        </group>
        {/* line chart */}
        <mesh geometry={fill} position={[0, 0, 0.01]}>
          <meshBasicMaterial ref={fillMat} color={C.glow} transparent opacity={0.14} depthWrite={false} />
        </mesh>
        <mesh geometry={tube} position={[0, 0, 0.04]}>
          <meshBasicMaterial color={C.glow} toneMapped={false} />
        </mesh>
        <group ref={dots} position={[0, 0, 0.04]}>
          {LINE.map(([x, y], i) => (
            <mesh key={i} position={[x, y, 0]}>
              <sphereGeometry args={[i === PEAK ? 0.075 : 0.05, 20, 20]} />
              <meshBasicMaterial color={i === PEAK ? C.sun : "#ffffff"} toneMapped={false} />
            </mesh>
          ))}
        </group>
        <Magnifier at={LINE[PEAK]} />
      </group>
    </group>
  );
}

/** Magnifying glass hovering in front of a data point, handle to the lower right. */
function Magnifier({ at }: { at: [number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      ref.current.position.x = at[0] + Math.sin(t * 0.9) * 0.03;
      ref.current.position.y = at[1] + Math.cos(t * 1.1) * 0.03;
    }
  });
  return (
    <group ref={ref} position={[at[0], at[1], 0.38]}>
      <mesh>
        <torusGeometry args={[0.27, 0.045, 20, 64]} />
        <Glossy color="#e9f3f2" metal={0.8} rough={0.18} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.26, 48]} />
        <meshPhysicalMaterial color="#d9fffa" roughness={0.05} clearcoat={1} transparent opacity={0.14} envMapIntensity={2} depthWrite={false} />
      </mesh>
      <mesh position={[0.08, 0.1, 0.01]} rotation={[0, 0, -0.6]}>
        <planeGeometry args={[0.05, 0.16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
      </mesh>
      <group rotation={[0, 0, Math.PI / 4]}>
        <mesh position={[0, -0.36, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.12, 20]} />
          <Glossy color="#e9f3f2" metal={0.8} rough={0.18} />
        </mesh>
        <mesh position={[0, -0.6, 0]}>
          <capsuleGeometry args={[0.065, 0.34, 8, 20]} />
          <Glossy color={C.petrol} rough={0.25} />
        </mesh>
      </group>
    </group>
  );
}

function Donut() {
  const parts = [
    { a: 0.38, c: C.teal },
    { a: 0.27, c: C.petrol },
    { a: 0.2, c: C.glow },
    { a: 0.15, c: C.sun },
  ];
  const ref = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.z -= d * 0.25;
  });
  let start = 0;
  return (
    <group ref={ref}>
      {parts.map((p, i) => {
        const len = p.a * Math.PI * 2 - 0.06;
        const el = (
          <mesh key={i} rotation={[0, 0, start]}>
            <torusGeometry args={[0.36, 0.12, 20, 48, len]} />
            <Glossy color={p.c} rough={0.2} />
          </mesh>
        );
        start += p.a * Math.PI * 2;
        return el;
      })}
    </group>
  );
}

/** Roadmap: a track with milestones; progress glides along and the current one carries a flag. */
function Roadmap() {
  const MS = [-1.3, -0.45, 0.4, 1.25];
  const progress = useRef<THREE.Mesh>(null);
  const flag = useRef<THREE.Group>(null);
  const marks = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime % CYCLE;
    const k = grow(t, 0.5, 5.5);
    const x = THREE.MathUtils.lerp(MS[0], MS[3], k);
    if (progress.current) {
      const w = x - MS[0];
      progress.current.scale.x = Math.max(0.001, w);
      progress.current.position.x = MS[0] + w / 2;
    }
    let cur = 0;
    MS.forEach((m, i) => {
      if (x >= m - 0.01) cur = i;
    });
    marks.current?.children.forEach((c, i) => {
      const done = i <= cur;
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.color.set(i === cur ? C.sun : done ? C.teal : "#e9f3f2");
      m.emissive.set(i === cur ? C.sun : "#000000");
      m.emissiveIntensity = i === cur ? 0.35 : 0;
    });
    if (flag.current) {
      flag.current.position.x = THREE.MathUtils.damp(flag.current.position.x, MS[cur], 8, dt);
      flag.current.rotation.y = Math.sin(s.clock.elapsedTime * 2) * 0.15;
    }
  });
  return (
    <group>
      <RoundedBox args={[3.0, 0.1, 0.1]} radius={0.05} smoothness={4}>
        <Glossy color="#0b3236" rough={0.35} />
      </RoundedBox>
      <mesh ref={progress} position={[MS[0], 0, 0.04]}>
        <boxGeometry args={[1, 0.05, 0.05]} />
        <meshBasicMaterial color={C.glow} toneMapped={false} />
      </mesh>
      <group ref={marks}>
        {MS.map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.14, 32]} />
            <meshStandardMaterial color="#e9f3f2" roughness={0.25} metalness={0.2} />
          </mesh>
        ))}
      </group>
      <group ref={flag} position={[MS[0], 0, 0]}>
        <mesh position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.56, 10]} />
          <Glossy color="#e9f3f2" metal={0.8} />
        </mesh>
        <mesh position={[0.13, 0.52, 0]}>
          <planeGeometry args={[0.24, 0.16]} />
          <meshStandardMaterial color={C.sun} emissive={C.sun} emissiveIntensity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

export default function AnalysisScene() {
  return (
    <SceneRig scale={1.04} y={0.05}>
      <Float speed={1} rotationIntensity={0.08} floatIntensity={0.25}>
        <group position={[0.1, 0.35, -0.3]} rotation={[-0.06, -0.28, 0.02]}>
          <Dashboard />
        </group>
      </Float>
      <Float speed={1.6} rotationIntensity={0.2} floatIntensity={0.4}>
        <group position={[-2.0, -1.5, 0.6]} rotation={[-0.55, 0.35, 0]}>
          <Donut />
        </group>
      </Float>
      <group position={[0.55, -1.7, 0.55]} rotation={[0.25, -0.28, 0]}>
        <Roadmap />
      </group>
    </SceneRig>
  );
}
