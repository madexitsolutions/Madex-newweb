/**
 * Google results of Madex clients (SEO page, section "Gefunden bei Google"):
 * real screenshots from November 2026 (location Ostschweiz), unedited. Each card
 * shows a crop from the search bar down to the client's result; `marks` frame
 * the client's entries (x, y, width, height in % of the crop). The full screenshot
 * is linked. Files: public/media/seo-ergebnisse/<slug>.webp and <slug>-ganz.webp.
 */
export type Ranking = {
  slug: string;
  query: string;
  client: string;
  position: number;
  /** pixel size of the crop */
  w: number;
  h: number;
  marks: [number, number, number, number][];
  maps?: string;
  aiOverview?: boolean;
  /** a second search with the same result (full screenshot linked) */
  also?: { query: string; position: number; slug: string };
};

export const rankingsDate = "November 2026";

export const rankings: Ranking[] = [
  { slug: "solarreinigung-thurgau", query: "solarreinigung thurgau", client: "Kaminfeger Tanner GmbH", position: 1, w: 562, h: 712, marks: [[0.71, 84.27, 95.02, 14.33]] },
  {
    slug: "spiel-miete-schweiz",
    query: "spiel miete schweiz",
    client: "Challenge Swiss",
    position: 1,
    w: 548,
    h: 563,
    marks: [[1.46, 80.99, 97.08, 17.76]],
    aiOverview: true,
    also: { query: "event spiel miete schweiz", position: 1, slug: "event-spiel-miete-schweiz" },
  },
  { slug: "kaminfeger-kanton-thurgau", query: "kaminfeger kanton thurgau", client: "Kaminfeger Tanner GmbH", position: 2, w: 558, h: 692, marks: [[1.43, 84.68, 96.42, 14.45]], aiOverview: true },
  {
    slug: "umzug-thurgau",
    query: "umzug thurgau",
    client: "BRAUN Umzug & Reinigung",
    position: 2,
    w: 546,
    h: 850,
    marks: [
      [2.2, 51.41, 77.29, 13.06],
      [0.73, 88.24, 97.07, 11.29],
    ],
    maps: "Auch auf Google Maps",
  },
  {
    slug: "brautmode-thurgau",
    query: "brautmode thurgau",
    client: "monarosa Brautmode & Beauty",
    position: 3,
    w: 543,
    h: 784,
    marks: [
      [2.39, 17.86, 76.61, 14.29],
      [0.55, 86.48, 98.71, 12.5],
    ],
    maps: "Auch auf Google Maps",
  },
  { slug: "brautmode-ostschweiz", query: "brautmode ostschweiz", client: "monarosa Brautmode & Beauty", position: 3, w: 547, h: 618, marks: [[0.91, 82.52, 97.62, 16.18]] },
];
