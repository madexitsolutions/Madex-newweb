/**
 * Zentrale Geschäftsdaten. Quelle: data/business.json und die archivierten
 * Seiten von madex-it.ch (Stand 14.10.2026). Komponenten lesen Fakten nur hier.
 */
export const site = {
  name: "Madex IT Solutions",
  legalName: "Madex IT Solutions GmbH",
  uid: "CHE-412.695.793",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://madex-it.ch",
  tagline: "Ein Begleiter, kein Verkäufer",
  claim: "Webdesign, Google Ads, SEO & Social Media für Schweizer KMU.",
  description:
    "Madex IT Solutions ist eine Schweizer Digitalagentur in Neuhausen am Rheinfall: Webdesign, Digital Marketing, SEO, Google Ads, Social Media, Grafikdesign sowie Foto und Werbevideos für KMU.",
  contact: {
    phonePrimary: { label: "052 589 67 59", href: "tel:+41525896759" },
    phoneSecondary: { label: "076 507 33 32", href: "tel:+41765073332" },
    email: "info@madex-it.ch",
    street: "Buchenstrasse 36",
    postalCode: "8212",
    locality: "Neuhausen am Rheinfall",
    region: "Schaffhausen",
    country: "Schweiz",
    mapUrl:
      "https://www.google.com/maps/place/Madex+IT+Solutions+-+Website+%26+Marketing/@47.6913268,8.6133681,17z",
    geo: { lat: 47.6913232, lng: 8.615943 },
  },
  social: [
    { label: "Facebook", href: "https://www.facebook.com/madexitsolutions" },
    { label: "Instagram", href: "https://www.instagram.com/madex.it/" },
    { label: "LinkedIn", href: "https://www.linkedin.com/company/madex-it-solutions/" },
    { label: "YouTube", href: "https://www.youtube.com/channel/UCn77TYdj9CsOi7OZw288PMw" },
  ],
  reviewUrl: "https://g.page/r/CSI9rKyVItIxEAE/review",
  regions: ["Schaffhausen", "Zürich", "Thurgau", "Winterthur", "Ostschweiz"],
} as const;

export type NavLink = { label: string; href: string; description?: string };
export type NavItem = NavLink & { children?: NavLink[]; mega?: boolean };

/** Hauptmenü – gleiche Struktur wie auf madex-it.ch. */
export const mainNav: NavItem[] = [
  {
    label: "Marketing Lösungen",
    href: "/marketing-solutions",
    mega: true,
    children: [
      { label: "Webdesign & Website-Erstellung", href: "/marketing-solutions/website-development" },
      { label: "Digital Marketing", href: "/marketing-solutions/digital-marketing" },
      { label: "SEO Optimierung", href: "/marketing-solutions/seo-optimierung" },
      { label: "Photo & Werbevideos", href: "/marketing-solutions/photo-werbevideos" },
      { label: "Social Media Marketing", href: "/marketing-solutions/social-media-marketing" },
      { label: "Google Marketing", href: "/marketing-solutions/google-marketing" },
      { label: "Graphic Design", href: "/marketing-solutions/graphic-design" },
      { label: "Analyse und Planung", href: "/marketing-solutions/analyse-und-planung" },
    ],
  },
  {
    label: "Wer wir sind",
    href: "/uber-uns",
    children: [
      { label: "Über uns", href: "/uber-uns", description: "Ethos, Werte und Arbeitsweise" },
      { label: "Das Team", href: "/das-team", description: "Die Menschen hinter Madex" },
      { label: "Blog", href: "/blog", description: "Wissen rund um Web & Marketing" },
      { label: "Karriere", href: "/karriere", description: "Offene Stellen bei Madex" },
    ],
  },
  {
    label: "Portfolio",
    href: "/portfolio",
    children: [
      { label: "Website Portfolio", href: "/website-portfolio", description: "Realisierte Kunden-Websites" },
      { label: "Graphic Design Portfolio", href: "/graphic-design-portfolio", description: "Brandings, Print & Social Media" },
      { label: "Werbevideos Portfolio", href: "/werbevideos-portfolio", description: "Werbeclips & Imagefilme" },
    ],
  },
  { label: "Partner", href: "/partners" },
  { label: "Kontakt", href: "/kontakt" },
];

export const legalNav: NavLink[] = [
  { label: "AGB", href: "/agb" },
  { label: "Datenschutz", href: "/datenschutz" },
];

export const usps = [
  { value: 100, suffix: "+", label: "Kunden" },
  { value: 0, label: "Schweizer Agentur", icon: "ch" },
  { value: 0, label: "Persönliche Betreuung", icon: "person" },
  { value: 24, suffix: "h", prefix: "", label: "Antwort innerhalb" },
] as const;

export const freeAnalysis = [
  "SEO-Kurzcheck",
  "Website-Check",
  "Google-Sichtbarkeit",
  "Konkurrenz-Check",
  "3 konkrete Verbesserungsvorschläge",
  "Einschätzung, wo aktuell Leads verloren gehen",
];

