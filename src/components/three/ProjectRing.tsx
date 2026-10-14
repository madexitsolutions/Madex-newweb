"use client";

import { useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type RingItem = { image: string; title: string; href: string };

const W = 2.1;
const H = 1.45;

function Card({ item, texture, angle, radius, onOpen, hovered, setHovered, index }: {
  item: RingItem;
  texture: THREE.Texture;
  angle: number;
  radius: number;
  onOpen: (href: string) => void;
  hovered: number | null;
  setHovered: (i: number | null) => void;
  index: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    // gently curved plane
    const g = new THREE.PlaneGeometry(W, H, 24, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, -(x * x) * 0.08);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const isHover = hovered === index;
  useFrame((_, d) => {
    if (!ref.current) return;
    const s = THREE.MathUtils.damp(ref.current.scale.x, isHover ? 1.12 : 1, 6, d);
    ref.current.scale.setScalar(s);
    const m = ref.current.material as THREE.MeshBasicMaterial;
    m.color.lerp(new THREE.Color(isHover || hovered === null ? "#ffffff" : "#7d9a9c"), Math.min(1, d * 6));
  });
  return (
    <mesh
      ref={ref}
      geometry={geo}
      position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]}
      rotation={[0, angle, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(index);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item.href);
      }}
    >
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

export default function ProjectRing({ items, onOpen, onHover }: { items: RingItem[]; onOpen: (href: string) => void; onHover?: (title: string | null) => void }) {
  const textures = useTexture(items.map((i) => i.image));
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const drag = useRef({ active: false, x: 0, v: 0 });
  const rot = useRef(0);
  const { gl, size } = useThree();
  const radius = Math.max(3.4, (items.length * (W + 0.35)) / (Math.PI * 2));

  useEffect(() => {
    textures.forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    });
  }, [textures]);

  useEffect(() => {
    onHover?.(hovered === null ? null : items[hovered].title);
  }, [hovered, items, onHover]);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      drag.current.active = true;
      drag.current.x = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.x;
      drag.current.x = e.clientX;
      drag.current.v = dx * 0.004;
    };
    const up = () => (drag.current.active = false);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl]);

  useFrame((state, d) => {
    const auto = hovered === null && !drag.current.active ? 0.08 * d : 0;
    rot.current += drag.current.v + auto;
    drag.current.v *= 0.92;
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, rot.current, 6, d);
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, state.pointer.y * 0.06, 3, d);
    }
    const mobile = size.width < 800;
    state.camera.position.z = THREE.MathUtils.damp(state.camera.position.z, radius + (mobile ? 7 : 4.6), 3, d);
    state.camera.position.y = THREE.MathUtils.damp(state.camera.position.y, 1.1, 3, d);
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={group}>
      {items.map((item, i) => (
        <Card
          key={item.href}
          item={item}
          texture={textures[i]}
          index={i}
          angle={(i / items.length) * Math.PI * 2}
          radius={radius}
          onOpen={onOpen}
          hovered={hovered}
          setHovered={setHovered}
        />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -H / 2 - 0.35, 0]}>
        <ringGeometry args={[radius - 0.05, radius + 0.02, 128]} />
        <meshBasicMaterial color="#4fe0d2" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}
