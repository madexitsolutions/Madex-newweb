/**
 * Turns the measured data into a readable assessment: headline, summary,
 * strengths, one sentence per category and the three most important
 * improvements, plus a design review of the Google screenshots. Uses the
 * same OpenAI key and model as the chatbot Orion (Admin → Chatbot, default
 * gpt-4o-mini). Without a key – or if the answer is unusable – rule-based
 * texts are built from the checks instead.
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

type Content = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } })[];

/** One JSON answer from the chatbot's model, or null. */
async function askJson(system: string, user: Content, maxTokens: number): Promise<unknown> {
  const s = (await getSettings()).chatbot;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: s.model,
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content;
  return raw ? JSON.parse(raw) : null;
}

/* ---------------------------------------------------------- design review */

const designSchema = z.object({
  score: z.coerce.number().min(0).max(100),
  verdict: z.string().min(10).max(400),
  findings: z
    .array(z.object({ label: z.string().min(3).max(90), status: z.enum(["warn", "bad"]).catch("warn"), problem: z.string().min(5).max(400), fix: z.string().min(5).max(400) }))
    .min(1)
    .max(5),
});

/**
 * Design judgement from the screenshots (desktop and smartphone): an overall
 * rating plus concrete weak spots, as checks of the "design" category.
 */