export const offerSteps = [
  "Sie wählen Ihr Online-Marketing-Paket",
  "Madex erstellt Ihre neue Website",
  "Domain, Hosting und Änderungen übernehmen wir",
  "Die Website gehört Ihnen auch nach Vertragsende",
];

export type Package = {
  id: string;
  name: string;
  title: string;
  intro: string;
  features: string[];
  href: string;
  highlight?: boolean;
};

export const packages: Package[] = [
  {
    id: "wartung",
    name: "Website Wartung",
    title: "Ihre professionelle Website – komplett betreut",
    intro:
      "Ihre neue Website ist inklusive – wir kümmern uns laufend um Technik, Sicherheit und Aktualisierungen.",
    features: [
      "Domain & Hosting",
      "Bis 8 Seiten",
      "Kontaktformular",
      "1 Std. Updates pro Monat",
      "SEO Basic",
      "Responsive Design",
      "1 E-Mail-Account",
      "Website-Backup",
      "Sicherheits-Plugins",
      "SSL-Zertifikat",
      "Google Analytics & Ads",
      "Mehrsprachigkeit: DE | EN | IT | FR",
    ],
    href: "/marketing-solutions/website-development",
  },
  {
    id: "basic",
    name: "Basic",
    title: "Social Media & Website – alles aus einer Hand",
    intro:
      "Wir betreuen Ihren Social-Media-Auftritt und erstellen Ihre professionelle Website ohne zusätzliche Erstellungskosten.",
    features: [
      "4 Social-Media-Designs pro Monat",
      "1 Werbeclip inkl. Bildslider/Fotogalerie",
      "Betreuung Ihrer Social-Media-Kanäle",
      "Professionelle Fotos vor Ort oder Stockbilder",
      "Individuelle Designs & Texte",
      "Zielgruppen-Definition",
      "Website bis 10 Seiten",
      "Domain & Hosting",
      "Kontaktformular",
      "SEO Basic",
      "Responsive Design",
      "Updates, Backup & Sicherheit",
      "SSL-Zertifikat",
      "Google Analytics",
      "Mehrsprachigkeit möglich",
    ],
    href: "/marketing-solutions/digital-marketing",
    highlight: true,
  },
  {
    id: "premium",
    name: "Premium",
    title: "Social Media, Google Ads & Website – alles aus einer Hand",
    intro:
      "Wir betreuen Ihren Social-Media-Auftritt, schalten gezielte Google Ads und erstellen Ihre professionelle Website ohne zusätzliche Erstellungskosten.",
    features: [
      "Social Media Marketing (6 Designs/Monat)",
      "2 Werbeclips (Bildslider/Fotogalerie)",
      "Betreuung Social Media",
      "Professionelle Fotos (vor Ort & Stock)",
      "Einzigartige Designs",
      "Text-Content (Produkt-/Servicebeschreibung)",
      "Zielgruppen-Definition",
      "Google Ads",
      "Website inklusive",
      "Domain & Hosting",
      "Bis 15 Seiten",
      "Kontaktformular",
      "2 Std./Monat Updates",
      "SEO Premium",
      "Responsive Design (Desktop, Tablet, Mobile)",
      "2 E-Mail-Accounts",
      "Website-Backup",
      "Sicherheits-Plugins",
      "SSL-Zertifikat",
      "Google Analytics & Ads",
      "Mehrsprachigkeit: DE | EN | IT | FR",
    ],
    href: "/marketing-solutions/seo-optimierung",
  },
];

export const whyMadex = [
  { title: "Basic Paket", text: "Website im Wert von CHF 8’000 ist inklusive (12 Monate Vertrag – Online Marketing)." },
  { title: "Service", text: "Änderungen an der Website sind inklusive." },
  { title: "Website", text: "Hosting-, Domain- und SSL-Zertifikatskosten übernehmen wir." },
  { title: "Video", text: "Professionelle Videobearbeitung auch im Basic Paket." },
];

export const growth = [
  {
    title: "Website-Verkehr fördern",
    text: "Wenn Sie bereit sind, die Besucherzahlen auf Ihrer Website zu erhöhen, ist es an der Zeit, mit einer Agentur zusammenzuarbeiten, die weiss, wie Sie Ihre Ziele erreichen können.",
  },
  {
    title: "Erstellen und Verwalten leistungsstarker Werbekampagnen",
    text: "Beim Anzeigenmarketing erstellen Sie spezifische Botschaften, um Menschen zum Handeln zu motivieren.",
  },
  {
    title: "Sammeln, Analysieren und Bereitstellen von Marketingdaten",
    text: "Besorgen Sie sich die Tools, die Sie für die Erfassung von Marketingdaten benötigen, z. B. Google Analytics, und richten Sie Verfahren für die Erfassung und Analyse der Daten ein.",
  },
  {
    title: "Verbesserung der Markenbotschaft und Konversion",
    text: "Wenn Sie Ihr Markenmarketing konsistent halten, können Sie einen bleibenden Eindruck hinterlassen, der sich in den Köpfen der Verbraucher festsetzt und sie immer wieder zurückkommen lässt.",
  },
];

