"use client";

import { Float, Line, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig } from "./kit";

/*
 * Layout (local units, before SceneRig scale):
 *   path + pen sweep the lower band (y -1.3 … 1.0), pen body always up-right of the tip
 *   layers  — upper left, set back   (x -2.3 … -1.0, y 1.1 … 2.0, z -1.1)
 *   wheel   — lower left, below the path start (x -2.0 … -1.0, y -2.1 … -1.1)
 *   swatches— lower right, in front  (x 1.4 … 2.3,  y -2.1 … -0.9, z 0.6)
 */
const CURVE = new THREE.CubicBezierCurve3(
  new THREE.Vector3(-2.05, -0.55, 0.25),
  new THREE.Vector3(-1.35, 0.75, 0.25),
  new THREE.Vector3(-0.35, -1.95, 0.25),
  new THREE.Vector3(0.55, -0.45, 0.25),
);
const SEGMENTS = 180;
const RADIAL = 10;
const CYCLE = 7.5;

/** Extrude a shape keeping its own origin (only z is centred) so the nib tip stays at (0,0). */
function extrudeKeep(shape: THREE.Shape, depth: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 32 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Keyhole = breathing hole + slit running down towards the tip. */
function keyhole(p: THREE.Path, cy: number, r: number, wTop: number, wBot: number, yBot: number) {
  const a0 = Math.asin(wTop / r);
  p.moveTo(wBot, yBot);
  p.lineTo(wTop, cy - r * Math.cos(a0));
  p.absarc(0, cy, r, -Math.PI / 2 + a0, (3 * Math.PI) / 2 - a0, false);
  p.lineTo(-wBot, yBot);
  p.lineTo(wBot, yBot);
}

const HOLE = { cy: 0.8, r: 0.095, wTop: 0.028, wBot: 0.011, yBot: 0.16 };

/**
 * Photoshop-style pen tool: a fountain-pen nib (pointed tip, slit, breathing hole,
 * curved shoulders) under a rectangular collar. Built with the tip at the origin,
 * body pointing up +y.
 */
function PenTool() {
  const { nib, inlay, collar } = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.08, 0.26, 0.45, 0.56, 0.45, 0.98);
    s.quadraticCurveTo(0.45, 1.2, 0.31, 1.3);
    s.lineTo(0.31, 1.36);
    s.lineTo(-0.31, 1.36);
    s.lineTo(-0.31, 1.3);
    s.quadraticCurveTo(-0.45, 1.2, -0.45, 0.98);
    s.bezierCurveTo(-0.45, 0.56, -0.08, 0.26, 0, 0);
    const hole = new THREE.Path();
    keyhole(hole, HOLE.cy, HOLE.r, HOLE.wTop, HOLE.wBot, HOLE.yBot);
    s.holes.push(hole);

    const fill = new THREE.Shape();
    keyhole(fill, HOLE.cy, HOLE.r + 0.01, HOLE.wTop + 0.008, HOLE.wBot + 0.006, HOLE.yBot - 0.01);

    const c = new THREE.Shape();
    const r = 0.06;
    c.moveTo(-0.36, 0);
    c.lineTo(0.36, 0);
    c.lineTo(0.4 - 0.004, 0.42 - r);
    c.quadraticCurveTo(0.4, 0.42, 0.4 - r, 0.42);
    c.lineTo(-0.4 + r, 0.42);
    c.quadraticCurveTo(-0.4, 0.42, -0.4 + 0.004, 0.42 - r);
    c.lineTo(-0.36, 0);
    return { nib: extrudeKeep(s, 0.09, 0.024), inlay: new THREE.ShapeGeometry(fill, 32), collar: extrudeKeep(c, 0.2, 0.04) };
  }, []);

  return (
    <group>
      {/* nib */}
      <mesh geometry={nib}>
        <meshPhysicalMaterial color="#f6fafa" metalness={0.25} roughness={0.14} clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={1.4} />
      </mesh>
      {/* dark recess visible through slit + hole */}
      <mesh geometry={inlay} position={[0, 0, 0.038]}>
        <meshStandardMaterial color="#061a1c" roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* neck between nib and collar */}
      <mesh position={[0, 1.39, 0]}>
        <boxGeometry args={[0.5, 0.1, 0.12]} />
        <meshStandardMaterial color="#0a2b2f" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* collar */}
      <group position={[0, 1.44, 0]}>
        <mesh geometry={collar}>
          <Glossy color={C.petrol} metal={0.35} rough={0.2} />
        </mesh>
        <mesh position={[0, 0.1, 0.143]}>
          <boxGeometry args={[0.66, 0.035, 0.01]} />
          <meshBasicMaterial color={C.glow} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

const ease = (x: number) => 1 - Math.pow(1 - x, 3);
const smooth = (x: number) => x * x * (3 - 2 * x);

