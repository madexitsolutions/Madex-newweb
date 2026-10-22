/**
 * PROJEKTCODE – texts and images of the website that can be changed in the
 * dashboard (Website → Texte & Bilder) without touching the code.
 *
 * Add a field here, read it in a page with `const t = await siteContent()` and
 * `t["home.hero.title"]` – it appears in the dashboard automatically. The
 * default is shown until someone changes it.
 */
export type FieldType = "text" | "textarea" | "richtext" | "image" | "url" | "toggle";

export type ContentField = { key: string; label: string; type: FieldType; default: string; help?: string };
export type ContentGroup = { key: string; title: string; description: string; fields: ContentField[] };

export const CONTENT: ContentGroup[] = [
  {
    key: "home",
    title: "Startseite",
    description: "Der erste Eindruck: grosse Überschrift, Bild und die wichtigsten Angebote.",
    fields: [
      { key: "home.hero.eyebrow", label: "Kleine Zeile über dem Titel", type: "text", default: "Willkommen" },
      { key: "home.hero.title", label: "Titel", type: "text", default: "Ihr Partner für Qualität aus der Region" },
      { key: "home.hero.text", label: "Text unter dem Titel", type: "textarea", default: "Wir beraten persönlich, arbeiten sorgfältig und halten, was wir versprechen. Lernen Sie uns kennen." },
      { key: "home.hero.image", label: "Bild", type: "image", default: "", help: "Querformat, mindestens 1600 px breit." },
      { key: "home.hero.button", label: "Knopf: Text", type: "text", default: "Kontakt aufnehmen" },
      { key: "home.hero.buttonUrl", label: "Knopf: Ziel", type: "url", default: "/kontakt" },
      { key: "home.services.show", label: "Angebote anzeigen", type: "toggle", default: "1" },
      { key: "home.services.title", label: "Angebote: Überschrift", type: "text", default: "Was wir für Sie tun" },
      { key: "home.services.1.title", label: "Angebot 1: Titel", type: "text", default: "Beratung" },
      { key: "home.services.1.text", label: "Angebot 1: Text", type: "textarea", default: "Wir nehmen uns Zeit, hören zu und finden gemeinsam die passende Lösung." },
      { key: "home.services.2.title", label: "Angebot 2: Titel", type: "text", default: "Umsetzung" },
      { key: "home.services.2.text", label: "Angebot 2: Text", type: "textarea", default: "Sorgfältig und termingerecht – mit einer festen Ansprechperson." },
      { key: "home.services.3.title", label: "Angebot 3: Titel", type: "text", default: "Service" },
      { key: "home.services.3.text", label: "Angebot 3: Text", type: "textarea", default: "Auch nach dem Auftrag sind wir schnell und unkompliziert für Sie da." },
    ],
  },
  {
    key: "about",
    title: "Über uns",
    description: "Abschnitt auf der Startseite mit Bild und Text.",
    fields: [
      { key: "about.show", label: "Abschnitt anzeigen", type: "toggle", default: "1" },
      { key: "about.title", label: "Titel", type: "text", default: "Über uns" },
      { key: "about.text", label: "Text", type: "richtext", default: "<p>Erzählen Sie hier in wenigen Sätzen, wer Sie sind, was Sie antreibt und was Kundinnen und Kunden von Ihnen erwarten dürfen.</p>" },
      { key: "about.image", label: "Bild", type: "image", default: "" },
    ],
  },
  {
    key: "cta",
    title: "Aufruf zum Handeln",
    description: "Farbiger Abschnitt am Ende der Startseite.",
    fields: [
      { key: "cta.show", label: "Abschnitt anzeigen", type: "toggle", default: "1" },
      { key: "cta.title", label: "Titel", type: "text", default: "Bereit für den nächsten Schritt?" },
      { key: "cta.text", label: "Text", type: "textarea", default: "Rufen Sie uns an oder schreiben Sie uns – wir freuen uns auf Sie." },
      { key: "cta.button", label: "Knopf: Text", type: "text", default: "Jetzt Kontakt aufnehmen" },
      { key: "cta.buttonUrl", label: "Knopf: Ziel", type: "url", default: "/kontakt" },
    ],
  },
  {
    key: "header",
    title: "Kopfzeile",
    description: "Oben auf jeder Seite. Logo und Farben unter Einstellungen → Branding, Menüpunkte unter Website → Menüs.",
    fields: [
      { key: "header.button", label: "Knopf rechts: Text", type: "text", default: "", help: "Leer lassen für keinen Knopf." },
      { key: "header.buttonUrl", label: "Knopf rechts: Ziel", type: "url", default: "/kontakt" },
    ],
  },
  {
    key: "footer",
    title: "Fusszeile",
    description: "Unten auf jeder Seite. Adresse, E-Mail und Telefon kommen aus Einstellungen → Allgemein.",
    fields: [
      { key: "footer.text", label: "Kurzer Text", type: "textarea", default: "" },
      { key: "footer.hours", label: "Öffnungszeiten", type: "textarea", default: "", help: "Eine Zeile pro Tag, z. B. «Mo–Fr 8–17 Uhr»." },
      { key: "footer.instagram", label: "Instagram", type: "url", default: "" },
      { key: "footer.facebook", label: "Facebook", type: "url", default: "" },
      { key: "footer.linkedin", label: "LinkedIn", type: "url", default: "" },
      { key: "footer.youtube", label: "YouTube", type: "url", default: "" },
      { key: "footer.credit", label: "Hinweis «Website von Madex IT Solutions» anzeigen", type: "toggle", default: "1" },
    ],
  },
];

export const CONTENT_FIELDS = CONTENT.flatMap((g) => g.fields);
