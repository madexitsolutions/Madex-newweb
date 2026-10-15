/** Service packages used by Orion's package finder (ported from the plugin). */
import { newId, nowIso, read, update } from "./store";

export type Package = {
  id: string;
  name: string;
  shortDescription: string;
  audience: string;
  features: string[];
  order: number;
  active: boolean;
  internalNotes?: string;
  updatedAt: string;
};

export const SERVICE_OPTIONS: Record<string, string> = {
  website: "Neue Website / Webdesign",
  wartung: "Website-Betreuung & Hosting",
  seo: "SEO – besser gefunden werden",
  "google-ads": "Google Ads",
  "social-media": "Social Media Marketing",
  "foto-video": "Fotos & Werbevideos",
  grafik: "Grafikdesign & Logo",
  ki: "KI-Assistent für die eigene Website",
  analyse: "Kostenlose Website-Analyse",
  other: "Anderes Anliegen",
};

const GOAL_KEYWORDS: Record<string, string[]> = {
  website: ["website", "webseite", "webdesign", "seiten"],
  wartung: ["wartung", "hosting", "updates", "backup", "ssl", "betreuung"],
  seo: ["seo", "suchmaschine"],
  "google-ads": ["google ads", "google-ads", "adwords"],
  "social-media": ["social media", "social-media", "kanalbetreuung", "instagram", "facebook"],
  "foto-video": ["foto", "video", "werbeclip", "clip"],
  grafik: ["design", "grafik", "logo"],
  analyse: ["analyse", "zielgruppe", "strategie"],
};

const DEFAULTS: Omit<Package, "id" | "updatedAt">[] = [
  {
    name: "Website-Wartung",
    shortDescription: "Ihre Website in sicheren Händen: Hosting, Updates, Backups und Sicherheit aus einer Hand.",
    audience: "Unternehmen, die eine bestehende oder neue Website ohne eigenen Aufwand betreuen lassen möchten.",
    features: ["Domain & Hosting", "Website bis 8 Seiten", "Kontaktformular", "1 Std. Updates pro Monat", "SEO Basic", "Responsive für Handy & Tablet", "1 E-Mail-Account", "Backups, Security-Plugins & SSL", "Google Analytics", "Mehrsprachig (DE/EN/IT/FR)"],
    order: 10,
    active: true,
  },
  {
    name: "Basic",
    shortDescription: "Website und Social-Media-Auftritt für KMU, die online sichtbar werden möchten.",
    audience: "KMU, die eine professionelle Website und einen regelmässigen Social-Media-Auftritt aufbauen möchten.",
    features: ["Website bis 10 Seiten inkl. Domain & Hosting", "4 Social-Media-Designs pro Monat", "1 Werbeclip pro Monat", "Social-Media-Kanalbetreuung", "Fotos vor Ort oder Stock-Fotos", "Individuelle Designs & Texte", "Zielgruppendefinition", "Kontaktformular & SEO Basic", "Updates, Backups, Security & SSL", "Google Analytics"],
    order: 20,
    active: true,
  },
  {
    name: "Premium",
    shortDescription: "Das Komplettpaket für mehr Kunden: Website, Social Media, Werbevideos und Google Ads.",
    audience: "Unternehmen, die mit Website, Social Media und Google Ads aktiv neue Kunden gewinnen möchten.",
    features: ["Website bis 15 Seiten inkl. Domain & Hosting", "6 Social-Media-Designs pro Monat", "2 Werbeclips pro Monat", "Social-Media-Management", "Professionelle Fotos", "Google Ads", "SEO Premium", "Produkt- und Leistungstexte", "2 Std. Updates pro Monat", "2 E-Mail-Accounts", "Backups, Security & SSL", "Google Analytics & Ads, mehrsprachig"],
    order: 30,
    active: true,
  },
];

type Data = { items: Package[]; seeded?: boolean };

export async function listPackages(): Promise<Package[]> {
  const d = await read<Data>("packages", { items: [] });
  if (!d.seeded && d.items.length === 0) {
    return DEFAULTS.map((p, i) => ({ ...p, id: `default-${i}`, updatedAt: "" }));
  }
  return [...d.items].sort((a, b) => a.order - b.order);
}

export async function savePackage(input: Omit<Package, "id" | "updatedAt"> & { id?: string }) {
  await update<Data>("packages", { items: [] }, (d) => {
    if (!d.seeded) {
      d.items = DEFAULTS.map((p, i) => ({ ...p, id: newId("p_") + i, updatedAt: nowIso() }));
      d.seeded = true;
    }
    const existing = input.id ? d.items.find((p) => p.id === input.id) : undefined;
    if (existing) Object.assign(existing, input, { updatedAt: nowIso() });
    else d.items.push({ ...input, id: newId("p_"), updatedAt: nowIso() });
  });
}

export async function deletePackage(id: string) {
  await update<Data>("packages", { items: [] }, (d) => {
    if (!d.seeded) {
      d.items = DEFAULTS.map((p, i) => ({ ...p, id: newId("p_") + i, updatedAt: nowIso() }));
      d.seeded = true;
    }
    d.items = d.items.filter((p) => p.id !== id);
  });
}

export type Profile = { goals?: string[]; hasWebsite?: boolean; companySize?: number };

/** Rank active packages by how well they cover the visitor's goals (plugin logic). */
export async function recommend(profile: Profile) {
  const packages = (await listPackages()).filter((p) => p.active);
  const goals = (profile.goals ?? []).filter((g) => g in GOAL_KEYWORDS);
  const size = profile.companySize ?? 0;
  const marketing = goals.filter((g) => ["social-media", "google-ads", "foto-video", "grafik", "seo"].includes(g));
  const maxFeatures = Math.max(1, ...packages.map((p) => p.features.length));
  const ranked = packages.map((p, position) => {
    const title = p.name.toLowerCase();
    const hay = [p.name, p.shortDescription, p.audience, ...p.features].join(" ").toLowerCase();
    const matched: string[] = [];
    const missing: string[] = [];
    let named = 0;
    for (const g of goals) {
      const words = GOAL_KEYWORDS[g];
      if (words.some((w) => title.includes(w))) named++;
      (words.some((w) => hay.includes(w)) ? matched : missing).push(SERVICE_OPTIONS[g] ?? g);
    }
    const breadth = p.features.length / maxFeatures;
    let score = matched.length * 10 + Math.min(named, 1) * 4;
    if (goals.length) score += marketing.length >= 2 || size >= 11 ? breadth * 3 : -breadth * 3;
    score -= position * 0.01;
    return { id: p.id, name: p.name, shortDescription: p.shortDescription, audience: p.audience, features: p.features, match: { score, matched, missing } };
  });
  if (goals.length) ranked.sort((a, b) => b.match.score - a.match.score);
  return ranked;
}
