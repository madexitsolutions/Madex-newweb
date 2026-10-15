"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig, roundRect, useExtrude } from "./kit";

/*
 * Custom AI solutions: a processor core with a sun spark at its heart sends
 * light pulses to five capability modules — automation, documents, analysis,
 * assistant, integrations. Layout (local units): chip ±0.85 around the origin,
 * tiles (0.8 wide) on an ellipse rx 2.0 / ry 1.55 — no overlaps.
 */
const CHIP = 1.36;
const TILE = 0.82;
const ICON = "#025159";

type Kind = "gear" | "doc" | "chart" | "chat" | "plug";
const MODULES: { kind: Kind; pos: [number, number, number] }[] = [
  { kind: "gear", pos: [0, 1.62, -0.15] },
  { kind: "plug", pos: [1.98, 0.5, 0] },
  { kind: "chart", pos: [1.22, -1.32, 0.25] },
  { kind: "doc", pos: [-1.22, -1.32, 0.25] },
  { kind: "chat", pos: [-1.98, 0.5, 0] },
];
const PERIOD = 3.2;

function GearIcon() {
  const geo = useExtrude((s) => {
    const teeth = 8;
    const ro = 0.25;
    const ri = 0.19;
    for (let i = 0; i < teeth * 4; i++) {
      const a = (i / (teeth * 4)) * Math.PI * 2;
      const r = i % 4 === 1 || i % 4 === 2 ? ro : ri;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    const h = new THREE.Path();
    h.absarc(0, 0, 0.085, 0, Math.PI * 2, true);
    s.holes.push(h);
  }, 0.08, 0.015);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.z -= d * 0.6;
  });
  return (
    <mesh ref={ref} geometry={geo}>
      <Glossy color={C.teal} metal={0.3} />
    </mesh>
  );
}

function DocIcon() {
  const page = useExtrude((s) => {
    s.moveTo(-0.2, -0.27);
    s.lineTo(0.2, -0.27);
    s.lineTo(0.2, 0.15);
    s.lineTo(0.08, 0.27);
    s.lineTo(-0.2, 0.27);
    s.closePath();
  }, 0.05, 0.012);
  const fold = useExtrude((s) => {
    s.moveTo(0.08, 0.27);
    s.lineTo(0.08, 0.15);
    s.lineTo(0.2, 0.15);
    s.closePath();
  }, 0.02, 0.006);
  return (
    <group>
      <mesh geometry={page}>
        <Glossy color={C.petrol} />
      </mesh>
      <mesh geometry={fold} position={[0.14, 0.21, 0.045]}>
        <Glossy color={C.glow} />
      </mesh>
      {[0.07, -0.03, -0.13].map((y, i) => (
        <mesh key={y} position={[-0.02 - (i === 2 ? 0.04 : 0), y, 0.043]}>
          <planeGeometry args={[i === 2 ? 0.2 : 0.28, 0.035]} />
          <meshBasicMaterial color="#d8f3ef" />
        </mesh>
      ))}
    </group>
  );
}

function ChartIcon() {
  return (
    <group>
      {[0.16, 0.28, 0.42].map((h, i) => (
        <RoundedBox key={i} args={[0.11, h, 0.08]} radius={0.025} position={[-0.15 + i * 0.15, -0.22 + h / 2, 0]}>
          <Glossy color={i === 2 ? C.teal : C.petrol} />
        </RoundedBox>
      ))}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[0.46, 0.025, 0.06]} />
        <meshStandardMaterial color={ICON} />
      </mesh>
      <mesh position={[0.15, 0.27, 0.02]}>
        <sphereGeometry args={[0.045, 20, 20]} />
        <meshBasicMaterial color={C.sun} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ChatIcon() {
  const geo = useExtrude((s) => {
    roundRect(s, -0.26, -0.12, 0.52, 0.36, 0.1);
    s.moveTo(-0.14, -0.11);
    s.lineTo(-0.2, -0.26);
    s.lineTo(-0.02, -0.11);
  }, 0.06, 0.014);
  return (
    <group>
      <mesh geometry={geo}>
        <Glossy color={C.teal} />
      </mesh>
      {[-0.12, 0, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.04, 0.05]}>
          <circleGeometry args={[0.035, 20]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

function PlugIcon() {
  return (
    <group rotation={[0, 0, -0.35]}>
      <RoundedBox args={[0.3, 0.26, 0.1]} radius={0.05} position={[0, -0.02, 0]}>
        <Glossy color={C.petrol} />
      </RoundedBox>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 0.19, 0]}>
          <boxGeometry args={[0.045, 0.14, 0.045]} />
          <Glossy color="#dfe9e8" metal={0.85} rough={0.2} />
        </mesh>
      ))}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.12, 16]} />
        <Glossy color={C.teal} />
      </mesh>
    </group>
  );
}

