/**
 * Turns the measured data into a readable assessment: headline, summary,
 * strengths, one sentence per category and the three most important
 * improvements. Uses the same OpenAI key and model as the chatbot Orion
 * (Admin → Chatbot, default gpt-4o-mini). Without a key – or if the answer is
 * unusable – a rule-based text is built from the checks instead.
 */
import { z } from "zod";
import { CATEGORIES, type AiInsights, type CategoryKey, type Check, type PagePreview, type Recommendation } from "@/lib/analysis";
import { openAiConfigured } from "@/lib/server/orion";
import { getSettings } from "@/lib/server/settings";

const schema = z.object({
  headline: z.string().min(5).max(140),
  summary: z.string().min(20).max(900),
  strengths: z.array(z.string().min(3).max(200)).max(4).default([]),
  categories: z.record(z.string(), z.string().max(320)).default({}),
  top: z
    .array(z.object({ title: z.string().min(3).max(120), problem: z.string().min(5).max(400), solution: z.string().min(5).max(500), impact: z.enum(["hoch", "mittel", "niedrig"]).catch("mittel") }))
    .min(1)
    .max(3),
});

const noEszett = (s: string) => s.replace(/ß/g, "ss");

export async function insights(input: { url: string; page: PagePreview; checks: Check[]; scores: Record<CategoryKey, number> & { overall: number }; opportunities: string[] }): Promise<AiInsights> {
  if (openAiConfigured()) {
    try {
      const ai = await askModel(input);
      if (ai) return ai;
    } catch {
      /* fall back to the rule-based text */
    }
  }
  return fallback(input);
}

async function askModel(input: Parameters<typeof insights>[0]): Promise<AiInsights | null> {
  const s = (await getSettings()).chatbot;
  const data = {
    website: input.url,
    titel: input.page.title,
    beschreibung: input.page.description,
    h1: input.page.h1,
    zwischentitel: input.page.headings,
    navigation: input.page.nav,
    woerter: input.page.words,
    punkte: input.scores,
    pruefungen: input.checks.filter((c) => c.status !== "info").map((c) => ({ kategorie: c.category, pruefung: c.label, status: c.status, wert: c.value, ...(c.status === "ok" ? {} : { hinweis: c.detail, loesung: FIXES[c.id] }) })),
    google_empfehlungen: input.opportunities,
  };
  const system = `Du bist Web- und SEO-Berater bei Madex IT Solutions (Schweiz). Du schreibst den Text einer kostenlosen Website-Analyse für einen KMU-Inhaber.
Regeln:
- Schweizer Hochdeutsch, Sie-Form, kein «ß» (immer «ss»), klar und freundlich, ohne Fachjargon (Fachbegriffe kurz erklären).
- Stütze dich NUR auf die gelieferten Messwerte. Erfinde keine Zahlen, Rankings, Besucherzahlen oder Umsätze und versprich keine Platzierungen.
- Nenne das Unternehmen nicht beim Namen, wenn es nicht eindeutig aus Titel oder H1 hervorgeht.
- Die drei Empfehlungen sind die wirksamsten Verbesserungen aus den Prüfungen mit Status "bad" oder "warn" – konkret und umsetzbar, nach Wirkung sortiert.
Antworte ausschliesslich mit JSON in dieser Form:
{"headline":"Kurzes Fazit (max. 12 Wörter)","summary":"2–3 Sätze Gesamteinschätzung","strengths":["Stärke 1","Stärke 2"],"categories":{"seo":"1 Satz","google":"1 Satz","mobile":"1 Satz","speed":"1 Satz","tech":"1 Satz","content":"1 Satz"},"top":[{"title":"Massnahme","problem":"Was heute fehlt und warum es Kunden kostet","solution":"Was konkret zu tun ist","impact":"hoch|mittel|niedrig"}]}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: s.model,
      temperature: 0.3,
      max_tokens: 1400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Messdaten der Analyse:\n${JSON.stringify(data)}` },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) return null;
  const parsed = schema.safeParse(JSON.parse(raw));
  if (!parsed.success) return null;
  const v = parsed.data;
  const categories: Partial<Record<CategoryKey, string>> = {};
  for (const c of CATEGORIES) if (v.categories[c.key]) categories[c.key] = noEszett(v.categories[c.key]);
  return {
    headline: noEszett(v.headline),
    summary: noEszett(v.summary),
    strengths: v.strengths.map(noEszett),
    categories,
    top: v.top.map((t) => ({ title: noEszett(t.title), problem: noEszett(t.problem), solution: noEszett(t.solution), impact: t.impact })),
    ai: true,
  };
}

