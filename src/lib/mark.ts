/**
 * Madex-Bildmarke, exakt aus der Original-SVG (public/brand/logo-icon.svg).
 * Koordinaten im viewBox-Raum der Datei (806.12 × 425.46, y nach unten).
 */
export const MARK_SIZE = { w: 806.12, h: 425.46 };

export const MARK_PATHS: { d: string; color: "petrol" | "teal" }[] = [
  {
    color: "petrol",
    d: "Layer_1",
  },
  {
    color: "petrol",
    d: "m114.77,124.96v275.73c0,21.93-26.51,32.91-42.02,17.4L7.21,352.55c-4.62-4.62-7.21-10.88-7.21-17.4V59.42c0-21.93,26.51-32.91,42.02-17.41l65.54,65.54c4.62,4.62,7.21,10.88,7.21,17.41Z",
  },
  {
    color: "teal",
    d: "m460.12,124.96v275.73c0,21.93-26.51,32.91-42.02,17.41l-65.55-65.55c-4.62-4.62-7.21-10.88-7.21-17.41v-195.77c0-13.59-11.02-24.61-24.61-24.61h-146.35c-21.96,0-32.93-26.57-17.37-42.06L222.85,7.17c4.61-4.59,10.86-7.17,17.37-7.17h94.93c6.53,0,12.79,2.59,17.4,7.21l100.36,100.35c4.62,4.62,7.21,10.88,7.21,17.41Z",
  },
];

export const MARK_HEX = { petrol: "#025159", teal: "#028D86" } as const;

/** The mark as a standalone SVG document (used by the 3D extrusion). */
export function markSvgDocument(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_SIZE.w} ${MARK_SIZE.h}">${MARK_PATHS.map(
    (p) => `<path fill="${MARK_HEX[p.color]}" d="${p.d}"/>`,
  ).join("")}</svg>`;
}