/** The curve being drawn, anchor points, handles and the pen whose tip rides the path end. */
function DrawingPath() {
  const tube = useMemo(() => new THREE.TubeGeometry(CURVE, SEGMENTS, 0.035, RADIAL, false), []);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const pen = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const handles: [THREE.Vector3, THREE.Vector3][] = [
    [CURVE.v0, CURVE.v1],
    [CURVE.v3, CURVE.v2],
  ];
  const guide = useMemo(() => CURVE.getPoints(90), []);
  useFrame((s) => {
    const t = (s.clock.elapsedTime % CYCLE) / CYCLE;
    // 0–0.62 draw · 0.62–0.8 hold · 0.8–0.88 fade · 0.84–1 pen glides back
    const draw = ease(Math.min(1, t / 0.62));
    const fade = t < 0.8 ? 1 : Math.max(0, 1 - (t - 0.8) / 0.08);
    tube.setDrawRange(0, Math.floor((fade > 0 ? draw : 0) * SEGMENTS) * RADIAL * 6);
    if (mat.current) mat.current.opacity = fade;
    if (pen.current) {
      if (t < 0.84) {
        pen.current.position.copy(CURVE.getPoint(Math.max(0.0005, draw)));
      } else {
        const k = smooth((t - 0.84) / 0.16);
        pen.current.position.lerpVectors(CURVE.v3, CURVE.v0, k);
        pen.current.position.z += Math.sin(k * Math.PI) * 0.35;
      }
    }
    if (tilt.current) tilt.current.rotation.x = Math.sin(s.clock.elapsedTime * 1.6) * 0.05;
  });
  return (
    <group>
      <mesh geometry={tube}>
        <meshStandardMaterial ref={mat} color={C.glow} emissive={C.glow} emissiveIntensity={0.9} toneMapped={false} transparent />
      </mesh>
      {/* the full path, faint, as a guide */}
      <Line points={guide} color={C.mint} lineWidth={1} transparent opacity={0.16} />
      {handles.map(([a, b], i) => (
        <group key={i}>
          <Line points={[a, b]} color={C.mint} lineWidth={1.2} transparent opacity={0.6} />
          <mesh position={b}>
            <sphereGeometry args={[0.07, 24, 24]} />
            <Glossy color="#ffffff" />
          </mesh>
        </group>
      ))}
      {[CURVE.v0, CURVE.v3].map((a, i) => (
        <group key={i} position={a}>
          <RoundedBox args={[0.2, 0.2, 0.06]} radius={0.015}>
            <meshStandardMaterial color="#ffffff" />
          </RoundedBox>
          <mesh position={[0, 0, 0.032]}>
            <planeGeometry args={[0.12, 0.12]} />
            <meshBasicMaterial color={C.teal} />
          </mesh>
        </group>
      ))}
      {/* tip at the group origin, body pointing up-right at 45° like the Photoshop icon */}
      <group ref={pen}>
        <group rotation={[0, -0.32, 0]}>
          <group ref={tilt}>
            <group rotation={[0, 0, -Math.PI / 4]} scale={1.05}>
              <PenTool />
            </group>
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
    <group position={[-1.75, 1.45, -1.1]} rotation={[-0.35, 0.45, 0.06]}>
      {colors.map((c, i) => (
        <Float key={c} speed={1.4 + i * 0.3} floatIntensity={0.2} rotationIntensity={0}>
          <RoundedBox args={[1.1, 0.75, 0.04]} radius={0.06} position={[i * 0.1, i * 0.12, i * 0.2]}>
            <Glossy color={c} rough={0.25} />
          </RoundedBox>
          {i === 2 && (
            <group position={[0.2, 0.24, 0.43]}>
              <mesh position={[-0.2, 0.06, 0]}>
                <circleGeometry args={[0.12, 32]} />
                <meshBasicMaterial color={C.sun} />
              </mesh>
              <mesh position={[0.12, -0.02, 0]} rotation={[0, 0, Math.PI / 4]}>
                <planeGeometry args={[0.17, 0.17]} />
                <meshBasicMaterial color={C.teal} />
              </mesh>
            </group>
          )}
        </Float>
      ))}
    </group>
  );
}

/** Colour fan that slowly opens and closes. */
function Swatches() {
  const ref = useRef<THREE.Group>(null);
  const colors = [C.petrol, C.teal, C.glow, "#9ff3ea", C.sun, "#ffffff"];
  useFrame((s) => {
    if (!ref.current) return;
    const open = 0.5 + Math.sin(s.clock.elapsedTime * 0.7) * 0.5;
    ref.current.children.forEach((c, i) => {
      if (i < colors.length) c.rotation.z = (i - (colors.length - 1) / 2) * 0.17 * (0.3 + open * 0.7);
    });
  });
  return (
    <group ref={ref} position={[1.85, -2.0, 0.6]} rotation={[0.1, -0.3, 0]} scale={0.85}>
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
    <group position={[-1.5, -1.6, 0.2]} rotation={[0.15, 0.35, 0]}>
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
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function DesignScene() {
  // wide composition: shrink a little on phones so nothing is cut at the sides
  const mobile = useThree((st) => st.size.width < 900);
  return (
    <SceneRig scale={mobile ? 0.88 : 0.98} y={0.05}>
      <Layers />
      <DrawingPath />
      <Swatches />
      <Float speed={1.6} floatIntensity={0.4} rotationIntensity={0.2}>
        <ColorWheel />
      </Float>
    </SceneRig>
  );
}
