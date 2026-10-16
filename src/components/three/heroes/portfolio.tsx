"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { C, Glossy, SceneRig } from "./kit";

const W = 1024;
const H = 710;

type Ctx = CanvasRenderingContext2D;

const INK = "#b8c8c9";
const INK_SOFT = "#dfe8e8";
const TEAL = "#028D86";
const MINT = "#9fdcd5";
const PETROL = "#025159";

function bar(c: Ctx, x: number, y: number, w: number, h: number, color = INK, r = h / 2) {
  c.fillStyle = color;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}

function nav(c: Ctx, dark = false) {
  c.fillStyle = dark ? PETROL : "#ffffff";
  c.fillRect(0, 0, W, 78);
  bar(c, 44, 26, 26, 26, dark ? "#ffffff" : TEAL, 8);
  bar(c, 82, 32, 92, 14, dark ? "rgba(255,255,255,.85)" : INK);
  [0, 1, 2, 3].forEach((i) => bar(c, 520 + i * 92, 33, 66, 12, dark ? "rgba(255,255,255,.45)" : INK));
  bar(c, 900, 22, 84, 34, dark ? "#ffffff" : TEAL, 17);
}

/** Classic agency layout: text left, image right, three cards. */
function layoutA(c: Ctx) {
  nav(c);
  bar(c, 44, 130, 380, 34, PETROL, 10);
  bar(c, 44, 178, 300, 34, PETROL, 10);
  bar(c, 44, 236, 360, 14);
  bar(c, 44, 260, 320, 14);
  bar(c, 44, 284, 340, 14);
  bar(c, 44, 330, 150, 44, TEAL, 22);
  bar(c, 206, 330, 120, 44, INK_SOFT, 22);
  bar(c, 500, 120, 480, 290, MINT, 22);
  bar(c, 640, 205, 200, 120, "rgba(255,255,255,.65)", 16);
  [0, 1, 2].forEach((i) => {
    const x = 44 + i * 320;
    bar(c, x, 460, 296, 210, INK_SOFT, 18);
    bar(c, x + 24, 484, 52, 52, MINT, 14);
    bar(c, x + 24, 556, 180, 16, INK);
    bar(c, x + 24, 586, 240, 12, INK);
    bar(c, x + 24, 608, 200, 12, INK);
  });
}

/** Shop layout: dark nav, wide banner, product grid. */
function layoutB(c: Ctx) {
  nav(c, true);
  bar(c, 44, 110, 936, 220, "#e3f3f1", 22);
  bar(c, 90, 168, 360, 32, PETROL, 10);
  bar(c, 90, 214, 280, 14);
  bar(c, 90, 258, 140, 40, TEAL, 20);
  bar(c, 640, 136, 300, 170, MINT, 18);
  [0, 1, 2, 3].forEach((i) => {
    const x = 44 + i * 238;
    bar(c, x, 360, 214, 200, INK_SOFT, 18);
    bar(c, x + 18, 378, 178, 120, MINT, 12);
    bar(c, x + 18, 514, 120, 14, INK);
    bar(c, x + 18, 538, 70, 12, TEAL);
  });
  bar(c, 44, 600, 936, 80, PETROL, 18);
  bar(c, 80, 630, 260, 16, "rgba(255,255,255,.6)");
  bar(c, 820, 622, 124, 34, "#ffffff", 17);
}

/** Service layout: centred hero, stats row, text + image. */
function layoutC(c: Ctx) {
  nav(c);
  bar(c, 262, 128, 500, 36, PETROL, 10);
  bar(c, 332, 178, 360, 36, PETROL, 10);
  bar(c, 312, 236, 400, 14);
  bar(c, 352, 260, 320, 14);
  bar(c, 402, 300, 220, 46, TEAL, 23);
  [0, 1, 2].forEach((i) => {
    const x = 120 + i * 270;
    bar(c, x, 386, 250, 96, INK_SOFT, 16);
    bar(c, x + 24, 410, 80, 26, TEAL, 8);
    bar(c, x + 24, 450, 150, 12, INK);
  });
  bar(c, 44, 520, 440, 160, MINT, 20);
  bar(c, 530, 534, 300, 22, PETROL, 8);
  bar(c, 530, 574, 420, 13);
  bar(c, 530, 597, 380, 13);
  bar(c, 530, 620, 400, 13);
}

function skeletonTexture(draw: (c: Ctx) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#f6f8f8";
  c.fillRect(0, 0, W, H);
  draw(c);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Soft light band that sweeps across a skeleton, like a loading shimmer. */
function useShimmer() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 4;
    const c = canvas.getContext("2d")!;
    const g = c.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 4);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(0.45, 1);
    return t;
  }, []);
}

/** Three floating screens with website skeletons in the Madex palette. */
export default function PortfolioScene() {
  const textures = useMemo(() => [layoutA, layoutB, layoutC].map(skeletonTexture), []);
  const shimmer = useShimmer();
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

  const sweep = useMemo(
    () =>
      [0, 1, 2].map(() => {
        const s = shimmer.clone();
        s.needsUpdate = true;
        return s;
      }),
    [shimmer],
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    sweep.forEach((tex, i) => {
      tex.offset.x = -((t * 0.35 + i * 0.33) % 1.6) + 0.6;
    });
  });

  const frames = [
    { p: [-1.05, 0.6, -0.7], r: [0, 0.35, 0.03], s: 0.82 },
    { p: [0.25, -0.15, 0.4], r: [0, -0.22, -0.02], s: 1.05 },
    { p: [1.25, 1.0, -1.0], r: [0, -0.5, 0.04], s: 0.74 },
  ];
  return (
    <SceneRig>
      {frames.map((f, i) => (
        <Float key={i} speed={1.2 + i * 0.3} floatIntensity={0.6} rotationIntensity={0.2}>
          <group position={f.p as [number, number, number]} rotation={f.r as [number, number, number]} scale={f.s}>
            <RoundedBox args={[2.1, 1.5, 0.08]} radius={0.06} smoothness={4}>
              <Glossy color={i === 1 ? C.teal : C.petrol} />
            </RoundedBox>
            <mesh position={[0, 0, 0.045]}>
              <planeGeometry args={[1.96, 1.36]} />
              <meshBasicMaterial map={textures[i]} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, 0.047]}>
              <planeGeometry args={[1.96, 1.36]} />
              <meshBasicMaterial map={sweep[i]} transparent opacity={0.35} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
        </Float>
      ))}
    </SceneRig>
  );
}
