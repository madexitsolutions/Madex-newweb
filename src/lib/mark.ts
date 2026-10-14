/**
 * Abstrahiertes Madex-Doppel-M (drei Formen), nachempfunden der Bildmarke in
 * assets/business-logo.png. Koordinaten im Logo-Pixelraum (x nach rechts,
 * y nach unten, ca. 380 × 192). Die Wortmarke wird bewusst nicht nachgezeichnet.
 */
export type Pt = [number, number];

export const MARK_SHAPES: { points: Pt[]; color: "petrol" | "teal" }[] = [
  { points: [[5, 12], [55, 45], [55, 192], [5, 158]], color: "petrol" },
  { points: [[72, 45], [102, 0], [165, 0], [215, 48], [215, 192], [165, 157], [165, 45]], color: "petrol" },
  { points: [[232, 45], [262, 0], [330, 0], [380, 48], [380, 192], [330, 157], [330, 45]], color: "teal" },
];

export const MARK_SIZE = { w: 385, h: 192 };

export function markPath(points: Pt[]): string {
  return "M" + points.map(([x, y]) => `${x} ${y}`).join(" L") + " Z";
}
