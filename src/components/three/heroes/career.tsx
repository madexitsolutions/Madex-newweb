"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig, useExtrude } from "./kit";

/*
 * Career growth: a figure climbs a staircase of glossy blocks towards a glowing
 * star; a briefcase waits at the foot of the stairs.
 * Layout (local units, stairs group): ground y G, step i spans x[i] ± 0.3,
 * top at G + RISE·(i+1); star floats 1.1 above the top step, clear of the
 * figure's head; briefcase stands on the ground left of step 0.
 */
const G = -2.1;
const RISE = 0.38;
const RUN = 0.62;
const N = 5;
const X0 = -0.95;
const stepX = (i: number) => X0 + i * RUN;
const stepTop = (i: number) => G + RISE * (i + 1);
const COLORS = ["#0b4248", C.petrol, "#036b6c", C.teal, "#13a89e"];

const HOP = 0.62;
const PAUSE = 0.48;
const TOP_HOLD = 2.0;
const CYCLE = (N - 1) * (HOP + PAUSE) + TOP_HOLD + 0.5;

function Stairs() {
  return (
    <group>
      {Array.from({ length: N }, (_, i) => {
        const h = RISE * (i + 1);
        return (
          <RoundedBox key={i} args={[RUN - 0.03, h, 1.0]} radius={0.05} smoothness={4} position={[stepX(i), G + h / 2, 0]}>
            <Glossy color={COLORS[i]} rough={0.2} metal={0.15} />
          </RoundedBox>
        );
      })}
      {/* glowing edge on each tread */}
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} position={[stepX(i), stepTop(i) + 0.003, 0.48]}>
          <boxGeometry args={[RUN - 0.12, 0.012, 0.02]} />
          <meshBasicMaterial color={C.glow} toneMapped={false} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Simple person: rounded torso and head, origin at the feet. */
function Figure() {
  const body = useMemo(() => {
    const pts = [
      [0, 0],
      [0.15, 0],
      [0.17, 0.03],
      [0.19, 0.3],
      [0.18, 0.38],
      [0.13, 0.44],
      [0.05, 0.47],
      [0, 0.47],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 40);
  }, []);
  return (
    <group>
      <mesh geometry={body}>
        <Glossy color="#f4fbfa" rough={0.18} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.06, 16]} />
        <Glossy color="#dfeceb" rough={0.2} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.125, 32, 32]} />
        <Glossy color="#f4fbfa" rough={0.18} />
      </mesh>
    </group>
  );
}

function Star({ celebrate }: { celebrate: React.RefObject<number> }) {
  const geo = useExtrude((s) => {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.44 : 0.19;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
  }, 0.1, 0.05);
  const ref = useRef<THREE.Group>(null);
  const burst = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const glowTex = useMemo(() => {
    const n = 128;
    const cv = document.createElement("canvas");
    cv.width = cv.height = n;
    const ctx = cv.getContext("2d")!;
    const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.35, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
    return new THREE.CanvasTexture(cv);
  }, []);
  useFrame((s) => {
    const c = celebrate.current ?? 0;
    if (ref.current) {
      ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.8) * 0.3;
      ref.current.scale.setScalar(1 + Math.sin(Math.min(1, c * 2) * Math.PI) * 0.18);
    }
    if (burst.current) {
      burst.current.visible = c > 0 && c < 1;
      burst.current.scale.setScalar(0.6 + c * 1.6);
      (burst.current.material as THREE.MeshBasicMaterial).opacity = (1 - c) * 0.8;
    }
    if (halo.current) halo.current.opacity = 0.45 + (c > 0 && c < 1 ? (1 - c) * 0.4 : 0) + Math.sin(s.clock.elapsedTime * 2) * 0.06;
  });
  return (
    <group>
      <mesh position={[0, 0, -0.15]}>
        <planeGeometry args={[1.9, 1.9]} />
        <meshBasicMaterial ref={halo} map={glowTex} color={C.sun} transparent opacity={0.5} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={burst}>
        <ringGeometry args={[0.5, 0.54, 64]} />
        <meshBasicMaterial color={C.sun} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <group ref={ref}>
        <mesh geometry={geo}>
          <meshStandardMaterial color={C.sun} emissive={C.sun} emissiveIntensity={0.55} roughness={0.25} metalness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

function Briefcase() {
  const handle = useMemo(() => new THREE.TorusGeometry(0.12, 0.035, 12, 32, Math.PI), []);
  return (
    <group>
      <RoundedBox args={[0.78, 0.54, 0.26]} radius={0.07} smoothness={5} position={[0, 0.27, 0]}>
        <Glossy color="#eef6f5" rough={0.22} metal={0.1} />
      </RoundedBox>
      {/* lid seam + band */}
      <mesh position={[0, 0.38, 0.132]}>
        <boxGeometry args={[0.7, 0.018, 0.01]} />
        <meshStandardMaterial color="#8fb3b1" />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.27, 0.134]}>
          <boxGeometry args={[0.05, 0.5, 0.012]} />
          <Glossy color={C.petrol} />
        </mesh>
      ))}
      {/* clasp */}
      <RoundedBox args={[0.13, 0.08, 0.04]} radius={0.015} position={[0, 0.38, 0.14]}>
        <Glossy color={C.sun} metal={0.6} rough={0.2} />
      </RoundedBox>
      <mesh geometry={handle} position={[0, 0.54, 0]}>
        <Glossy color="#0a2b2f" metal={0.4} />
      </mesh>
    </group>
  );
}