const ICONS: Record<Kind, () => React.JSX.Element> = { gear: GearIcon, doc: DocIcon, chart: ChartIcon, chat: ChatIcon, plug: PlugIcon };

function Tile({ kind, index }: { kind: Kind; index: number }) {
  const Icon = ICONS[kind];
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const rim = useMemo(() => {
    const sh = new THREE.Shape();
    const o = TILE / 2 + 0.05;
    roundRect(sh, -o, -o, o * 2, o * 2, 0.18);
    const h = new THREE.Path();
    const i = TILE / 2 - 0.02;
    roundRect(h, -i, -i, i * 2, i * 2, 0.13);
    sh.holes.push(h);
    return new THREE.ShapeGeometry(sh, 12);
  }, []);
  useFrame((s) => {
    // light up the moment this tile's pulse arrives
    const k = ((s.clock.elapsedTime + index * (PERIOD / MODULES.length)) % PERIOD) / PERIOD;
    const hit = k > 0.55 && k < 0.85 ? Math.sin(((k - 0.55) / 0.3) * Math.PI) : 0;
    if (ring.current) ring.current.opacity = 0.25 + hit * 0.75;
  });
  return (
    <group>
      <RoundedBox args={[TILE, TILE, 0.16]} radius={0.14} smoothness={5}>
        <Glossy color="#f7fcfb" rough={0.2} emissive="#e6f7f5" emissiveIntensity={0.12} />
      </RoundedBox>
      {/* glowing edge that flashes when the pulse lands */}
      <mesh geometry={rim} position={[0, 0, -0.01]}>
        <meshBasicMaterial ref={ring} color={C.glow} transparent opacity={0.25} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <group position={[0, 0, 0.12]}>
        <Icon />
      </group>
    </group>
  );
}

/** Four-point spark extruded, sun coloured. */
function Spark() {
  const geo = useExtrude((s) => {
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 0.3 : 0.085;
      const a = (i / 8) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
  }, 0.06, 0.03);
  const ref = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const beat = 1 + Math.pow(Math.max(0, Math.sin(t * (Math.PI * 2 / PERIOD) * MODULES.length * 0.5)), 6) * 0.12;
    if (ref.current) {
      ref.current.scale.setScalar(beat);
      ref.current.rotation.z = Math.sin(t * 0.5) * 0.2;
    }
    if (halo.current) (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + (beat - 1) * 2.5;
  });
  return (
    <group>
      <mesh ref={halo} position={[0, 0, -0.01]}>
        <circleGeometry args={[0.36, 48]} />
        <meshBasicMaterial color={C.sun} transparent opacity={0.2} toneMapped={false} />
      </mesh>
      <group ref={ref}>
        <mesh geometry={geo}>
          <meshStandardMaterial color={C.sun} emissive={C.sun} emissiveIntensity={0.7} roughness={0.25} metalness={0.1} />
        </mesh>
      </group>
    </group>
  );
}