export const homeFaq = [
  {
    q: "Was kostet eine Stunde Website-Änderung bei Madex IT Solutions?",
    a: "Solange Sie mit Madex IT Solutions zusammenarbeiten, sind alle Änderungen an der Website kostenlos. Das gilt auch für alle Kosten, die mit der Website in Verbindung stehen, wie Domain, Hosting und E-Mail.",
  },
  {
    q: "Warum erhalten Sie Ihre Website bei uns inklusive?",
    a: "Unser Ziel ist es, Sie als Kunden zu gewinnen, Ihnen den Mehrwert des Online-Marketings deutlich zu zeigen und eine langfristige Partnerschaft zu etablieren, die über die gesamte Existenz Ihrer Firma hinweg besteht.",
  },
  {
    q: "Welche Laufzeit hat der Vertrag für die inklusive Website?",
    a: "Mit uns gehen Sie nur einen Einjahresvertrag ein, der eine Kündigungsfrist von drei Monaten zum Monatsende vorsieht. Als Dankeschön erhalten Sie die komplette Website als Geschenk. Wir programmieren die Website so lange, bis Sie den Wow-Effekt erleben.",
  },
  {
    q: "Gibt es versteckte Kosten, oder zahlen wir nur für das gewählte Online-Marketing-Paket?",
    a: "Nein, es gibt keine versteckten Kosten. Sie zahlen lediglich für das Online-Marketing-Paket, das Sie ausgewählt haben.",
  },
];

export const testimonials = [
  {
    quote:
      "Ich bin mit der Zusammenarbeit mit Madex IT Solutions sehr zufrieden, von Anfang an eine professionelle Beratung und sehr gute Kundenbetreuung. Das Team ist sehr kreativ und auch eigene Wünsche werden super integriert. Nochmal vielen Dank für die tolle neue Website! Ich freue mich schon auf die weitere Zusammenarbeit und die vielen tollen Aktionen, die wir noch gemeinsam umsetzen werden.",
    name: "Alexander Marx",
    company: "Salvini AG",
  },
  {
    quote:
      "Geschätztes Madex IT Solutions Team, herzlichen Dank für die sehr angenehme und professionelle Zusammenarbeit. Es ist schön, noch ein Unternehmen zu finden, für das die Kundenzufriedenheit wirklich gelebt wird.",
    name: "Daniela Nagel",
    company: "Crescon AG",
  },
  {
    quote:
      "Die Versprechen der Firma Madex IT Solutions sind solide und werden Schritt für Schritt umgesetzt. Mit einem Top-Service und in maximaler Geschwindigkeit. Eine der besten Erfahrungen, die ich in meinen vielen Jahren als selbständiger Unternehmer machen durfte, und eine Kommunikation auf höchstem Niveau.",
    name: "Thomas Haeberli",
    company: "Mistergadget",
  },
];

export type TeamMember = { name: string; role: string; image: string };

export const leadership: TeamMember[] = [
  { name: "Marco Bräm", role: "CEO", image: "/media/brand/team-marco-bram.webp" },
  { name: "Adem Mehmeti", role: "Digital Marketing Consultant", image: "/media/brand/team-adem-mehmeti.webp" },
  { name: "Gazmend Gjerqeku", role: "Team Leader / Visual Communicator", image: "/media/brand/team-gazmend-gjerqeku.webp" },
];

export const clientSupport: TeamMember[] = [
  { name: "Sebastian Stein", role: "Kundenberater", image: "/media/brand/team-sebastian-stein.webp" },
  { name: "Ariane Schmitz", role: "Kundenberaterin", image: "/media/brand/team-ariane-schmitz.webp" },
  { name: "Laura Stein", role: "Kundenberaterin", image: "/media/brand/team-laura-stein.webp" },
];

export const teamGroups: { title: string; members: { role: string; image: string }[] }[] = [
  {
    title: "Graphic Designers",
    members: [
      { role: "Leiter der Grafikdesigner", image: "/media/2024/07/madex-0010.webp" },
      { role: "Graphic Designer", image: "/media/2024/07/madex-0013.webp" },
      { role: "Graphic Designer", image: "/media/2024/07/madex-0014.webp" },
      { role: "Graphic Designer", image: "/media/2026/01/designer.webp" },
    ],
  },
  {
    title: "Web Developers",
    members: [
      { role: "Leiter der Web Developers", image: "/media/2025/05/staff-eegt_1133.webp" },
      { role: "Web Developer", image: "/media/2024/07/dev2.webp" },
      { role: "Web Developer", image: "/media/2024/07/dev3.webp" },
      { role: "Web Developer", image: "/media/2026/01/web-2.webp" },
    ],
  },
  {
    title: "Social Media, Ads & Video",
    members: [
      { role: "Ads Specialist", image: "/media/2024/07/soc-1.webp" },
      { role: "Social Media Manager", image: "/media/2024/09/staff-smm-1.webp" },
      { role: "Video Editor", image: "/media/2026/01/video-s.webp" },
    ],
  },
];

export const photoShoots = [
  "/media/2026/10/edited-9403.webp",
  "/media/2026/10/edited-94742.webp",
  "/media/2026/10/edited-9489.webp",
  "/media/2026/10/edited-9518.webp",
];
