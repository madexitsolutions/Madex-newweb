import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "node_modules/**", "archive/**", "assets/**", "public/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "react/no-unknown-property": "off",
      // React-Compiler rules that misfire on intentional patterns here:
      // per-frame uniform mutation in useFrame (R3F), randomised particle
      // buffers created once in useMemo, and client-only feature detection
      // (matchMedia/WebGL) that must run after hydration.
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
