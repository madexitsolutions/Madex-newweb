"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";

/** Loaded on demand so three.js never ships in the initial page bundle. */
export default function CanvasRoot(props: CanvasProps) {
  return <Canvas {...props} />;
}