/** What to do about a failed check – used by the rule-based texts. */
const FIXES: Record<string, string> = {
  https: "Ein kostenloses SSL-Zertifikat (Let's Encrypt) beim Hoster aktivieren und alle Seiten auf https umstellen.",
  redirect: "Eine dauerhafte Weiterleitung (301) von http:// auf https:// einrichten, damit es nur eine Adresse gibt.",
  ttfb: "Hosting, Caching und Datenbank prüfen – ein schnellerer Server oder ein Seiten-Cache verkürzen die Antwortzeit.",
  compression: "Gzip- oder Brotli-Komprimierung auf dem Server einschalten; das ist meist eine Einstellung beim Hoster.",
  headers: "Die Sicherheits-Header HSTS, X-Content-Type-Options und X-Frame-Options auf dem Server ergänzen.",
  mixed: "Alle Bilder, Skripte und Schriften über https:// laden, damit der Browser keine Warnung zeigt.",
  "html-size": "Eingebettete Daten und unnötigen Code aus der Seite entfernen, damit sie schneller lädt.",
  version: "Die Versionsnummer ausblenden und das System regelmässig aktualisieren.",
  title: "Einen eindeutigen Titel mit 30–60 Zeichen schreiben: Leistung, Ort und Firmenname.",
  description: "Eine Meta-Beschreibung mit 70–160 Zeichen schreiben, die Nutzen und Aufruf enthält.",
  h1: "Genau eine Hauptüberschrift (H1) setzen, die sagt, was Sie wo anbieten.",
  structure: "Die Inhalte mit aussagekräftigen Zwischentiteln (H2) gliedern.",
  alt: "Jedem inhaltlichen Bild einen kurzen, beschreibenden Alt-Text geben; reine Schmuckbilder mit alt=\"\" markieren.",
  canonical: "Auf jeder Seite eine kanonische Adresse (rel=canonical) setzen, damit Google keine Duplikate sieht.",
  lang: "Die Sprache im HTML angeben (lang=\"de-CH\").",
  words: "Die Startseite mit mehr hilfreichem Text zu Leistungen, Region und Vorteilen ergänzen.",
  og: "Titel, Beschreibung und Vorschaubild für soziale Medien (Open Graph) hinterlegen.",
  links: "Wichtige Unterseiten von der Startseite aus verlinken.",
  indexable: "Die Sperre (noindex oder robots.txt) entfernen, damit Google die Seite aufnehmen kann.",
  robots: "Eine robots.txt anlegen, die den Weg zur Sitemap zeigt.",
  sitemap: "Eine XML-Sitemap erstellen und in der Google Search Console einreichen.",
  schema: "Firmendaten als strukturierte Daten (Schema.org LocalBusiness) einbauen: Name, Adresse, Telefon, Öffnungszeiten.",
  nap: "Adresse und Telefonnummer gut sichtbar auf jeder Seite zeigen, z. B. im Footer.",
  maps: "Das Google-Unternehmensprofil verlinken oder eine Karte einbinden.",
  analytics: "Eine datenschutzkonforme Besucher-Messung einrichten (z. B. Google Analytics mit Cookie-Hinweis).",
  gsc: "Die Website in der Google Search Console bestätigen, um Suchanfragen und Fehler zu sehen.",
  viewport: "Den Viewport-Tag ergänzen und das Layout für Smartphones anpassen.",
  zoom: "Das Zoomen erlauben (kein maximum-scale=1 und kein user-scalable=no).",
  images: "Bilder in mehreren Grössen ausliefern (srcset), damit Smartphones kleinere Dateien laden.",
  responsive: "Das Layout mit Media Queries für kleine Bildschirme anpassen.",
  "tap-call": "Die Telefonnummer als anklickbaren Link (tel:) einbauen.",
  blocking: "Skripte im Kopfbereich mit defer oder async laden.",
  requests: "Skript- und CSS-Dateien zusammenfassen und nicht benötigte Plugins entfernen.",
  lazy: "Bilder unterhalb des sichtbaren Bereichs mit loading=\"lazy\" laden.",
  formats: "Bilder in WebP oder AVIF umwandeln – das spart oft über die Hälfte der Datenmenge.",
  contact: "Kontaktformular, Telefon und E-Mail auf der Startseite gut sichtbar anbieten.",
  cta: "Klare Knöpfe wie «Offerte anfragen» oder «Termin buchen» an prominenter Stelle einbauen.",
  legal: "Impressum und Datenschutzerklärung erstellen und im Footer jeder Seite verlinken.",
  social: "Ihre Social-Media-Profile im Footer verlinken.",
  fresh: "Jahreszahl im Footer und Inhalte aktualisieren, damit die Website gepflegt wirkt.",
  trust: "Kundenbewertungen, Referenzen oder Gütesiegel auf der Startseite zeigen.",
  "lh-mobile": "Bilder verkleinern, Skripte reduzieren und Caching aktivieren – die grössten Bremsen nennt der Google-Test.",
  "lh-mobile-lcp": "Das grösste Bild oben auf der Seite verkleinern und bevorzugt laden.",
  "lh-a11y": "Kontraste, Schriftgrössen und Beschriftungen von Knöpfen und Formularen verbessern.",
  "lh-seo": "Die von Google gemeldeten SEO-Punkte (Titel, Beschreibungen, Links) beheben.",
  "lh-desktop": "Bilder optimieren, Skripte verzögert laden und Caching aktivieren.",
  "lh-desktop-lcp": "Das Hauptbild verkleinern und bevorzugt laden.",
  "lh-cls": "Bildern und Werbeflächen feste Grössen geben, damit nichts springt.",
  "lh-tbt": "Weniger und kleinere Skripte laden, Drittanbieter-Skripte verzögern.",
  "lh-bp": "Fehler in der Browser-Konsole beheben und veraltete Bibliotheken aktualisieren.",
};