/** Processor: dark package with pins, petrol die with glowing circuit traces, spark core. */
function Chip() {
  const traces = useMemo(() => {
    const out: { p: [number, number]; s: [number, number] }[] = [];
    // L-shaped traces from the core towards the die edge, rotated four times
    const arms: [number, number, number, number][] = [
      [0.26, 0.06, 0.4, 0.06],
      [0.26, -0.1, 0.32, -0.1],
      [0.32, -0.1, 0.32, -0.3],
    ];
    for (let q = 0; q < 4; q++) {
      const a = (q * Math.PI) / 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      arms.forEach(([x1, y1, x2, y2]) => {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const len = Math.hypot(x2 - x1, y2 - y1);
        const horiz = Math.abs(y2 - y1) < 1e-6;
        const px = mx * c - my * sn;
        const py = mx * sn + my * c;
        const w = 0.022;
        const along: [number, number] = horiz ? [len + w, w] : [w, len + w];
        out.push({ p: [px, py], s: q % 2 === 0 ? along : [along[1], along[0]] });
      });
    }
    return out;
  }, []);
  const pads = useMemo(() => {
    const out: [number, number][] = [];
    for (let q = 0; q < 4; q++) {
      const a = (q * Math.PI) / 2;
      [[0.4, 0.06], [0.32, -0.3]].forEach(([x, y]) => out.push([x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]));
    }
    return out;
  }, []);
  const pins = useMemo(() => {
    const out: { p: [number, number, number]; r: number }[] = [];
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < 6; i++) {
        const o = -0.5 + (i / 5) * 1.0;
        const d = CHIP / 2 + 0.08;
        const a = (side * Math.PI) / 2;
        out.push({ p: [Math.cos(a) * d - Math.sin(a) * o, Math.sin(a) * d + Math.cos(a) * o, 0], r: a });
      }
    }
    return out;
  }, []);
  return (
    <group>
      <RoundedBox args={[CHIP, CHIP, 0.2]} radius={0.09} smoothness={5}>
        <Glossy color="#0b2f33" metal={0.5} rough={0.3} />
      </RoundedBox>
      {pins.map(({ p, r }, i) => (
        <mesh key={i} position={p} rotation={[0, 0, r]}>
          <boxGeometry args={[0.18, 0.07, 0.05]} />
          <Glossy color="#d9e6e5" metal={0.9} rough={0.22} />
        </mesh>
      ))}
      <RoundedBox args={[0.98, 0.98, 0.06]} radius={0.05} position={[0, 0, 0.12]}>
        <Glossy color={C.petrol} metal={0.3} rough={0.18} />
      </RoundedBox>
      <group position={[0, 0, 0.152]}>
        {traces.map(({ p, s }, i) => (
          <mesh key={i} position={[p[0], p[1], 0]}>
            <planeGeometry args={s} />
            <meshBasicMaterial color={C.glow} transparent opacity={0.85} toneMapped={false} />
          </mesh>
        ))}
        {pads.map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.001]}>
            <circleGeometry args={[0.035, 20]} />
            <meshBasicMaterial color={C.mint} toneMapped={false} />
          </mesh>
        ))}
        {/* core socket */}
        <mesh position={[0, 0, 0.002]}>
          <ringGeometry args={[0.2, 0.235, 48]} />
          <meshBasicMaterial color={C.glow} toneMapped={false} />
        </mesh>
      </group>
      <group position={[0, 0, 0.2]}>
        <Spark />
      </group>
    </group>
  );
}

/** Thin glowing link from the chip edge to a module, with a pulse travelling outwards. */
function Link({ to, index }: { to: [number, number, number]; index: number }) {
  const { curve, tube } = useMemo(() => {
    const end = new THREE.Vector3(...to);
    const dir = new THREE.Vector3(to[0], to[1], 0).normalize();
    const start = dir.clone().multiplyScalar(CHIP * 0.5 + 0.18).setZ(0);
    // stop at the tile edge (half-diagonal along the direction is ~0.41–0.58)
    const stop = end.clone().sub(dir.clone().multiplyScalar(TILE * 0.5 + 0.05));
    stop.z = end.z - 0.04;
    const mid = start.clone().lerp(stop, 0.5);
    mid.z += 0.35;
    const c = new THREE.QuadraticBezierCurve3(start, mid, stop);
    return { curve: c, tube: new THREE.TubeGeometry(c, 40, 0.012, 6, false) };
  }, [to]);
  const pulse = useRef<THREE.Group>(null);
  useFrame((s) => {
    const k = ((s.clock.elapsedTime + index * (PERIOD / MODULES.length)) % PERIOD) / PERIOD;
    const p = Math.min(1, k / 0.6);
    if (pulse.current) {
      pulse.current.visible = k < 0.62;
      pulse.current.position.copy(curve.getPoint(1 - Math.pow(1 - p, 2)));
      pulse.current.scale.setScalar(0.6 + Math.sin(p * Math.PI) * 0.6);
    }
  });
  return (
    <group>
      <mesh geometry={tube}>
        <meshBasicMaterial color={C.glow} transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <group ref={pulse}>
        <mesh>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color={C.glow} transparent opacity={0.35} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

export default function AiScene() {
  return (
    <SceneRig scale={1.02} y={-0.2}>
      <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.3}>
        <group position={[-0.1, 0, 0]} rotation={[0.18, -0.28, 0]}>
          <Chip />
          {MODULES.map((m, i) => (
            <group key={m.kind}>
              <Link to={m.pos} index={i} />
              <group position={m.pos}>
                <Float speed={1.4 + i * 0.15} rotationIntensity={0.25} floatIntensity={0.15}>
                  <Tile kind={m.kind} index={i} />
                </Float>
              </group>
            </group>
          ))}
        </group>
      </Float>
    </SceneRig>
  );
}