export async function designReview(input: { url: string; page: PagePreview; desktop?: string; mobile?: string }): Promise<Check[] | null> {
  if (!openAiConfigured() || (!input.desktop && !input.mobile)) return null;
  const system = `Du bist Art Director einer Schweizer Webagentur und beurteilst das Design der Startseite eines KMU anhand von Bildschirmfotos.
Beurteile streng nach dem Stand erfolgreicher Websites von heute: modernes Erscheinungsbild, klare visuelle Hierarchie, Typografie, Weissraum, Bildsprache und Bildqualität, Farbwelt und Markenauftritt, ein sichtbarer Handlungsaufruf im ersten Bildschirm, Vertrauen, Darstellung auf dem Smartphone und störende Elemente (Cookie-Banner, Pop-ups, überladene Bereiche).
Regeln:
- Jede Website hat Verbesserungspotenzial. Nenne 3 bis 5 konkrete Schwachstellen, die auf den Bildern sichtbar sind, mit einer konkreten Verbesserung.
- Punkte 0–100: typische KMU-Websites liegen zwischen 35 und 70, über 80 nur für herausragend moderne Designs, über 90 praktisch nie.
- Beschreibe nur, was auf den Bildern zu sehen ist. Erfinde nichts.
- Schweizer Hochdeutsch, Sie-Form, kein «ß», verständlich für Laien, freundlich aber ehrlich.
Antworte ausschliesslich mit JSON: {"score":55,"verdict":"1–2 Sätze Gesamteindruck","findings":[{"label":"Kurzer Titel der Schwachstelle","status":"warn|bad","problem":"Was man sieht und warum es Kunden abschreckt","fix":"Was wir konkret ändern würden"}]}`;
  const content: Content = [{ type: "text", text: `Website: ${input.url}\nTitel: ${input.page.title}\nHauptüberschrift: ${input.page.h1 || "(keine)"}\nDie Bilder zeigen ${input.desktop && input.mobile ? "zuerst die Desktop-, dann die Smartphone-Ansicht" : input.desktop ? "die Desktop-Ansicht" : "die Smartphone-Ansicht"}.` }];
  for (const img of [input.desktop, input.mobile]) if (img) content.push({ type: "image_url", image_url: { url: img, detail: "low" } });
  try {
    const parsed = designSchema.safeParse(await askJson(system, content, 900));
    if (!parsed.success) return null;
    const d = parsed.data;
    const score = Math.round(Math.min(d.score, 92));
    return [
      {
        id: "design-ai",
        category: "design",
        label: "Gesamteindruck des Designs",
        status: score >= 85 ? "ok" : score >= 55 ? "warn" : "bad",
        value: `${score} / 100`,
        detail: noEszett(d.verdict),
        fix: "Ein frischer, klar strukturierter Auftritt mit starker Bildsprache und deutlichem Handlungsaufruf.",
        weight: 4,
      },
      ...d.findings.map((f, i): Check => ({ id: `design-ai-${i + 1}`, category: "design", label: noEszett(f.label), status: f.status, detail: noEszett(f.problem), fix: noEszett(f.fix), weight: f.status === "bad" ? 1.5 : 1 })),
    ];
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------- assessment */

export async function insights(input: { url: string; page: PagePreview; checks: Check[]; scores: Record<CategoryKey, number> & { overall: number }; opportunities: string[]; madex?: boolean }): Promise<AiInsights> {
  if (openAiConfigured()) {
    try {
      const ai = await askModel(input);
      if (ai) return input.madex ? clientSafe(ai, input) : ai;
    } catch {
      /* fall back to the rule-based text */
    }
  }
  return fallback(input);
}

async function askModel(input: Parameters<typeof insights>[0]): Promise<AiInsights | null> {
  const data = {
    website: input.url,
    titel: input.page.title,
    beschreibung: input.page.description,
    h1: input.page.h1,
    zwischentitel: input.page.headings,
    navigation: input.page.nav,
    woerter: input.page.words,
    punkte: input.scores,
    pruefungen: input.checks.filter((c) => c.status !== "info").map((c) => ({ kategorie: c.category, pruefung: c.label, status: c.status, wert: c.value, ...(c.status === "ok" ? {} : { hinweis: c.detail, loesung: c.fix ?? FIXES[c.id] }) })),
    google_empfehlungen: input.opportunities,
  };
  const system = `Du bist Web- und SEO-Berater bei Madex IT Solutions (Schweiz). Du schreibst den Text einer kostenlosen Website-Analyse für einen KMU-Inhaber.
Regeln:
- Schweizer Hochdeutsch, Sie-Form, kein «ß» (immer «ss»), klar und freundlich, ohne Fachjargon (Fachbegriffe kurz erklären).
- Stütze dich NUR auf die gelieferten Messwerte. Erfinde keine Zahlen, Rankings, Besucherzahlen oder Umsätze und versprich keine Platzierungen.
- Nenne das Unternehmen nicht beim Namen, wenn es nicht eindeutig aus Titel oder H1 hervorgeht.
- Es gibt immer Verbesserungspotenzial. Schreibe nie, dass alles in Ordnung ist oder nichts zu tun sei – auch bei guten Werten zeigst du, was sich noch herausholen lässt.
${
    input.madex
      ? `- Diese Website wurde von Madex IT Solutions entwickelt und wird von uns betreut. Der Ton ist durchwegs positiv und wertschätzend: Die Website ist eine professionelle, sauber umgesetzte Basis. Kritisiere nie Design, Umsetzung oder Technik und verwende keine Wörter wie «Mangel», «Fehler» oder «schlecht».
- Genau drei Empfehlungen als Chancen für mehr Kunden und Sichtbarkeit (z. B. Google-Bewertungen, Google Ads, Social Media, neue Inhalte, lokale Suchmaschinenoptimierung), jeweils mit Wirkung «mittel» oder «niedrig».`
      : `- Genau drei Empfehlungen: die wirksamsten Verbesserungen aus den Prüfungen mit Status "bad" oder "warn", konkret und umsetzbar, nach Wirkung sortiert. Mindestens eine betrifft Design oder Kundengewinnung.`
  }
Antworte ausschliesslich mit JSON in dieser Form:
{"headline":"Kurzes Fazit (max. 12 Wörter)","summary":"2–3 Sätze Gesamteinschätzung","strengths":["Stärke 1","Stärke 2"],"categories":{"seo":"1 Satz","google":"1 Satz","design":"1 Satz","mobile":"1 Satz","speed":"1 Satz","tech":"1 Satz","content":"1 Satz"},"top":[{"title":"Massnahme","problem":"Was heute fehlt und warum es Kunden kostet","solution":"Was konkret zu tun ist","impact":"hoch|mittel|niedrig"}]}`;
  const raw = await askJson(system, `Messdaten der Analyse:\n${JSON.stringify(data)}`, 1500);
  if (!raw) return null;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return null;
  const v = parsed.data;
  const categories: Partial<Record<CategoryKey, string>> = {};
  for (const c of CATEGORIES) if (v.categories[c.key]) categories[c.key] = noEszett(v.categories[c.key]);
  return {
    headline: noEszett(v.headline),
    summary: noEszett(v.summary),
    strengths: v.strengths.map(noEszett),
    categories,
    top: [
      ...v.top.map((t): Recommendation => ({ title: noEszett(t.title), problem: noEszett(t.problem), solution: noEszett(t.solution), impact: input.madex && t.impact === "hoch" ? "mittel" : t.impact })),
      ...(input.madex ? CLIENT_RECOMMENDATIONS : EXTRA_RECOMMENDATIONS),
    ].slice(0, 3),
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
  fonts: "Eine eigene, zur Marke passende Schrift einbinden und konsequent für Titel und Text einsetzen.",
  template: "Ein individuelles Design statt Vorlage – schlanker Code und ein Auftritt, der sich von der Konkurrenz abhebt.",
  legacy: "Das Layout mit zeitgemässer Technik neu aufbauen; veraltete Bausteine entfernen.",
  "touch-icon": "Ein App-Symbol (apple-touch-icon) mit Ihrem Logo hinterlegen.",
  motion: "Dezente Übergänge und Hover-Effekte einsetzen, damit die Seite lebendig und hochwertig wirkt.",
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

/** Always three recommendations: these fill up when the checks find fewer problems. */
const EXTRA_RECOMMENDATIONS: Recommendation[] = [
  {
    title: "Design auf den neusten Stand bringen",
    problem: "Besucher entscheiden in wenigen Sekunden, ob eine Website vertrauenswürdig wirkt. Ein Auftritt, der nicht ganz frisch wirkt, kostet Anfragen – auch wenn die Technik stimmt.",
    solution: "Ein moderner Auftritt mit klarer Struktur, grosszügigem Weissraum, eigener Bildsprache und einem deutlichen Handlungsaufruf im ersten Bildschirm.",
    impact: "hoch",
  },
  {
    title: "Mehr Anfragen aus den Besuchern holen",
    problem: "Viele Besucher verlassen eine Seite, ohne sich zu melden, weil der nächste Schritt nicht sofort klar ist.",
    solution: "Kontaktwege prominent platzieren, Kundenstimmen zeigen und auf jeder Seite einen klaren Aufruf wie «Offerte anfragen» einbauen.",
    impact: "mittel",
  },
  {
    title: "Lokal bei Google sichtbarer werden",
    problem: "Wer in der Region nach Ihren Leistungen sucht, sollte Sie zuerst finden – oft gewinnt dort die Konkurrenz mit besser gepflegten Einträgen.",
    solution: "Google-Unternehmensprofil pflegen, Bewertungen sammeln und Leistungsseiten mit Ortsbezug ergänzen.",
    impact: "mittel",
  },
];

/** For sites built by Madex: growth steps instead of criticism. */
const CLIENT_RECOMMENDATIONS: Recommendation[] = [
  {
    title: "Mehr Google-Bewertungen sammeln",
    problem: "Ihre Website ist eine starke Basis. Bewertungen sind jetzt der Hebel, der Interessenten in der Region zusätzlich überzeugt.",
    solution: "Zufriedene Kunden gezielt um eine Google-Bewertung bitten und die besten Stimmen auf der Website zeigen.",
    impact: "mittel",
  },
  {
    title: "Mit Google Ads und Social Media mehr Besucher gewinnen",
    problem: "Die Website ist bereit für mehr Besucher – gezielte Werbung bringt sie genau dann, wenn Kunden suchen.",
    solution: "Eine lokale Google-Ads-Kampagne und regelmässige Social-Media-Beiträge, die auf Ihre Leistungsseiten führen.",
    impact: "mittel",
  },
  {
    title: "Inhalte laufend erweitern",
    problem: "Neue Inhalte zeigen Google und Besuchern, dass Ihr Unternehmen aktiv ist, und bringen zusätzliche Suchbegriffe.",
    solution: "Referenzen, aktuelle Projekte und Antworten auf häufige Kundenfragen regelmässig ergänzen.",
    impact: "niedrig",
  },
];

/** Rule-based texts from the checks (no AI available). */
export function fallback(input: Parameters<typeof insights>[0]): AiInsights {
  const { scores, checks } = input;
  if (input.madex) return clientFallback(input);
  const weakest = [...CATEGORIES].sort((a, b) => scores[a.key] - scores[b.key]);
  const strongest = [...CATEGORIES].sort((a, b) => scores[b.key] - scores[a.key]);
  const rank = (c: Check) => (c.status === "bad" ? 2 : 1) * c.weight;
  const problems = checks.filter((c) => c.status === "bad" || c.status === "warn").sort((a, b) => rank(b) - rank(a));
  const top: Recommendation[] = problems.slice(0, 3).map((c) => ({
    title: c.label,
    problem: [c.detail, c.value ? `Gemessen: ${c.value}.` : ""].filter(Boolean).join(" "),
    solution: c.fix ?? FIXES[c.id] ?? "Wir zeigen Ihnen gerne, wie sich dieser Punkt mit wenig Aufwand beheben lässt.",
    impact: c.status === "bad" && c.weight >= 2 ? "hoch" : c.status === "bad" ? "mittel" : "niedrig",
  }));
  for (const extra of EXTRA_RECOMMENDATIONS) if (top.length < 3 && !top.some((t) => t.title === extra.title)) top.push(extra);
  const categories: Partial<Record<CategoryKey, string>> = {};
  for (const c of CATEGORIES) {
    const bad = checks.filter((x) => x.category === c.key && x.status === "bad").length;
    const warn = checks.filter((x) => x.category === c.key && x.status === "warn").length;
    categories[c.key] = bad ? `${bad} wichtige${bad === 1 ? "r Punkt" : " Punkte"} mit Handlungsbedarf${warn ? `, ${warn} weitere${warn === 1 ? "r" : ""} Hinweis${warn === 1 ? "" : "e"}` : ""}.` : warn ? `Solide, mit ${warn} Verbesserungsmöglichkeit${warn === 1 ? "" : "en"}.` : "Gute Basis – mit gezieltem Feinschliff holen Sie hier noch mehr heraus.";
  }
  return {
    headline:
      scores.overall >= 85
        ? `Gute Basis – das nächste Potenzial liegt bei ${weakest[0].label}`
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

/** Rule-based texts for a site built by Madex: positive, with growth steps. */
function clientFallback({ scores, checks }: Parameters<typeof insights>[0]): AiInsights {
  const strongest = [...CATEGORIES].sort((a, b) => scores[b.key] - scores[a.key]);
  const categories: Partial<Record<CategoryKey, string>> = {};
  for (const c of CATEGORIES) {
    const open = checks.filter((x) => x.category === c.key && x.status === "warn").length;
    categories[c.key] = open ? `Professionell umgesetzt, mit ${open} Möglichkeit${open === 1 ? "" : "en"} für den weiteren Ausbau.` : "Professionell umgesetzt.";
  }
  return {
    headline: "Professionell umgesetzt – bereit für den nächsten Schritt",
    summary: `Ihre Website steht auf einer soliden, modernen Basis. Besonders stark ist sie bei «${strongest[0].label}» und «${strongest[1].label}». Jetzt geht es darum, noch mehr Besucher und Anfragen daraus zu machen.`,
    strengths: checks
      .filter((c) => c.status === "ok" && c.weight >= 1.5)
      .slice(0, 4)
      .map((c) => c.label),
    categories,
    top: CLIENT_RECOMMENDATIONS,
    ai: false,
  };
}

/**
 * A client's own site must never read as criticism of our work, whatever the
 * model writes: headline, design text and recommendations are fixed, a
 * critical summary is replaced.
 */
function clientSafe(ai: AiInsights, input: Parameters<typeof insights>[0]): AiInsights {
  const safe = clientFallback(input);
  const critical = /design|gestalt|layout|veraltet|altmodisch|mangel|fehler|schlecht|schwach|unprofessionell/i;
  return {
    ...ai,
    headline: safe.headline,
    summary: critical.test(ai.summary) ? safe.summary : ai.summary,
    categories: Object.fromEntries(Object.entries({ ...ai.categories, design: safe.categories.design }).map(([k, v]) => [k, v && critical.test(v) && k !== "design" ? safe.categories[k as CategoryKey] : v])),
    top: CLIENT_RECOMMENDATIONS,
  };
}
