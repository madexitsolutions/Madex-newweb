"use client";

import { Particles, StudioLights } from "./HeroScene";

/** Shared lighting + ambient particles for the themed page scenes. */
export default function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <pointLight position={[-4, -2, 3]} intensity={12} distance={12} color="#4fe0d2" />
      <StudioLights />
      <Particles count={450} radius={8} />
    </>
  );
}
