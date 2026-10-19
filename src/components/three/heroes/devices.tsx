"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SceneRig } from "./kit";
import { layoutA, layoutPhone, layoutTablet, skeletonTexture } from "./skeleton";

/** Brushed aluminium for the laptop body. */
function Aluminium({ color = "#d4dadc" }: { color?: string }) {
  return <meshPhysicalMaterial color={color} metalness={0.75} roughness={0.32} clearcoat={0.35} clearcoatRoughness={0.25} envMapIntensity={1.2} />;
}

/** Dark graphite frame for tablet and phone. */
function Graphite() {
  return <meshPhysicalMaterial color="#1b2426" metalness={0.55} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.15} envMapIntensity={1.1} />;
}

function Screen({ map, w, h, z = 0 }: { map: THREE.Texture; w: number; h: number; z?: number }) {
  return (
    <mesh position={[0, 0, z]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  );
}

/** Keyboard deck texture: rows of keys with a space bar. */
function useKeyboard() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 340;
    const g = c.getContext("2d")!;
    g.fillStyle = "#1c2426";
    g.fillRect(0, 0, 1024, 340);
    const key = (x: number, y: number, w: number, h: number) => {
      g.fillStyle = "#2c3638";
      g.beginPath();
      g.roundRect(x, y, w, h, 8);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.05)";
      g.fillRect(x + 4, y + 3, w - 8, 2);
    };
    const pad = 14;
    const rows = 5;
    const kh = (340 - pad * (rows + 1)) / rows;
    for (let r = 0; r < rows - 1; r++) {
      const cols = 14;
      const kw = (1024 - pad * (cols + 1)) / cols;
      for (let i = 0; i < cols; i++) key(pad + i * (kw + pad), pad + r * (kh + pad), kw, kh);
    }
    const y = pad + (rows - 1) * (kh + pad);
    const small = 64;
    let x = pad;
    for (let i = 0; i < 4; i++, x += small + pad) key(x, y, small, kh);
    const space = 1024 - pad - x - 4 * (small + pad);
    key(x, y, space, kh);
    x += space + pad;
    for (let i = 0; i < 4; i++, x += small + pad) key(x, y, small, kh);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
}

function Laptop({ screen, keys }: { screen: THREE.Texture; keys: THREE.Texture }) {
  // base: 3.6 × 0.1 × 2.4, hinge along the back edge
  return (
    <group position={[0, -1.0, -0.4]}>
      <RoundedBox args={[3.6, 0.1, 2.4]} radius={0.05} smoothness={4}>
        <Aluminium />
      </RoundedBox>
      {/* keyboard close to the hinge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0505, -0.42]}>
        <planeGeometry args={[3.0, 1.0]} />
        <meshStandardMaterial map={keys} roughness={0.7} metalness={0.1} />
      </mesh>
      {/* trackpad towards the viewer */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0505, 0.62]}>
        <planeGeometry args={[1.25, 0.72]} />
        <meshPhysicalMaterial color="#c4cbcd" metalness={0.6} roughness={0.22} clearcoat={1} />
      </mesh>
      {/* front lip notch */}
      <mesh position={[0, 0.02, 1.201]}>
        <planeGeometry args={[0.5, 0.03]} />
        <meshStandardMaterial color="#9aa4a7" />
      </mesh>
      {/* lid, opened ~105° around the hinge */}
      <group position={[0, 0.05, -1.18]} rotation={[-0.2, 0, 0]}>
        <RoundedBox args={[3.6, 2.36, 0.07]} radius={0.05} smoothness={4} position={[0, 1.18, -0.035]}>
          <Aluminium color="#cbd2d4" />
        </RoundedBox>
        <mesh position={[0, 1.18, 0.001]}>
          <planeGeometry args={[3.5, 2.26]} />
          <meshStandardMaterial color="#0c1112" roughness={0.4} />
        </mesh>
        <mesh position={[0, 2.25, 0.003]}>
          <circleGeometry args={[0.022, 24]} />
          <meshStandardMaterial color="#2b3a3d" />
        </mesh>
        <group position={[0, 1.2, 0.004]}>
          <Screen map={screen} w={3.32} h={2.075} />
        </group>
      </group>
    </group>
  );
}

function Tablet({ screen }: { screen: THREE.Texture }) {
  return (
    <group position={[-2.15, -0.8, 1.35]} rotation={[-0.04, 0.38, 0]}>
      <RoundedBox args={[1.56, 2.12, 0.07]} radius={0.1} smoothness={5}>
        <Graphite />
      </RoundedBox>
      <group position={[0, 0, 0.036]}>
        <Screen map={screen} w={1.42} h={1.97} />
      </group>
    </group>
  );
}

function Phone({ screen }: { screen: THREE.Texture }) {
  return (
    <group position={[2.1, -1.05, 1.45]} rotation={[-0.04, -0.4, 0]}>
      <RoundedBox args={[0.8, 1.62, 0.085]} radius={0.13} smoothness={6}>
        <Graphite />
      </RoundedBox>
      <group position={[0, 0, 0.044]}>
        <Screen map={screen} w={0.71} h={1.53} />
        <mesh position={[0, 0.68, 0.001]}>
          <planeGeometry args={[0.22, 0.06]} />
          <meshBasicMaterial color="#050809" />
        </mesh>
      </group>
    </group>
  );
}

/** Laptop, tablet and phone showing the same website skeleton – "responsive on every device". */
export default function DevicesScene() {
  const textures = useMemo(
    () => ({
      laptop: skeletonTexture(layoutA, 1024, 640),
      tablet: skeletonTexture(layoutTablet, 900, 1250),
      phone: skeletonTexture(layoutPhone, 600, 1290),
    }),
    [],
  );
  const keys = useKeyboard();
  useEffect(
    () => () => {
      Object.values(textures).forEach((t) => t.dispose());
      keys.dispose();
    },
    [textures, keys],
  );
  return (
    <SceneRig scale={0.8} tilt={0.25}>
      <Float speed={1} floatIntensity={0.35} rotationIntensity={0.08}>
        <group rotation={[0.14, -0.28, 0]}>
          <Laptop screen={textures.laptop} keys={keys} />
          <Tablet screen={textures.tablet} />
          <Phone screen={textures.phone} />
        </group>
      </Float>
    </SceneRig>
  );
}
