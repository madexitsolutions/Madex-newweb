"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig, useExtrude } from "./kit";

/*
 * Google Ads / search marketing: a query gets typed into a search bar, the
 * results page shows a sponsored top result ("Anzeige" pill) which the cursor
 * clicks, a Maps pin marks the local business, a trend arrow climbs.
 * Layout (local units):
 *   search bar  y 1.2 … 1.8   (x -1.85 … 1.85, z 0.25)
 *   results     y -1.45 … 0.75 (x -1.75 … 1.45, z 0)
 *   pin         x 1.7 … 2.35, y -1.5 … -0.4 (z 0.6)
 *   trend arrow x -2.3 … -1.6, y -2.05 … -1.5 (z 0.6)
 */
const G = { blue: "#4285F4", red: "#EA4335", yellow: "#FBBC05", green: "#34A853" };
const INK = "#3c4043";
const CYCLE = 7;
const QUERY = [0.5, 0.36, 0.62];

const phase = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

function SearchBar() {
  const bars = useRef<THREE.Group>(null);
  const caret = useRef<THREE.Mesh>(null);
  const starts = useMemo(() => {
    let x = -1.18;
    return QUERY.map((w) => {
      const s = x;
      x += w + 0.08;
      return s;
    });
  }, []);
  useFrame((s) => {
    const t = s.clock.elapsedTime % CYCLE;
    let end = starts[0];
    bars.current?.children.forEach((b, i) => {
      const k = phase(t, 0.3 + i * 0.55, 0.3 + i * 0.55 + 0.5);
      const typed = Math.floor(k * 6) / 6; // step like key presses
      b.scale.x = Math.max(0.0001, typed);
      b.position.x = starts[i] + (QUERY[i] * typed) / 2;
      if (typed > 0) end = starts[i] + QUERY[i] * typed;
    });
    if (caret.current) {
      caret.current.position.x = end + 0.05;
      caret.current.visible = Math.floor(s.clock.elapsedTime * 2.4) % 2 === 0 || (t > 0.3 && t < 2.0);
    }
  });
  return (
    <group>
      <RoundedBox args={[3.7, 0.6, 0.18]} radius={0.09} smoothness={6}>
        <Glossy color="#ffffff" rough={0.25} emissive="#ffffff" emissiveIntensity={0.08} />
      </RoundedBox>
      {/* magnifier */}
      <group position={[-1.5, 0.02, 0.1]}>
        <mesh>
          <torusGeometry args={[0.1, 0.028, 14, 40]} />
          <Glossy color={INK} />
        </mesh>
        <mesh position={[0.11, -0.11, 0]} rotation={[0, 0, Math.PI / 4]}>
          <capsuleGeometry args={[0.026, 0.1, 6, 12]} />
          <Glossy color={INK} />
        </mesh>
      </group>
      {/* typed query */}
      <group ref={bars} position={[0, 0, 0.095]}>
        {QUERY.map((w, i) => (
          <mesh key={i}>
            <planeGeometry args={[w, 0.09]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        ))}
      </group>
      <mesh ref={caret} position={[0, 0, 0.096]}>
        <planeGeometry args={[0.025, 0.24]} />
        <meshBasicMaterial color={G.blue} />
      </mesh>
      {/* divider + four-colour ring as the search button */}
      <mesh position={[1.2, 0, 0.095]}>
        <planeGeometry args={[0.014, 0.3]} />
        <meshBasicMaterial color="#c9d3d2" />
      </mesh>
      <group position={[1.5, 0, 0.1]} rotation={[0, 0, Math.PI / 4]}>
        {[G.blue, G.green, G.yellow, G.red].map((c, i) => (
          <mesh key={c} rotation={[0, 0, (i * Math.PI) / 2]}>
            <torusGeometry args={[0.14, 0.042, 14, 24, Math.PI / 2 - 0.08]} />
            <Glossy color={c} rough={0.25} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Result({ y, ad, title, lines }: { y: number; ad?: boolean; title: number; lines: number[] }) {
  return (
    <group position={[0, y, 0.055]}>
      {ad ? (
        <RoundedBox args={[0.62, 0.17, 0.035]} radius={0.075} position={[-1.08, 0.2, 0.01]}>
          <Glossy color={C.petrol} rough={0.25} />
        </RoundedBox>
      ) : (
        <mesh position={[-1.32, 0.2, 0]}>
          <circleGeometry args={[0.07, 24]} />
          <meshBasicMaterial color="#d5dfde" />
        </mesh>
      )}
      {ad && (
        <mesh position={[-1.08, 0.2, 0.03]}>
          <planeGeometry args={[0.38, 0.05]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
      {/* display url */}
      <mesh position={[ad ? -0.42 : -0.86, 0.2, 0]}>
        <planeGeometry args={[ad ? 0.6 : 0.75, 0.05]} />
        <meshBasicMaterial color={ad ? G.green : "#8fa3a2"} />
      </mesh>
      {/* headline */}
      <mesh position={[-1.4 + title / 2, 0.02, 0]}>
        <planeGeometry args={[title, 0.1]} />
        <meshBasicMaterial color={G.blue} />
      </mesh>
      {lines.map((w, i) => (
        <mesh key={i} position={[-1.4 + w / 2, -0.15 - i * 0.11, 0]}>
          <planeGeometry args={[w, 0.05]} />
          <meshBasicMaterial color="#9aaaa9" />
        </mesh>
      ))}
    </group>
  );
}

/** Classic arrow pointer. */
function Cursor() {
  const geo = useExtrude((s) => {
    s.moveTo(0, 0);
    s.lineTo(0, -0.5);
    s.lineTo(0.12, -0.39);
    s.lineTo(0.2, -0.57);
    s.lineTo(0.28, -0.53);
    s.lineTo(0.2, -0.36);
    s.lineTo(0.36, -0.36);
    s.closePath();
  }, 0.05, 0.02);
  return (
    <group>
      {/* geometry is centred, shift so the tip sits at the origin */}
      <mesh geometry={geo} position={[0.18, -0.285, 0]}>
        <Glossy color="#ffffff" rough={0.2} />
      </mesh>
      <mesh geometry={geo} position={[0.18, -0.285, 0]} scale={[1.13, 1.09, 0.8]}>
        <meshStandardMaterial color={INK} />
      </mesh>
    </group>
  );
}

function ResultsCard() {
  const cursor = useRef<THREE.Group>(null);
  const press = useRef<THREE.Group>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const hi = useRef<THREE.MeshBasicMaterial>(null);
  // click target: the ad headline
  const target = new THREE.Vector3(0.1, 0.62, 0.2);
  useFrame((s) => {
    const t = s.clock.elapsedTime % CYCLE;
    const move = phase(t, 2.1, 3.0);
    const e = 1 - Math.pow(1 - move, 3);
    if (cursor.current) {
      cursor.current.position.set(THREE.MathUtils.lerp(0.95, target.x, e), THREE.MathUtils.lerp(-0.2, target.y, e), target.z + 0.25);
    }
    const click = phase(t, 3.1, 3.35);
    if (press.current) press.current.scale.setScalar(1 - Math.sin(click * Math.PI) * 0.15);
    const r = phase(t, 3.2, 4.2);
    if (ripple.current) {
      ripple.current.visible = r > 0 && r < 1;
      ripple.current.scale.setScalar(0.3 + r * 1.6);
      (ripple.current.material as THREE.MeshBasicMaterial).opacity = (1 - r) * 0.9;
    }
    if (hi.current) hi.current.opacity = 0.55 + (t > 3.2 && t < 6.3 ? 0.45 : 0);
  });
  return (
    <group>
      <RoundedBox args={[3.2, 2.2, 0.1]} radius={0.1} smoothness={5}>
        <Glossy color="#f6fbfb" rough={0.3} emissive="#ffffff" emissiveIntensity={0.06} />
      </RoundedBox>
      {/* sponsored row highlight */}
      <mesh position={[0, 0.55, 0.052]}>
        <planeGeometry args={[3.0, 0.72]} />
        <meshBasicMaterial ref={hi} color="#dceafd" transparent opacity={0.55} />
      </mesh>
      <Result y={0.55} ad title={1.95} lines={[2.55]} />
      <Result y={-0.12} title={1.55} lines={[2.4, 1.7]} />
      <Result y={-0.78} title={1.2} lines={[2.1]} />
      <mesh ref={ripple} position={[target.x, target.y, 0.07]}>
        <ringGeometry args={[0.1, 0.13, 48]} />
        <meshBasicMaterial color={G.blue} transparent toneMapped={false} />
      </mesh>
      <group ref={cursor}>
        <group ref={press}>
          <Cursor />
        </group>
      </group>
    </group>
  );
}

/** Google-Maps style pin with ripples on the ground. */
const PIN = { cy: 0.12, r: 0.32, tip: -0.5 };

function MapPin() {
  const { cy } = PIN;
  const body = useMemo(() => {
    const { cy, r, tip } = PIN;
    const s = new THREE.Shape();
    const a = Math.asin(r / (cy - tip));
    s.moveTo(0, tip);
    s.quadraticCurveTo(r * Math.cos(a) * 0.45, tip + 0.18, r * Math.cos(a), cy - r * Math.sin(a));
    s.absarc(0, cy, r, -a, Math.PI + a, false);
    s.quadraticCurveTo(-r * Math.cos(a) * 0.45, tip + 0.18, 0, tip);
    const h = new THREE.Path();
    h.absarc(0, cy, 0.12, 0, Math.PI * 2, true);
    s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 6, curveSegments: 40 });
    g.translate(0, 0, -0.1);
    return g;
  }, []);
  const pin = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (pin.current) {
      pin.current.position.y = 0.05 + Math.abs(Math.sin(t * 1.5)) * 0.18;
      pin.current.rotation.y = Math.sin(t * 0.6) * 0.5;
    }
    rings.current?.children.forEach((c, i) => {
      const p = (t * 0.4 + i / 2) % 1;
      c.scale.setScalar(0.5 + p * 1.4);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.6;
    });
  });
  return (
    <group>
      <group ref={pin}>
        <group position={[0, 0.5, 0]}>
          <mesh geometry={body}>
            <Glossy color={G.red} rough={0.22} />
          </mesh>
          <mesh position={[0, cy, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.125, 0.125, 0.2, 32]} />
            <meshStandardMaterial color="#7d0b0b" roughness={0.5} />
          </mesh>
        </group>
      </group>
      <group ref={rings} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {[0, 1].map((i) => (
          <mesh key={i}>
            <ringGeometry args={[0.22, 0.25, 48]} />
            <meshBasicMaterial color={G.red} transparent toneMapped={false} />
          </mesh>
        ))}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <circleGeometry args={[0.1, 24]} />
        <meshBasicMaterial color="#7d0b0b" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/** Rising performance arrow. */
function TrendArrow() {
  const geo = useExtrude((s) => {
    const w = 0.07;
    const pts: [number, number][] = [
      [-0.35, -0.25],
      [-0.1, 0.0],
      [0.05, -0.12],
      [0.28, 0.14],
    ];
    // thick polyline: walk the top edge, then back along the bottom edge
    const top: [number, number][] = [];
    const bot: [number, number][] = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      top.push([p[0] - (dy / l) * w, p[1] + (dx / l) * w]);
      bot.push([p[0] + (dy / l) * w, p[1] - (dx / l) * w]);
    });
    s.moveTo(...bot[0]);
    top.forEach((p) => s.lineTo(...p));
    // arrow head
    s.lineTo(0.22, 0.24);
    s.lineTo(0.42, 0.3);
    s.lineTo(0.38, 0.08);
    bot.slice().reverse().forEach((p) => s.lineTo(...p));
  }, 0.1, 0.03);
  return (
    <mesh geometry={geo}>
      <Glossy color={G.green} rough={0.22} />
    </mesh>
  );
}

export default function GoogleScene() {
  // wide composition: shrink a little on phones so nothing is cut at the sides
  const mobile = useThree((st) => st.size.width < 900);
  return (
    <SceneRig scale={mobile ? 0.75 : 1.03} y={-0.1}>
      <Float speed={1.4} rotationIntensity={0.12} floatIntensity={0.35}>
        <group position={[0, 1.5, 0.25]} rotation={[0.08, -0.18, 0]}>
          <SearchBar />
        </group>
      </Float>
      <Float speed={1.1} rotationIntensity={0.1} floatIntensity={0.25}>
        <group position={[-0.15, -0.35, 0]} rotation={[-0.08, -0.22, 0]}>
          <ResultsCard />
        </group>
      </Float>
      <group position={[2.05, -1.55, 0.6]} rotation={[0.15, -0.3, 0]}>
        <MapPin />
      </group>
      <Float speed={2} rotationIntensity={0.25} floatIntensity={0.5}>
        <group position={[-2.2, -1.85, 0.6]} rotation={[0.1, 0.4, 0]}>
          <TrendArrow />
        </group>
      </Float>
    </SceneRig>
  );
}
