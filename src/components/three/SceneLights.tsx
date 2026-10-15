"use client";

import { Particles, StudioLights } from "./HeroScene";

/**
 * Shared studio lighting for the themed page scenes: soft key, cool fill,
 * a teal rim from behind for crisp silhouettes, reflections from a light-box
 * environment and a few drifting specks for depth.
 */
export default function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 6]} intensity={1.35} color="#ffffff" />
      <directionalLight position={[-5, 1, 3]} intensity={0.45} color="#bff6ef" />
      <spotLight position={[0, 3, -6]} angle={0.9} penumbra={1} intensity={60} distance={18} color="#4fe0d2" />
      <pointLight position={[-4, -2, 3]} intensity={8} distance={12} color="#4fe0d2" />
      <StudioLights />
      <Particles count={220} radius={9} />
    </>
  );
}
