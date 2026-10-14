/**
 * Die acht Marketing-Lösungen mit den Inhalten der bestehenden Service-Seiten
 * (archive/pages/page/013–020). URLs bleiben identisch zu madex-it.ch.
 */
export type ServiceSection = { title: string; text: string; image?: string };
export type Faq = { q: string; a: string };

export type Service = {
  slug: string;
  name: string;
  short: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  heroTitle: string;
  image: string;
  icon: IconName;
  introTitle: string;
  intro: string;
  bullets: string[];
  featureTitle?: string;
  featureText?: string;
  gallery?: string[];
  sections: ServiceSection[];
  whyTitle?: string;
  why?: string[];
  faq: Faq[];
};

export type IconName = "web" | "digital" | "seo" | "video" | "social" | "google" | "design" | "analysis";

export const services: Service[] = [
  {
    slug: "website-development",
    name: "Webdesign & Website-Erstellung",
    short: "Wir erstellen einzigartige und funktionale Websites, die Ihre digitalen Bedürfnisse erfüllen.",
    metaTitle: "Webdesign Schaffhausen – professionelle Websites für KMU & Start-ups",
    metaDescription:
      "Moderne, individuelle Websites aus Schaffhausen: responsives Webdesign, SEO-Grundoptimierung, schnelle Ladezeiten, WordPress und persönlicher Support.",
    eyebrow: "Marketing Solutions",
    heroTitle: "Webdesign & Website-Erstellung",
    image: "/media/brand/service-website-development.webp",
    icon: "web",
    introTitle: "Professionelle Websites für einen starken Online-Auftritt",
    intro:
      "Ihre Website ist oft der erste Eindruck, den potenzielle Kunden von Ihrem Unternehmen erhalten. Wir entwickeln moderne, individuelle Websites, die professionell aussehen, schnell laden und auf allen Geräten optimal funktionieren. Von der Planung über das Design bis zur fertigen Website erhalten Sie bei Madex IT Solutions alles aus einer Hand.",
    bullets: [
      "Individuelles Webdesign",
      "Optimiert für Smartphone, Tablet & Desktop",
      "SEO-Grundoptimierung",
      "Schnelle Ladezeiten",
      "WordPress & einfache Verwaltung",
      "Persönlicher Support",
    ],
    featureTitle: "Webdesign Schaffhausen für anspruchsvolle Projekte",
    featureText:
      "Wir erstellen Websites für KMU, Start-ups und Unternehmen, die online professionell auftreten und neue Kunden erreichen möchten. Dabei verbinden wir modernes Design, einfache Bedienung und eine klare Struktur zu einer Website, die zu Ihrem Unternehmen passt.",
    gallery: ["/media/2024/08/sc-detheme2.webp", "/media/2024/08/sc-detheme1.webp", "/media/2024/08/sc-detheme3.webp"],
    sections: [
      {
        title: "Individuelles Webdesign",
        text: "Keine Website von der Stange. Wir entwickeln ein Design, das zu Ihrem Unternehmen, Ihrer Marke und Ihrer Zielgruppe passt. Modern, professionell und individuell auf Sie abgestimmt.",
        image: "/media/2024/08/7.webp",
      },
      {
        title: "Optimiert für alle Geräte",
        text: "Ihre Website funktioniert auf Smartphone, Tablet und Desktop einwandfrei. So erhalten Ihre Besucher auf jedem Gerät einen professionellen und benutzerfreundlichen Auftritt.",
        image: "/media/2024/08/b21.webp",
      },
      {
        title: "SEO & Performance",
        text: "Eine gute Website muss nicht nur gut aussehen – sie muss auch gefunden werden. Wir achten bereits bei der Erstellung auf SEO-Grundlagen, schnelle Ladezeiten und eine saubere technische Struktur.",
        image: "/media/2024/08/133664.webp",
      },
      {
        title: "Support & Wartung",
        text: "Auch nach der Veröffentlichung Ihrer Website sind wir für Sie da. Ob Änderungen, neue Inhalte, technische Fragen oder laufende Wartung – Madex IT Solutions unterstützt Sie persönlich und unkompliziert. Alle Änderungen an Ihrer Website sind inklusive und für Sie kostenlos.",
        image: "/media/2024/08/138060.webp",
      },
      {
        title: "Moderne Technik",
        text: "Wir setzen auf moderne und bewährte Technologien, damit Ihre Website schnell, sicher und langfristig erweiterbar bleibt. Ihre Website kann mit Ihrem Unternehmen wachsen.",
        image: "/media/2024/08/ch.webp",
      },
      {
        title: "WordPress & einfache Verwaltung",
        text: "Auf Wunsch erstellen wir Ihre Website mit WordPress. Dadurch können Inhalte wie Texte und Bilder später einfach angepasst und erweitert werden.",
      },
    ],
    whyTitle: "Ihre Website. Unser Anspruch.",
    why: [
      "Wir entwickeln Websites, die nicht nur gut aussehen, sondern Ihr Unternehmen professionell präsentieren und Ihre Leistungen verständlich vermitteln.",
      "Von der ersten Idee bis zur fertigen Website haben Sie bei uns einen persönlichen Ansprechpartner.",
      "Ihr Vorteil: weniger Risiko, mehr Leistung. Während viele Anbieter mit Vertragslaufzeiten von bis zu 3 Jahren arbeiten, beträgt die Laufzeit bei uns nur 1 Jahr. Ihre Website nach Ihren individuellen Wünschen ist inklusive.",
      "Webdesign, Entwicklung, SEO und Support – alles aus einer Hand.",
    ],
    faq: [
      {
        q: "Wie lange dauert die Entwicklung einer Website bei Madex IT Solutions?",
        a: "Die Dauer der Website-Entwicklung hängt von den spezifischen Anforderungen und der Komplexität des Projekts ab. Im Allgemeinen dauert es zwischen 4 und 8 Wochen, bis eine Website fertiggestellt ist. Wir erstellen jedoch einen detaillierten Zeitplan, der den gesamten Entwicklungsprozess abdeckt, und halten Sie währenddessen regelmässig auf dem Laufenden.",
      },
      {
        q: "Kann ich meine Website nach der Fertigstellung selbst aktualisieren?",
        a: "Ja, wir integrieren benutzerfreundliche Content-Management-Systeme (CMS) wie WordPress, die es Ihnen ermöglichen, Ihre Websiteinhalte problemlos selbst zu aktualisieren.",
      },
      {
        q: "Bieten Sie auch SEO-Dienstleistungen an?",
        a: "Ja, SEO (Suchmaschinenoptimierung) ist ein integraler Bestandteil unseres Website-Entwicklungsprozesses. Wir optimieren Ihre Website für Suchmaschinen, damit sie gut sichtbar ist. Darüber hinaus bieten wir auch fortlaufende SEO-Dienstleistungen an, um Ihre Online-Präsenz kontinuierlich zu verbessern.",
      },
      {
        q: "Was passiert, wenn ich nach der Fertigstellung meiner Website Unterstützung benötige?",
        a: "Wir bieten fortlaufenden Support und Wartung für alle von uns erstellten Websites an. Ob Sie technische Unterstützung, Inhaltsaktualisierungen oder Funktionsänderungen benötigen – unser Team steht Ihnen zur Verfügung, damit Ihre Website stets optimal funktioniert.",
      },
    ],
  },
  {
    slug: "digital-marketing",
    name: "Digital Marketing",
    short: "Steigern Sie Ihre Online-Präsenz und erreichen Sie mehr Kunden effektiv.",
    metaTitle: "Online Marketing Schaffhausen – Experten für digitale Präsenz",
    metaDescription:
      "Digital Marketing für Schweizer KMU: Google Ads, SEO, Social Media, Content Marketing, Analyse & Reporting sowie Strategie und Beratung aus einer Hand.",
    eyebrow: "Digital Marketing",
    heroTitle: "Mehr Sichtbarkeit. Mehr Anfragen. Mehr Kunden.",
    image: "/media/brand/service-digital-marketing.webp",
    icon: "digital",
    introTitle: "Digital Marketing mit Madex IT Solutions",
    intro:
      "Wir entwickeln digitale Marketinglösungen, die zu Ihrem Unternehmen und Ihren Zielen passen. Ob Google, Social Media oder SEO – wir kombinieren die passenden Kanäle, damit Sie mehr Reichweite erzielen, neue Kunden erreichen und Ihren Online-Auftritt gezielt stärken.",
    bullets: [
      "Google Ads",
      "Suchmaschinenoptimierung (SEO)",
      "Social Media Marketing",
      "Content Marketing",
      "Analyse & Reporting",
      "Strategie & Beratung",
    ],
    featureTitle: "Online Marketing für Schweizer KMU",
    featureText:
      "Wir unterstützen Unternehmen in Schaffhausen, Zürich, Thurgau, Winterthur und der gesamten Ostschweiz dabei, online besser gefunden zu werden und gezielt neue Kunden anzusprechen. Dabei setzen wir nicht auf einzelne Massnahmen, sondern auf eine Strategie, die zu Ihrem Unternehmen passt.",
    sections: [
      {
        title: "Strategie & Beratung",
        text: "Erfolgreiches Marketing beginnt mit einem klaren Plan. Wir analysieren Ihre aktuelle Situation, Ihre Zielgruppe und Ihre Ziele und entwickeln daraus eine passende Online-Marketing-Strategie. Klar geplant. Verständlich umgesetzt. Messbar ausgewertet.",
      },
      {
        title: "Suchmaschinenoptimierung (SEO)",
        text: "Wer bei Google nicht gefunden wird, verliert potenzielle Kunden. Wir optimieren Ihre Website technisch und inhaltlich, damit Sie bei relevanten Suchanfragen besser sichtbar werden.",
      },
      {
        title: "Google Ads",
        text: "Mit gezielten Google Ads erreichen Sie potenzielle Kunden genau dann, wenn sie aktiv nach Ihren Leistungen suchen. Wir übernehmen Planung, Einrichtung, Betreuung und laufende Optimierung Ihrer Kampagnen.",
      },
      {
        title: "Social Media Marketing",
        text: "Wir erstellen professionelle Inhalte für Social Media, die zu Ihrem Unternehmen passen und Ihre Marke sichtbar machen. Von der Planung über das Design bis zur Veröffentlichung übernehmen wir Ihre Social-Media-Betreuung.",
      },
      {
        title: "Content Marketing",
        text: "Gute Inhalte schaffen Vertrauen und zeigen, was Ihr Unternehmen auszeichnet. Wir erstellen passende Inhalte für Website, Social Media und Online-Kampagnen – klar, professionell und auf Ihre Zielgruppe abgestimmt.",
      },
      {
        title: "Analyse & Reporting",
        text: "Online Marketing muss messbar sein. Wir analysieren laufend die wichtigsten Ergebnisse und optimieren Ihre Kampagnen auf Basis echter Daten. So sehen Sie transparent, was funktioniert und wo Potenzial besteht.",
      },
    ],
    faq: [
      {
        q: "Welche Leistungen umfasst Digital Marketing?",
        a: "Je nach Ziel kombinieren wir Google Ads, SEO, Social Media Marketing, Content Marketing sowie Analyse und Strategie zu einer passenden Lösung für Ihr Unternehmen.",
      },
      {
        q: "Wie schnell sehe ich Ergebnisse?",
        a: "Das hängt vom gewählten Kanal ab. Google Ads kann bereits kurzfristig Sichtbarkeit erzeugen, während SEO in der Regel längerfristig aufgebaut wird.",
      },
      {
        q: "Kann ich die Ergebnisse messen?",
        a: "Ja. Wir analysieren die wichtigsten Kennzahlen und zeigen Ihnen transparent, wie sich Ihre Kampagnen entwickeln.",
      },
      {
        q: "Welches Marketing ist für mein Unternehmen geeignet?",
        a: "Das hängt von Ihrer Branche, Zielgruppe und Ihren Zielen ab. Deshalb analysieren wir zuerst Ihre aktuelle Situation und empfehlen danach die passenden Massnahmen.",
      },
    ],
  },
  {
    slug: "seo-optimierung",
    name: "SEO Optimierung",
    short: "Verbessern Sie Ihr Suchmaschinen-Ranking und erhöhen Sie Ihre Online-Sichtbarkeit.",
    metaTitle: "SEO Optimierung – Schaffhausen, Zürich, Thurgau, Ostschweiz",
    metaDescription:
      "SEO-Optimierung von Madex IT Solutions: On-Page, Keyword-Analyse, Content-Optimierung, technische SEO, Linkbuilding und regelmässiges Reporting.",
    eyebrow: "Marketing Solutions",
    heroTitle: "SEO Optimierung",
    image: "/media/brand/service-seo-optimization.webp",
    icon: "seo",
    introTitle: "SEO-Optimierung bei Madex IT Solutions",
    intro:
      "Bei Madex IT Solutions verstehen wir, wie wichtig es ist, dass Ihre Website in den Suchmaschinen gefunden wird. Unsere SEO-Optimierungsdienste sind darauf ausgerichtet, Ihre Online-Präsenz zu maximieren, indem wir sicherstellen, dass Ihre Website in den Suchergebnissen gut platziert ist. Wir verfolgen einen ganzheitlichen Ansatz, der sowohl On-Page- als auch Off-Page-Optimierungen umfasst.",
    bullets: [
      "On-Page-Optimierung",
      "Keyword-Analyse und -Integration",
      "Content-Optimierung",
      "Technische SEO",
      "Linkbuilding und Off-Page-Optimierung",
      "Regelmässige Berichterstattung und Analyse",
    ],
    featureTitle: "Steigern Sie Ihre Online-Sichtbarkeit mit unserer SEO Optimierung",
    featureText:
      "Schliessen Sie die SEO Optimierung mit uns ab und profitieren Sie von einem exklusiven Angebot: Wir verbessern Ihr Suchmaschinen-Ranking und erhöhen Ihre Online-Sichtbarkeit durch gezielte On-Page-Optimierung, Keyword-Analyse und -Integration, Content-Optimierung sowie technische SEO und Linkbuilding. Als besonderes Geschenk erhalten Sie eine hochwertige Website dazu. Der Vertrag hat nur eine Laufzeit von 12 Monaten – für Unternehmen in Schaffhausen, Zürich, Thurgau und der Ostschweiz.",
    gallery: ["/media/2025/02/1060723_OLS73W0.webp"],
    sections: [
      {
        title: "On-Page-Optimierung",
        text: "Die On-Page-Optimierung ist ein wesentlicher Bestandteil unserer SEO-Strategie. Sie umfasst alle Massnahmen, die direkt auf Ihrer Website durchgeführt werden, um deren Sichtbarkeit in Suchmaschinen zu verbessern. Dazu gehören die Optimierung von Meta-Tags, Überschriften, internen Links und der Content-Struktur.",
        image: "/media/2024/09/8488.webp",
      },
      {
        title: "Keyword-Analyse und -Integration",
        text: "Eine fundierte Keyword-Analyse bildet die Grundlage jeder erfolgreichen SEO-Strategie. Wir identifizieren die relevantesten Keywords für Ihr Unternehmen und integrieren sie gezielt in Ihre Website-Inhalte – für Suchanfragen, die für Ihre Branche und Zielgruppe wichtig sind.",
        image: "/media/2024/09/90387.webp",
      },
      {
        title: "Content-Optimierung",
        text: "Content ist der Schlüssel zur SEO-Optimierung. Wir helfen Ihnen, qualitativ hochwertigen und relevanten Content zu erstellen, der sowohl Ihre Zielgruppe anspricht als auch von Suchmaschinen bevorzugt wird.",
        image: "/media/2024/09/121464.webp",
      },
      {
        title: "Technische SEO",
        text: "Neben der inhaltlichen Optimierung ist auch die technische SEO entscheidend. Wir analysieren und optimieren Ladegeschwindigkeit, mobile Optimierung, Crawling und Indexierung, damit Ihre Website von Suchmaschinen besser verstanden und bewertet wird.",
        image: "/media/2024/09/2150040193.webp",
      },
      {
        title: "Linkbuilding und Off-Page-Optimierung",
        text: "Linkbuilding ist ein wichtiger Teil der Off-Page-Optimierung. Wir entwickeln Strategien, um qualitativ hochwertige Backlinks zu Ihrer Website aufzubauen, die Ihre Autorität in den Suchmaschinen stärken.",
        image: "/media/2024/09/71201.webp",
      },
      {
        title: "Regelmässige Berichterstattung und Analyse",
        text: "Wir bieten Ihnen regelmässige Berichte und Analysen mit Kennzahlen wie Suchmaschinen-Rankings, organischem Traffic und Conversion-Raten. Anhand dieser Daten passen wir die Strategie kontinuierlich an.",
        image: "/media/2024/09/348.webp",
      },
    ],
    whyTitle: "Warum uns wählen?",
    why: [
      "Mit Madex IT Solutions entscheiden Sie sich für einen Partner, der Ihre SEO-Strategie ganzheitlich betrachtet und massgeschneiderte Lösungen bietet. Wir setzen auf bewährte Methoden und aktuelle Techniken, um Ihre Website in den Suchmaschinen nach vorne zu bringen.",
      "Bereit, Ihre Website in den Suchmaschinen nach oben zu bringen? Kontaktieren Sie uns und lassen Sie uns gemeinsam Ihre SEO-Strategie umsetzen.",
    ],
    faq: [
      {
        q: "Wie lange dauert es, bis meine Website in den Suchmaschinen besser rankt?",
        a: "SEO ist ein langfristiger Prozess, und es kann mehrere Monate dauern, bis deutliche Verbesserungen sichtbar werden. Wir empfehlen, mindestens 3 bis 6 Monate einzuplanen, um erste Ergebnisse zu sehen. Zeitpunkt und Umfang hängen von Ausgangslage, Wettbewerb und Massnahmen ab.",
      },
      {
        q: "Was ist der Unterschied zwischen On-Page- und Off-Page-SEO?",
        a: "On-Page-SEO bezieht sich auf alle Optimierungsmassnahmen, die direkt auf Ihrer Website durchgeführt werden, wie die Optimierung von Inhalten und Meta-Tags. Off-Page-SEO umfasst Massnahmen ausserhalb Ihrer Website, wie Linkbuilding und Social-Media-Signale.",
      },
      {
        q: "Wie kann ich den Erfolg meiner SEO-Strategie messen?",
        a: "Wir bieten regelmässige Berichte mit Kennzahlen wie Suchmaschinen-Rankings, organischem Traffic und Conversion-Raten. Diese helfen Ihnen, den Fortschritt zu verstehen und datenbasierte Entscheidungen zu treffen.",
      },
      {
        q: "Ist SEO eine einmalige Massnahme?",
        a: "Nein, SEO ist ein kontinuierlicher Prozess. Suchmaschinen-Algorithmen ändern sich ständig, und auch die Konkurrenz bleibt nicht stehen. Daher ist es wichtig, die SEO-Strategie regelmässig zu überprüfen und anzupassen.",
      },
    ],
  },
  {
    slug: "photo-werbevideos",
    name: "Photo & Werbevideos",
    short: "Kreative und ansprechende visuelle Inhalte zur Förderung Ihrer Marke.",
    metaTitle: "Photo & Werbevideos – Professionelle Fotografie und Imagefilme",
    metaDescription:
      "Professionelle Fotografie, kreative Werbevideos, Imagefilme, Social-Media-Videos und Postproduktion von Madex IT Solutions.",
    eyebrow: "Marketing Solutions",
    heroTitle: "Photo & Werbevideos",
    image: "/media/brand/service-photo-advertising-video.webp",
    icon: "video",
    introTitle: "Photo & Werbevideos bei Madex IT Solutions",
    intro:
      "Bei Madex IT Solutions wissen wir, dass visuelle Inhalte eine zentrale Rolle im Marketing spielen. Ob Sie beeindruckende Fotos oder professionelle Werbevideos benötigen – unser Team liefert kreative und massgeschneiderte Lösungen, die Ihre Marke ins richtige Licht rücken und Ihre Botschaft klar und ansprechend vermitteln.",
    bullets: [
      "Professionelle Fotografie",
      "Kreative Werbevideos",
      "Imagefilme und Unternehmenspräsentationen",
      "Social Media Videos",
      "Postproduktion und Videobearbeitung",
    ],
    sections: [
      {
        title: "Professionelle Fotografie",
        text: "Ein Bild sagt mehr als tausend Worte – und wir sorgen dafür, dass Ihre Bilder die richtigen Worte sagen. Ob Porträtfotos, Produktbilder oder Eventaufnahmen – wir fangen die besten Momente und Perspektiven ein, die Ihre Marke authentisch und ansprechend darstellen.",
        image: "/media/2024/09/32.webp",
      },
      {
        title: "Kreative Werbevideos",
        text: "Videos sind ein mächtiges Werkzeug, um Ihre Botschaft direkt an Ihr Publikum zu vermitteln. Von der Konzeptentwicklung über das Storyboarding bis hin zur Produktion und Postproduktion begleiten wir Sie durch den gesamten Prozess.",
        image: "/media/2024/09/49854.webp",
      },
      {
        title: "Imagefilme und Unternehmenspräsentationen",
        text: "Ein Imagefilm ist mehr als nur ein Video – er ist das Gesicht Ihres Unternehmens. Wir erstellen Imagefilme, die Ihre Werte und Ihre Vision authentisch vermitteln und einen bleibenden Eindruck hinterlassen.",
        image: "/media/2024/09/41072.webp",
      },
      {
        title: "Social Media Videos",
        text: "Kurze, prägnante Videos, die sich leicht teilen lassen, sind heute unverzichtbar. Wir erstellen Social-Media-Videos, die auf die Plattformen und Zielgruppen abgestimmt sind, die Sie ansprechen möchten.",
        image: "/media/2024/09/934.webp",
      },
      {
        title: "Postproduktion und Videobearbeitung",
        text: "Der Feinschliff macht den Unterschied. Wir bieten umfassende Postproduktion, einschliesslich Schnitt, Farbkorrektur, Sounddesign und Spezialeffekten, damit Ihr Endprodukt professionell und beeindruckend ist.",
      },
    ],
    whyTitle: "Warum uns wählen?",
    why: [
      "Bei Madex IT Solutions verstehen wir die Macht der visuellen Kommunikation. Unser Team arbeitet eng mit Ihnen zusammen, um visuelle Inhalte zu erstellen, die Ihre Marke stärken und Ihre Botschaft effektiv vermitteln.",
      "Bereit, Ihre Marke visuell aufzuwerten? Kontaktieren Sie uns, um Ihre Foto- und Videoprojekte mit Madex IT Solutions zu realisieren.",
    ],
    faq: [
      {
        q: "Wie lange dauert es, ein Werbevideo zu erstellen?",
        a: "Die Dauer hängt von der Komplexität des Projekts ab. Kleinere Projekte können innerhalb weniger Wochen abgeschlossen werden, grössere Produktionen können mehrere Monate in Anspruch nehmen. Wir erstellen einen detaillierten Zeitplan und halten Sie regelmässig auf dem Laufenden.",
      },
      {
        q: "Können Sie auch Videos für Social Media erstellen?",
        a: "Ja, wir erstellen speziell auf Social Media zugeschnittene Videos, die kurz, prägnant und für Ihre Zielplattformen optimiert sind.",
      },
      {
        q: "Welche Art von Fotografie bieten Sie an?",
        a: "Wir bieten Produktfotografie, Porträtfotografie, Eventfotografie und Unternehmensfotografie an – mit hochwertigen Bildern, die Ihre Marke authentisch präsentieren.",
      },
      {
        q: "Wie viel kostet die Produktion eines Werbevideos?",
        a: "Die Kosten variieren je nach Umfang und Anforderungen des Projekts. Wir erstellen individuelle Angebote, die auf Ihre Bedürfnisse und Ihr Budget zugeschnitten sind.",
      },
    ],
  },
  {
    slug: "social-media-marketing",
    name: "Social Media Marketing",
    short: "Erhöhen Sie Ihre Reichweite und Interaktion auf allen sozialen Plattformen.",
    metaTitle: "Social Media Marketing – Werbung in Schaffhausen, Zürich, Thurgau",
    metaDescription:
      "Social Media Marketing von Madex IT Solutions: Strategie, Content-Erstellung, Community Management, Social Media Advertising sowie Analyse und Reporting.",
    eyebrow: "Marketing Solutions",
    heroTitle: "Social Media Marketing",
    image: "/media/brand/service-social-media-marketing.webp",
    icon: "social",
    introTitle: "Social Media Marketing bei Madex IT Solutions",
    intro:
      "Social Media Marketing ist unverzichtbar, um Ihre Marke sichtbar zu machen und eine enge Verbindung zu Ihrer Zielgruppe aufzubauen. Wir bieten umfassende Social-Media-Dienstleistungen, die Ihre Online-Präsenz stärken und Ihre Markenbekanntheit steigern – mit Strategien, die genau auf die Bedürfnisse und Ziele Ihres Unternehmens abgestimmt sind.",
    bullets: [
      "Strategische Planung und Beratung",
      "Content-Erstellung und -Management",
      "Community Management",
      "Social Media Advertising",
      "Analyse und Reporting",
    ],
    sections: [
      {
        title: "Strategische Planung und Beratung",
        text: "Erfolgreiches Social Media Marketing beginnt mit einer klaren Strategie. Wir arbeiten eng mit Ihnen zusammen, um Ihre Zielgruppe zu verstehen, die richtigen Plattformen auszuwählen, Inhalte zu planen und Kampagnen zu entwickeln, die Ihre Marke ins rechte Licht rücken.",
      },
      {
        title: "Content-Erstellung und -Management",
        text: "Der Schlüssel zu erfolgreichem Social Media Marketing ist ansprechender und relevanter Content. Ob Texte, Bilder, Videos oder Infografiken – wir füllen Ihre Kanäle mit hochwertigen Inhalten und übernehmen das Management, damit konsistent und effektiv veröffentlicht wird.",
      },
      {
        title: "Community Management",
        text: "Eine aktive und engagierte Community ist der Grundstein für den Erfolg in den sozialen Medien. Wir betreuen Ihre Kanäle, antworten auf Kommentare und Nachrichten und fördern das Engagement, um eine loyale Community aufzubauen.",
      },
      {
        title: "Social Media Advertising",
        text: "Um Ihre Reichweite weiter zu steigern, bieten wir zielgerichtete Social-Media-Kampagnen an. Wir erstellen und verwalten Werbeanzeigen, die genau auf Ihre Zielgruppe zugeschnitten sind – mit präzisem Targeting und kontinuierlicher Optimierung.",
      },
      {
        title: "Analyse und Reporting",
        text: "Detaillierte Analysen und Berichte geben Ihnen Einblicke in die Leistung Ihrer Kampagnen. So können Sie den Erfolg Ihrer Strategie bewerten und fundierte Entscheidungen für Ihre Social-Media-Aktivitäten treffen.",
      },
    ],
    whyTitle: "Warum uns wählen?",
    why: [
      "Madex IT Solutions ist Ihr Partner für effektives Social Media Marketing. Wir setzen auf kreative Inhalte, strategisches Denken und datengetriebene Entscheidungen, damit Ihre Social-Media-Aktivitäten einen echten Mehrwert für Ihr Unternehmen bieten.",
    ],
    faq: [
      {
        q: "Welche Social-Media-Plattformen sollte mein Unternehmen nutzen?",
        a: "Die Wahl der richtigen Plattformen hängt von Ihrer Zielgruppe und Ihren Unternehmenszielen ab. Wir helfen Ihnen, die Plattformen auszuwählen, die am besten zu Ihrer Marke passen.",
      },
      {
        q: "Wie oft sollte ich auf Social Media posten?",
        a: "Die Häufigkeit variiert je nach Plattform und Zielgruppe. Wir empfehlen regelmässiges Posten und erstellen für Sie einen massgeschneiderten Posting-Plan.",
      },
      {
        q: "Wie kann Social Media Marketing meinem Unternehmen helfen?",
        a: "Social Media Marketing steigert die Bekanntheit Ihrer Marke, baut Vertrauen auf und bringt Sie direkt mit Ihrer Zielgruppe in Kontakt. Durch gezielte Kampagnen und ansprechenden Content machen wir potenzielle Kunden auf Ihre Angebote aufmerksam.",
      },
      {
        q: "Wie messe ich den Erfolg meiner Social-Media-Kampagnen?",
        a: "Wir liefern Analysen und Berichte mit Kennzahlen wie Reichweite, Engagement, Klicks und Conversions, damit Sie den Erfolg bewerten und fundiert planen können.",
      },
    ],
  },
  {
    slug: "google-marketing",
    name: "Google Marketing",
    short: "Nutzen Sie gezielte Anzeigen und SEO, um Ihre Sichtbarkeit auf Google zu maximieren.",
    metaTitle: "Google Marketing – Google Ads und Werbung in Schaffhausen",
    metaDescription:
      "Google Ads Kampagnen, Optimierung des Google-Unternehmensprofils sowie Google Analytics und Conversion Tracking von Madex IT Solutions.",
    eyebrow: "Marketing Solutions",
    heroTitle: "Google Marketing",
    image: "/media/brand/service-google-marketing.webp",
    icon: "google",
    introTitle: "Google Marketing bei Madex IT Solutions",
    intro:
      "Bei Madex IT Solutions bieten wir gezielte Google-Marketing-Dienstleistungen, die Ihnen helfen, Ihre Marke effektiv zu bewerben und Ihre Zielgruppe genau dann zu erreichen, wenn sie nach Ihren Produkten oder Dienstleistungen sucht.",
    bullets: ["Google Ads Kampagnen", "Google-Unternehmensprofil Optimierung", "Google Analytics und Conversion Tracking"],
    sections: [
      {
        title: "Google Ads Kampagnen",
        text: "Unsere Google-Ads-Kampagnen sind darauf ausgelegt, Ihre Marke sofort sichtbar zu machen. Durch präzises Targeting, Keyword-Optimierung und kontinuierliche Überwachung erreichen Ihre Anzeigen genau die richtigen Nutzer – ob für mehr Traffic, mehr Conversions oder mehr Verkäufe.",
        image: "/media/2024/09/Types-of-Google-Ads-3.webp",
      },
      {
        title: "Google-Unternehmensprofil Optimierung",
        text: "Ein gut optimiertes Google-Unternehmensprofil (ehemals Google My Business) ist entscheidend, um in den lokalen Suchergebnissen gefunden zu werden. Wir gestalten Ihr Profil vollständig und professionell und sorgen mit regelmässigen Aktualisierungen für Sichtbarkeit in der lokalen Suche.",
        image: "/media/2024/09/keywords-google-my-business.webp",
      },
      {
        title: "Google Analytics und Conversion Tracking",
        text: "Wir setzen Google Analytics und Conversion Tracking ein, um die Leistung Ihrer Kampagnen genau zu messen. So erhalten Sie Einblicke in das Verhalten Ihrer Website-Besucher und können Ihre Kampagnen datenbasiert optimieren.",
        image: "/media/2024/09/322.webp",
      },
    ],
    faq: [
      {
        q: "Was ist der Unterschied zwischen Google Ads und organischer Suche?",
        a: "Google Ads sind bezahlte Anzeigen, die oben in den Suchergebnissen erscheinen. Die organische Suche bezieht sich auf die nicht bezahlten Ergebnisse, die auf SEO basieren. Google Ads bieten sofortige Sichtbarkeit, SEO bringt langfristige Vorteile.",
      },
      {
        q: "Wie viel Budget sollte ich für Google Ads einplanen?",
        a: "Das Budget hängt von Ihren Zielen, der Branche und dem Wettbewerb ab. Wir legen gemeinsam mit Ihnen ein passendes Budget fest und optimieren Ihre Kampagnen laufend.",
      },
      {
        q: "Wie lange dauert es, bis ich Ergebnisse von Google Marketing sehe?",
        a: "Google Ads werden sofort nach der Aktivierung geschaltet. Bei der Optimierung des Unternehmensprofils und bei organischem SEO dauern Ergebnisse etwas länger, bieten jedoch langfristige Vorteile.",
      },
      {
        q: "Wie kann ich den Erfolg meiner Google-Marketing-Kampagnen messen?",
        a: "Mit Google Analytics und Conversion Tracking. Sie erhalten regelmässige Berichte mit Kennzahlen wie Klicks, Conversions, Kosten pro Klick und Return on Investment.",
      },
    ],
  },
  {
    slug: "graphic-design",
    name: "Graphic Design",
    short: "Einzigartige und visuell ansprechende Designs, die Ihre Marke zum Leben erwecken.",
    metaTitle: "Graphic Design, Logo-Design und Branding in Schaffhausen, Zürich",
    metaDescription:
      "Markenidentität und Logo-Design, Print-Design, digitale Medien, Werbekampagnen sowie Illustrationen und Infografiken von Madex IT Solutions.",
    eyebrow: "Marketing Solutions",
    heroTitle: "Graphic Design",
    image: "/media/brand/service-graphic-design.webp",
    icon: "design",
    introTitle: "Graphic Design bei Madex IT Solutions",
    intro:
      "Starkes und ansprechendes Design ist der Schlüssel zur erfolgreichen Markenkommunikation. Unser Graphic-Design-Service stärkt Ihre Marke visuell und vermittelt Ihre Botschaft klar und überzeugend. Von Logos und Corporate Designs bis zu Print- und digitalen Medien entwickeln wir kreative Lösungen, die auf Ihre Ziele zugeschnitten sind.",
    bullets: [
      "Markenidentität und Logo-Design",
      "Print-Design",
      "Digitale Medien und Webdesign",
      "Werbekampagnen und Branding",
      "Illustrationen und Infografiken",
    ],
    sections: [
      {
        title: "Markenidentität und Logo-Design",
        text: "Ein einprägsames Logo und eine konsistente Markenidentität sind essenziell, um Ihr Unternehmen auf dem Markt zu positionieren. Wir entwickeln gemeinsam mit Ihnen ein Logo und eine visuelle Identität, die die Werte und Persönlichkeit Ihrer Marke widerspiegeln.",
        image: "/media/brand/business-cover.webp",
      },
      {
        title: "Print-Design",
        text: "Ob Visitenkarten, Broschüren, Flyer oder Plakate – wir gestalten Drucksachen, die Ihre Marke repräsentieren und Ihre Botschaft klar kommunizieren. Jedes Design ist ästhetisch ansprechend und funktional.",
        image: "/media/2024/09/f32.webp",
      },
      {
        title: "Digitale Medien und Webdesign",
        text: "Wir entwickeln kreative Designs für Ihre Website, Social-Media-Kanäle und digitale Werbematerialien – ansprechende Benutzeroberflächen und Grafiken, die die Interaktion mit Ihrer Zielgruppe fördern.",
      },
      {
        title: "Werbekampagnen und Branding",
        text: "Wir unterstützen Sie bei der Entwicklung umfassender Werbekampagnen und Branding-Strategien, die Ihre Marke in allen Medienkanälen stark präsentieren – vom Konzept bis zur Umsetzung.",
        image: "/media/2024/09/2149119231.webp",
      },
      {
        title: "Illustrationen und Infografiken",
        text: "Wir erstellen massgeschneiderte Illustrationen und Infografiken, die komplexe Informationen einfach und visuell ansprechend darstellen – für Präsentationen, Websites oder Marketingmaterialien.",
        image: "/media/2024/09/132214.webp",
      },
    ],
    whyTitle: "Warum uns wählen?",
    why: [
      "Bei Madex IT Solutions setzen wir auf kreative Qualität und Kundenzufriedenheit. Ob neues Logo, komplette Neugestaltung Ihrer Marke oder kreative Werbematerialien – wir liefern massgeschneiderte Lösungen.",
      "Bereit, Ihre Marke visuell zu transformieren? Kontaktieren Sie uns, um Ihre Graphic-Design-Projekte mit Madex IT Solutions zu starten.",
    ],
    faq: [
      {
        q: "Wie läuft der Designprozess bei Madex IT Solutions ab?",
        a: "Der Designprozess beginnt mit einem ausführlichen Briefing zu Ihren Zielen, Wünschen und Ideen. Danach erstellen wir erste Entwürfe, die wir gemeinsam mit Ihnen besprechen und weiterentwickeln, bis das finale Design Ihren Erwartungen entspricht.",
      },
      {
        q: "Wie lange dauert es, ein Logo oder eine Markenidentität zu entwickeln?",
        a: "Ein einfaches Logo kann innerhalb weniger Wochen fertiggestellt werden, eine umfassende Markenidentität braucht mehr Zeit. Wir erstellen einen individuellen Zeitplan.",
      },
      {
        q: "Bieten Sie auch Druckdienstleistungen an?",
        a: "Wir arbeiten mit zuverlässigen Druckpartnern zusammen und können den gesamten Druckprozess für Sie koordinieren – von der Auswahl des Papiers bis zur Lieferung.",
      },
      {
        q: "Kann ich bestehende Designs überarbeiten lassen?",
        a: "Ja, wir bieten auch Überarbeitungs- und Redesign-Dienstleistungen an, um bestehende Designs auf den neuesten Stand zu bringen.",
      },
    ],
  },
  {
    slug: "analyse-und-planung",
    name: "Analyse und Planung",
    short: "Präzise Datenanalyse und strategische Planung für Ihren Geschäftserfolg.",
    metaTitle: "Marktanalyse und strategische Planung für Ihr Marketing",
    metaDescription:
      "Marktanalyse, strategische Planung und Beratung, Projektmanagement, Prozessoptimierung und datengetriebene Entscheidungen von Madex IT Solutions.",
    eyebrow: "Marketing Solutions",
    heroTitle: "Analyse und Planung",
    image: "/media/brand/service-analysis-planning.webp",
    icon: "analysis",
    introTitle: "Analyse und Planung bei Madex IT Solutions",
    intro:
      "Der Schlüssel zu jedem erfolgreichen Projekt liegt in einer gründlichen Analyse und sorgfältigen Planung. Durch eine tiefgehende Untersuchung Ihrer aktuellen Situation und eine strategische Planung der nächsten Schritte sorgen wir dafür, dass Ihre digitalen Projekte zielgerichtet und effizient umgesetzt werden.",
    bullets: [
      "Umfassende Marktanalyse",
      "Strategische Planung und Beratung",
      "Projektmanagement und Prozessoptimierung",
      "Datengetriebene Entscheidungsfindung",
    ],
    sections: [
      {
        title: "Umfassende Marktanalyse",
        text: "Eine fundierte Marktanalyse ist der erste Schritt, um den richtigen Weg für Ihr Unternehmen zu finden. Wir analysieren Ihre Branche, Ihre Mitbewerber und Ihre Zielgruppe, um Chancen zu identifizieren und Risiken zu minimieren.",
      },
      {
        title: "Strategische Planung und Beratung",
        text: "Mit den Erkenntnissen aus der Marktanalyse entwickeln wir eine massgeschneiderte Strategie – von der Zielsetzung über die Ressourcenzuweisung bis zur Zeitplanung. Dabei berücksichtigen wir mögliche Herausforderungen und erarbeiten Lösungen.",
      },
      {
        title: "Projektmanagement und Prozessoptimierung",
        text: "Ein Plan ist nur so gut wie seine Umsetzung. Wir koordinieren alle Schritte Ihres Projekts, überwachen den Fortschritt und sorgen dafür, dass Meilensteine termingerecht erreicht werden – effizient und ohne die Qualität aus den Augen zu verlieren.",
      },
      {
        title: "Datengetriebene Entscheidungsfindung",
        text: "Daten sind von unschätzbarem Wert. Wir nutzen datengestützte Analysen, um fundierte Entscheidungen zu treffen und Ihre Strategie kontinuierlich zu optimieren – anhand von Leistungskennzahlen und Markttrends.",
      },
    ],
    faq: [
      {
        q: "Warum ist eine Marktanalyse wichtig für mein Projekt?",
        a: "Eine Marktanalyse liefert wertvolle Einblicke in Ihre Branche, Ihre Mitbewerber und Ihre Zielgruppe. Diese Informationen helfen, Chancen zu erkennen und Risiken zu minimieren.",
      },
      {
        q: "Wie lange dauert der Analyse- und Planungsprozess?",
        a: "Das hängt von der Komplexität des Projekts ab. In der Regel dauert dieser Prozess einige Wochen. Wir erstellen einen individuellen Zeitplan.",
      },
      {
        q: "Wie oft sollten Projekte während der Umsetzung überprüft werden?",
        a: "Wir empfehlen monatliche oder sogar wöchentliche Reviews, abhängig von Projektdauer und -komplexität. So kann schnell auf Änderungen reagiert werden.",
      },
      {
        q: "Was ist der Unterschied zwischen strategischer Planung und Projektmanagement?",
        a: "Strategische Planung legt den langfristigen Fahrplan fest, einschliesslich Zielsetzung und Ressourcen. Projektmanagement konzentriert sich auf die operative Umsetzung: Koordination, Fortschrittskontrolle und Termine.",
      },
    ],
  },
];

export function getService(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}
