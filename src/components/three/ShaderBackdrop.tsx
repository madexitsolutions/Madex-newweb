"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Flowing petrol/teal field with a perspective grid and a pointer light.
const fragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uRes;
  uniform float uIntensity;
  varying vec2 vUv;

  vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
  vec2 mod289(vec2 x){return x - floor(x * (1.0/289.0)) * 289.0;}
  vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float t = uTime * 0.06;

    float n = snoise(p * 1.2 + vec2(t, -t * 0.7));
    n += 0.5 * snoise(p * 2.6 - vec2(t * 1.3, t));
    n = n * 0.5 + 0.5;

    vec3 night = vec3(0.004, 0.106, 0.118);
    vec3 petrol = vec3(0.008, 0.318, 0.349);
    vec3 teal = vec3(0.008, 0.553, 0.525);
    vec3 glow = vec3(0.31, 0.88, 0.82);

    vec3 col = mix(night, petrol, smoothstep(0.25, 0.85, n) * 0.9);
    col = mix(col, teal, smoothstep(0.7, 1.0, n) * 0.55);

    // perspective grid in lower half
    float horizon = 0.42;
    if (uv.y < horizon) {
      float depth = (horizon - uv.y) / horizon;
      vec2 g = vec2((uv.x - 0.5) / (depth + 0.05), 1.0 / (depth + 0.05) + uTime * 0.25);
      vec2 gl = abs(fract(g * vec2(1.5, 0.6)) - 0.5);
      float line = smoothstep(0.03, 0.0, min(gl.x, gl.y) * (0.6 + depth));
      col += glow * line * depth * 0.22 * uIntensity;
    }

    // pointer light
    vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float d = length(p - m);
    col += glow * smoothstep(0.55, 0.0, d) * 0.22 * uIntensity;

    // vignette
    col *= smoothstep(1.25, 0.25, length(p * vec2(0.9, 1.2)));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function ShaderBackdrop({ intensity = 1 }: { intensity?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { size, pointer } = useThree();
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uRes: { value: new THREE.Vector2(1, 1) }, uIntensity: { value: intensity } }),
    [intensity],
  );
  useFrame((state, d) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uRes.value.set(size.width, size.height);
    const mx = pointer.x * 0.5 + 0.5;
    const my = pointer.y * 0.5 + 0.5;
    uniforms.uMouse.value.x = THREE.MathUtils.damp(uniforms.uMouse.value.x, mx, 3, d);
    uniforms.uMouse.value.y = THREE.MathUtils.damp(uniforms.uMouse.value.y, my, 3, d);
  });
  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} depthWrite={false} depthTest={false} />
    </mesh>
  );
}
