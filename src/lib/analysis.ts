/**
 * Website-Analyse (Gratis-Analyse im Hero): Datentypen, die Server und Browser teilen.
 * Die Engine liegt in src/lib/server/analysis/.
 */

export type CheckStatus = "ok" | "warn" | "bad" | "info";
export type CategoryKey = "seo" | "google" | "design" | "mobile" | "speed" | "tech" | "content";

export const CATEGORIES: { key: CategoryKey; label: string; short: string; weight: number }[] = [
  { key: "seo", label: "SEO-Grundlagen", short: "SEO", weight: 0.19 },
  { key: "google", label: "Google-Sichtbarkeit", short: "Google", weight: 0.15 },
  { key: "design", label: "Design & Wirkung", short: "Design", weight: 0.16 },
  { key: "mobile", label: "Mobile & Responsive", short: "Mobile", weight: 0.16 },
  { key: "speed", label: "Ladezeit & Leistung", short: "Tempo", weight: 0.14 },
  { key: "tech", label: "Technik & Sicherheit", short: "Technik", weight: 0.1 },
  { key: "content", label: "Inhalte & Kundengewinnung", short: "Inhalte", weight: 0.1 },
];

export type Check = {
  id: string;
  category: CategoryKey;
  label: string;
  status: CheckStatus;
  /** short measured value, e.g. "54 Zeichen" */
  value?: string;
  /** one sentence: what it means */
  detail?: string;
  /** what to do about it (when the check brings its own advice, e.g. from the design review) */
  fix?: string;
  weight: number;
};

export type StepKey = "fetch" | "tech" | "seo" | "google" | "mobile" | "speed" | "design" | "ai";
export type StepState = "wait" | "run" | "done" | "skip";

export const STEPS: { key: StepKey; label: string; running: string }[] = [
  { key: "fetch", label: "Website abrufen", running: "Verbindung wird aufgebaut" },
  { key: "tech", label: "Technik & Sicherheit", running: "SSL, Server und Header prüfen" },
  { key: "seo", label: "SEO-Grundlagen", running: "Titel, Überschriften und Bilder lesen" },
  { key: "google", label: "Google-Sichtbarkeit", running: "Indexierung, Sitemap und Firmendaten prüfen" },
  { key: "mobile", label: "Mobile-Test", running: "Darstellung auf dem Smartphone testen" },
  { key: "speed", label: "Ladezeit messen", running: "Ladezeit auf Desktop und Mobile messen" },
  { key: "design", label: "Design bewerten", running: "Gestaltung, Schriften und Wirkung beurteilen" },
  { key: "ai", label: "KI-Auswertung", running: "Ergebnisse bewerten und Empfehlungen schreiben" },
];

export type Vitals = {
  /** Lighthouse performance score 0–100 */
  score: number;
  /** milliseconds */
  lcp?: number;
  fcp?: number;
  tbt?: number;
  si?: number;
  cls?: number;
};

export type Lighthouse = {
  performance: number;
  seo: number;
  accessibility: number;
  bestPractices: number;
  vitals: Vitals;
  /** biggest savings, in German from Google */
  opportunities: { title: string; savingsMs?: number }[];
  hasScreenshot: boolean;
};

export type PagePreview = {
  title: string;
  description: string;
  h1: string;
  favicon: string;
  ogImage: string;
  themeColor: string;
  headings: string[];
  nav: string[];
  images: number;
  links: number;
  words: number;
};

export type Recommendation = { title: string; problem: string; solution: string; impact: "hoch" | "mittel" | "niedrig" };

export type AiInsights = {
  headline: string;
  summary: string;
  strengths: string[];
  categories: Partial<Record<CategoryKey, string>>;
  top: Recommendation[];
  /** false = the rule-based fallback wrote the texts */
  ai: boolean;
};

/** What the browser receives (no e-mail address, no secrets). */
export type ReportView = {
  id: string;
  url: string;
  domain: string;
  createdAt: string;
  status: "running" | "done" | "failed";
  error?: string;
  steps: Record<StepKey, StepState>;
  log: string[];
  page?: PagePreview;
  checks: Check[];
  scores?: Record<CategoryKey, number> & { overall: number };
  lighthouse?: { mobile?: Lighthouse; desktop?: Lighthouse };
  insights?: AiInsights;
  /** Google screenshots that are ready (shown in the scan as soon as they arrive) */
  shots?: { mobile?: boolean; desktop?: boolean };
  /** site built by Madex: closing text speaks to an existing client */
  madex?: boolean;
  emailMasked: string;
  emailSentAt?: string;
};

/** Closing call to action – for sites built by Madex it speaks to an existing client. */
export const closingText = (madex?: boolean) =>
  madex
    ? {
        title: "Gemeinsam den nächsten Schritt gehen",
        text: "Ihre Website ist professionell aufgestellt. Gerne zeigen wir Ihnen in einem kostenlosen Gespräch, wie Sie mit Google Ads, Social Media und laufender Suchmaschinenoptimierung noch mehr Anfragen daraus machen.",
      }
    : {
        title: "Sollen wir diese Punkte für Sie lösen?",
        text: "Wir besprechen den Bericht mit Ihnen kostenlos und unverbindlich und zeigen, was sich mit wenig Aufwand verbessern lässt. Im Madex-Wartungspaket ab CHF 250 pro Monat ist eine neue Website im Wert von CHF 8’000 bereits inklusive – mit Hosting, Domain und laufender Betreuung.",
      };

export const scoreTone = (n: number) => (n >= 85 ? "good" : n >= 60 ? "fair" : n >= 40 ? "weak" : "poor");
export const scoreLabel = (n: number) => (n >= 85 ? "Sehr gut" : n >= 70 ? "Gut" : n >= 50 ? "Ausbaufähig" : "Kritisch");