export default function CareerScene() {
  const fig = useRef<THREE.Group>(null);
  const celebrate = useRef(0);
  useFrame((s) => {
    const t = s.clock.elapsedTime % CYCLE;
    const climb = (N - 1) * (HOP + PAUSE);
    let x: number;
    let y: number;
    let sc = 1;
    let squash = 1;
    if (t < climb) {
      const i = Math.floor(t / (HOP + PAUSE));
      const local = t - i * (HOP + PAUSE);
      if (local < PAUSE) {
        x = stepX(i);
        y = stepTop(i);
        // crouch just before the jump, settle just after landing
        const k = local / PAUSE;
        squash = 1 - (k > 0.7 ? (k - 0.7) / 0.3 : 0) * 0.12 - (k < 0.2 ? (1 - k / 0.2) * 0.08 : 0);
      } else {
        const k = (local - PAUSE) / HOP;
        const e = k * k * (3 - 2 * k);
        x = THREE.MathUtils.lerp(stepX(i), stepX(i + 1), e);
        y = THREE.MathUtils.lerp(stepTop(i), stepTop(i + 1), e) + Math.sin(k * Math.PI) * 0.32;
      }
      celebrate.current = 0;
    } else {
      x = stepX(N - 1);
      y = stepTop(N - 1);
      const k = t - climb;
      celebrate.current = Math.min(1, k / 1.2);
      // shrink away and reappear at the bottom
      const out = k > TOP_HOLD ? Math.min(1, (k - TOP_HOLD) / 0.25) : 0;
      sc = 1 - out;
      if (k < 0.5) y += Math.sin((k / 0.5) * Math.PI) * 0.12;
    }
    // pop in at the start
    if (t < 0.25) sc = t / 0.25;
    if (fig.current) {
      fig.current.position.set(x, y, 0.05);
      fig.current.scale.set(sc, Math.max(0.001, sc * squash), sc);
    }
  });
  return (
    <SceneRig scale={1.06} y={0.15}>
      <group rotation={[0.3, 0.62, 0]} position={[-0.1, -0.1, 0]}>
        <Stairs />
        <group ref={fig}>
          <group scale={1.12}>
            <Figure />
          </group>
        </group>
        <group position={[stepX(N - 1), stepTop(N - 1) + 1.95, -0.1]}>
          <Float speed={1.4} floatIntensity={0.3} rotationIntensity={0}>
            <group scale={1.2}>
              <Star celebrate={celebrate} />
            </group>
          </Float>
        </group>
        <group position={[stepX(0) - 1.0, G, 0.25]} rotation={[0, -0.35, 0]} scale={1.15}>
          <Briefcase />
        </group>
      </group>
    </SceneRig>
  );
}
