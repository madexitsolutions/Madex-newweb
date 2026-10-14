"use client";

import { Float } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { MarkModel, Particles, StudioLights } from "./HeroScene";

/** Smaller mark that floats on the right side of sub-page heroes. */
export default function FloatingMark({ scrollRef }: { scrollRef: React.RefObject<number> }) {
  const { viewport, size } = useThree();
  const mobile = size.width < 900;
  const x = mobile ? 0 : viewport.width * 0.26;
  const y = mobile ? -viewport.height * 0.28 : 0;
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} />
      <StudioLights />
      <Float speed={1.6} rotationIntensity={0.4} floatIntensity={0.8}>
        <group position={[x, y, 0]} scale={mobile ? 0.55 : 0.8}>
          <MarkModel scrollRef={scrollRef} explode={0.8} />
        </group>
      </Float>
      <Particles count={500} radius={8} />
    </>
  );
}