/** Rule-based texts from the checks (no AI available). */
export function fallback(input: Parameters<typeof insights>[0]): AiInsights {
  const { scores, checks } = input;
  const weakest = [...CATEGORIES].sort((a, b) => scores[a.key] - scores[b.key]);
  const strongest = [...CATEGORIES].sort((a, b) => scores[b.key] - scores[a.key]);
  const rank = (c: Check) => (c.status === "bad" ? 2 : 1) * c.weight;
  const problems = checks.filter((c) => c.status === "bad" || c.status === "warn").sort((a, b) => rank(b) - rank(a));
  const top: Recommendation[] = problems.slice(0, 3).map((c) => ({
    title: c.label,
    problem: [c.detail, c.value ? `Gemessen: ${c.value}.` : ""].filter(Boolean).join(" "),
    solution: FIXES[c.id] ?? "Wir zeigen Ihnen gerne, wie sich dieser Punkt mit wenig Aufwand beheben lässt.",
    impact: c.status === "bad" && c.weight >= 2 ? "hoch" : c.status === "bad" ? "mittel" : "niedrig",
  }));
  const categories: Partial<Record<CategoryKey, string>> = {};
  for (const c of CATEGORIES) {
    const bad = checks.filter((x) => x.category === c.key && x.status === "bad").length;
    const warn = checks.filter((x) => x.category === c.key && x.status === "warn").length;
    categories[c.key] = bad ? `${bad} wichtige${bad === 1 ? "r Punkt" : " Punkte"} mit Handlungsbedarf${warn ? `, ${warn} weitere${warn === 1 ? "r" : ""} Hinweis${warn === 1 ? "" : "e"}` : ""}.` : warn ? `Solide, mit ${warn} Verbesserungsmöglichkeit${warn === 1 ? "" : "en"}.` : "Hier ist alles im grünen Bereich.";
  }
  return {
    headline:
      scores.overall >= 85
        ? "Ihre Website ist stark aufgestellt"
        : scores.overall >= 70
          ? `Solide Basis mit Potenzial bei ${weakest[0].label}`
          : scores.overall >= 50
            ? `Gute Ansätze, aber Lücken bei ${weakest[0].label}`
            : `Ihre Website verschenkt Anfragen – vor allem bei ${weakest[0].label}`,
    summary: `Am besten schneidet Ihre Website bei «${strongest[0].label}» ab (${scores[strongest[0].key]} Punkte). Das grösste Potenzial liegt bei «${weakest[0].label}» (${scores[weakest[0].key]} Punkte) und «${weakest[1].label}» (${scores[weakest[1].key]} Punkte).`,
    strengths: checks
      .filter((c) => c.status === "ok" && c.weight >= 2)
      .slice(0, 3)
      .map((c) => c.label),
    categories,
    top,
    ai: false,
  };
}
