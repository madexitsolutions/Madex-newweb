"use client";

import { Float } from "@react-three/drei";
import { useRef } from "react";
import { MarkModel } from "../HeroScene";
import { SceneRig } from "./kit";

/** 404: the mark drifts apart in zero gravity. */
export default function LostScene() {
  const explode = useRef(1);
  return (
    <SceneRig>
      <Float speed={1} rotationIntensity={1.2} floatIntensity={1.4}>
        <group scale={0.8}>
          <MarkModel scrollRef={explode} explode={1} />
        </group>
      </Float>
    </SceneRig>
  );
}
