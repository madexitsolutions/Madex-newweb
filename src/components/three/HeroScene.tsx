"use client";

import { Environment, Float, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { MARK_PATHS, MARK_SIZE, markSvgDocument } from "@/lib/mark";

const PETROL = new THREE.Color("#025159");
const TEAL = new THREE.Color("#028D86");

function useMarkGeometries(depth = 70) {
  return useMemo(() => {
    const s = 3.6 / MARK_SIZE.w;
    const svg = new SVGLoader().parse(markSvgDocument());
    return svg.paths.map((path, i) => {
      const shapes = SVGLoader.createShapes(path);
      const geo = new THREE.ExtrudeGeometry(shapes, {
        depth,
        bevelEnabled: true,
        bevelThickness: 9,
        bevelSize: 6,
        bevelSegments: 6,
        curveSegments: 18,
      });
      // SVG space is y-down: flip, scale to scene units, then centre each piece
      // on its own origin so it can rotate in place
      geo.scale(s, -s, s);
      geo.computeBoundingBox();
      const c = new THREE.Vector3();
      geo.boundingBox!.getCenter(c);
      geo.translate(-c.x, -c.y, -c.z);
      geo.computeVertexNormals();
      const offset = new THREE.Vector3(c.x - (MARK_SIZE.w / 2) * s, c.y + (MARK_SIZE.h / 2) * s, 0);
      return { geo, color: MARK_PATHS[i]?.color ?? "petrol", offset };
    });
  }, [depth]);
}

/** The Madex mark (exact logo paths), extruded, glossy, reacting to pointer and scroll. */
export function MarkModel({ scrollRef, explode = 1 }: { scrollRef?: React.RefObject<number>; explode?: number }) {
  const pieces = useMarkGeometries();
  const group = useRef<THREE.Group>(null);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const { pointer } = useThree();

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const p = Math.min(1, Math.max(0, scrollRef?.current ?? 0)) * explode;
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, pointer.x * 0.45 - 0.25 + p * 0.9, 3, delta);
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -pointer.y * 0.3 + 0.08 + p * 0.35, 3, delta);
    }
    refs.current.forEach((m, i) => {
      if (!m) return;
      const base = pieces[i].offset;
      const dir = i - 1;
      m.position.x = THREE.MathUtils.damp(m.position.x, base.x + dir * p * 1.4, 4, delta);
      m.position.y = base.y + Math.sin(t * 0.9 + i * 1.3) * 0.06 + p * (i === 1 ? 0.6 : -0.2);
      m.position.z = THREE.MathUtils.damp(m.position.z, Math.sin(t * 0.6 + i) * 0.12 + p * (i - 1) * -1.2, 4, delta);
      m.rotation.z = THREE.MathUtils.damp(m.rotation.z, dir * p * 0.5, 4, delta);
      m.rotation.y = THREE.MathUtils.damp(m.rotation.y, p * (i + 1) * 0.6, 4, delta);
    });
  });

  return (
    <group ref={group}>
      {pieces.map((pc, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={pc.geo} position={pc.offset} castShadow>
          <meshPhysicalMaterial
            color={pc.color === "teal" ? TEAL : PETROL}
            roughness={0.16}
            metalness={0.25}
            clearcoat={1}
            clearcoatRoughness={0.08}
            iridescence={0.35}
            iridescenceIOR={1.4}
            sheen={0.4}
            sheenColor="#4fe0d2"
            envMapIntensity={1.4}
          />
        </mesh>
      ))}
    </group>
  );
}

const particleVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aScale;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float a = uTime * 0.05 + p.y * 0.15;
    p.x += sin(a + p.z) * 0.15;
    p.z += cos(a + p.x) * 0.15;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aScale * 34.0 * uPixelRatio / -mv.z;
    vAlpha = smoothstep(18.0, 2.0, -mv.z);
  }
`;
const particleFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float s = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, s * s * vAlpha * 0.9);
  }
`;

export function Particles({ count = 1600, radius = 9, color = "#4fe0d2" }: { count?: number; radius?: number; color?: string }) {
  const ref = useRef<THREE.Points>(null);
  const { gl } = useThree();
  const [positions, scales] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sc = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = radius * (0.35 + Math.random() * 0.65);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.6;
      pos[i * 3 + 2] = r * Math.cos(ph) - 2;
      sc[i] = 0.4 + Math.random() * 1.6;
    }
    return [pos, sc];
  }, [count, radius]);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) }, uColor: { value: new THREE.Color(color) } }),
    [gl, color],
  );
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
      </bufferGeometry>
      <shaderMaterial vertexShader={particleVertex} fragmentShader={particleFragment} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Rings() {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  useFrame((_, d) => {
    if (a.current) a.current.rotation.z += d * 0.08;
    if (b.current) b.current.rotation.z -= d * 0.05;
  });
  return (
    <group rotation={[1.2, 0.2, 0]}>
      <mesh ref={a}>
        <torusGeometry args={[3.1, 0.006, 8, 220]} />
        <meshBasicMaterial color="#4fe0d2" transparent opacity={0.45} />
      </mesh>
      <mesh ref={b} rotation={[0.3, 0.4, 0]}>
        <torusGeometry args={[3.8, 0.004, 8, 220]} />
        <meshBasicMaterial color="#028D86" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function PointerLight() {
  const light = useRef<THREE.PointLight>(null);
  const { pointer, viewport } = useThree();
  useFrame((_, d) => {
    if (!light.current) return;
    light.current.position.x = THREE.MathUtils.damp(light.current.position.x, (pointer.x * viewport.width) / 2, 4, d);
    light.current.position.y = THREE.MathUtils.damp(light.current.position.y, (pointer.y * viewport.height) / 2, 4, d);
  });
  return <pointLight ref={light} position={[0, 0, 3]} intensity={18} distance={9} color="#4fe0d2" />;
}

export function StudioLights() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 5, -2]} scale={[10, 2, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#4fe0d2" position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#028D86" position={[5, -1, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      <Lightformer form="ring" intensity={2} color="#ffffff" position={[0, 0, 6]} scale={3} />
    </Environment>
  );
}

/** Rig that slightly dollies the camera with scroll for depth. */
function CameraRig({ scrollRef }: { scrollRef: React.RefObject<number> }) {
  const { camera, size } = useThree();
  useFrame((_, d) => {
    const p = scrollRef.current ?? 0;
    const mobile = size.width < 800;
    const targetZ = (mobile ? 9.5 : 7) + p * 2.5;
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3, d);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, -p * 1.2, 3, d);
    camera.lookAt(0, -p * 0.6, 0);
  });
  return null;
}

function HeroMark({ scrollRef }: { scrollRef: React.RefObject<number> }) {
  const { viewport, size } = useThree();
  const mobile = size.width < 900;
  const x = mobile ? 0 : viewport.width * 0.25;
  const y = mobile ? -viewport.height / 2 + 1.2 : 0.1;
  const s = mobile ? 0.48 : Math.min(1, size.width / 1600) * 0.68;
  return (
    <group position={[x, y, 0]} scale={s}>
      <MarkModel scrollRef={scrollRef} />
    </group>
  );
}

export default function HeroScene({ scrollRef }: { scrollRef: React.RefObject<number> }) {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <PointerLight />
      <StudioLights />
      <CameraRig scrollRef={scrollRef} />
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
        <HeroMark scrollRef={scrollRef} />
      </Float>
      <Rings />
      <Particles />
    </>
  );
}
