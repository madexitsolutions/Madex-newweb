/**
 * Google results of Madex clients (SEO page, section "Gefunden bei Google").
 * Taken from searches in November 2026 (location Ostschweiz). `position` counts
 * the regular results below maps and AI overview; Maps and the AI overview are
 * shown as their own badges.
 */
export type Ranking = {
  query: string;
  client: string;
  site: string;
  breadcrumb: string;
  title: string;
  snippet: string;
  position: number;
  maps?: string;
  aiOverview?: boolean;
  /** a second search with the same result */
  also?: { query: string; position: number };
};

export const rankingsDate = "November 2026";

export const rankings: Ranking[] = [
  {
    query: "solarreinigung thurgau",
    client: "Kaminfeger Tanner GmbH",
    site: "kaminfeger-tanner.ch",
    breadcrumb: "kaminfeger-tanner.ch › solarreinigung",
    title: "Solarreinigung",
    snippet: "Das Team von Kaminfeger Tanner GmbH ist Ihr Ansprechpartner für die Reinigung, den Unterhalt und die Kontrolle von Photovoltaikanlagen …",
    position: 1,
  },
  {
    query: "spiel miete schweiz",
    client: "Challenge Swiss",
    site: "challengeswiss.ch",
    breadcrumb: "challengeswiss.ch › spiele-mieten",
    title: "Spiele mieten – Challenge Swiss",
    snippet: "Nachdem unsere Heimat so viel Schönes und Interessantes bietet, haben wir uns entschlossen, unsere Spiele im Schweizer Design zu kreieren …",
    position: 1,
    aiOverview: true,
    also: { query: "event spiel miete schweiz", position: 1 },
  },
  {
    query: "kaminfeger kanton thurgau",
    client: "Kaminfeger Tanner GmbH",
    site: "kaminfeger-tanner.ch",
    breadcrumb: "kaminfeger-tanner.ch",
    title: "Kaminfeger Tanner GmbH: Home",
    snippet: "Wir sind das Kaminfegerteam aus Kreuzlingen im Kanton Thurgau und bieten Dienstleistungen in den Bereichen Kaminfegerarbeiten und Lüftungsreinigung …",
    position: 2,
    aiOverview: true,
  },
  {
    query: "umzug thurgau",
    client: "BRAUN Services GmbH",
    site: "umzug-braun.ch",
    breadcrumb: "umzug-braun.ch",
    title: "Umzugsfirma Ostschweiz: Privat- & Firmenumzug | BRAUN",
    snippet: "Privat- und Firmenumzüge im Thurgau, in St. Gallen, Schaffhausen und Winterthur. Kostenlose Besichtigung und schriftliche Offerte.",
    position: 2,
    maps: "Google Maps: unter den ersten 3",
  },
  {
    query: "brautmode thurgau",
    client: "Monarosa",
    site: "monarosa.ch",
    breadcrumb: "monarosa.ch",
    title: "monarosa Brautmode & Beauty",
    snippet: "Herzlich willkommen! monarosa bietet vom Brautkleid (fast und ganz neu) bis zum Festkleid, von dem passenden Brautschmuck bis zum perfekten Tanzschuh …",
    position: 3,
    maps: "Google Maps: 4,6 ★ aus 90 Bewertungen",
    also: { query: "brautmode ostschweiz", position: 3 },
  },
];
