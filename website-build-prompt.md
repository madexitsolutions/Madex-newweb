# Build-Prompt: Neuer 3D-Webauftritt für Madex IT Solutions

Du bist der verantwortliche Senior-Webentwickler und Interaction Designer. Erstelle aus diesem Research- und Asset-Kit eine produktionsreife, mehrseitige Website für **Madex IT Solutions GmbH**. Die sichtbare Website-Sprache ist durchgehend **Deutsch (Schweiz, `de-CH`)**. Nutze Schweizer Rechtschreibung mit `ss` und formuliere professionell, direkt und nachvollziehbar.

## 1. Verbindliche Quellen

Lies vor der Implementierung jede der folgenden Dateien vollständig:

- `README.md` – Umfang, Arbeitsweise, Bestätigungsbedarf und Grenzen
- `data/business.json` – einzige strukturierte Quelle für Geschäftsdaten, Services, Kontaktdaten, Social Links und Statusangaben
- `data/site-inventory.json` – vollständige öffentliche URL-/Sitemap-Inventur mit 109 archivierten URLs
- `data/page-archive.json` – Manifest aller lokal gespeicherten HTML-Seiten
- `data/site-content.json` – vollständiger WordPress-Inhalt von 100 Seiten und Beiträgen
- `data/media-inventory.json` – Manifest aller 3.146 gefundenen Medien-URLs, 3.142 lokalen Dateien, Hashes und vier nicht erreichbaren Quellen
- `research/business-profile.md` – verifizierte Fakten, Positionierung und offene Punkte
- `research/content-notes.md` – freigegebene deutsche Copy-Grundlage und vorsichtige FAQ-Antworten
- `research/sources.md` – Fakten- und Assetnachweis samt Konflikten
- `research/threejs-direction.md` – räumliches Konzept, Fallbacks und Performanceleitplanken
- `archive/pages/` – 109 vollständige HTML-Snapshots als Referenz für alle bestehenden Seiten, Projekte, Team- und Arbeitsinhalte
- `archive/sitemaps/` – lokale Kopien des Sitemap-Index und aller vier Child-Sitemaps
- `archive/robots.txt` – Snapshot der bestehenden Robots-Regeln
- `assets/all/` – vollständiger lokaler Mirror aller erreichbaren Medien in der ursprünglichen WordPress-Pfadstruktur
- `scripts/capture-site.ps1` – reproduzierbarer Crawler; nur für eine bewusst aktualisierte Momentaufnahme erneut ausführen
- `website-build-prompt.md` – diese Build-Spezifikation

Erfinde keine Geschäftsdaten. Wenn Angaben fehlen oder als zeitkritisch/unbestätigt markiert sind, lasse sie weg oder verwende intern `TODO_OWNER_CONFIRMATION`. Zeige niemals diesen internen Marker auf der Produktionsseite.

## 2. Lokale Assets und verbindliche Zuordnung

Verwende ausschliesslich passende lokale Assets aus dem Kit; keine zufälligen Stockfotos und keine generierten Kundenprojekte. Verändere keine Personenbilder inhaltlich. Bewahre die Originale und erzeuge für die Website optimierte WebP-/AVIF-Ableitungen.

Der Ordner `assets/all/` enthält den vollständigen Bestand samt WordPress-Responsive-Varianten. Verwende `data/media-inventory.json`, um Remote-URL, lokalen Pfad, Status und Hash nachzuschlagen. Kopiere nicht blind alle Varianten in das fertige Build: Wähle pro Inhalt die grösste geeignete Quelldatei, generiere optimierte Varianten im neuen Projekt und bewahre die vollständige Quelle separat. Vier im Manifest als `failed` markierte URLs sind echte Live-404s und dürfen nicht als vorhanden behandelt werden.

### Marke

- `assets/business-logo.png` – aktuelles Hauptlogo für Header, Footer und Markenreferenz
- `assets/business-favicon.png` – Quelle für Favicon und App Icons
- `assets/business-cover.jpg` – primäres About-/Hero-Fallback
- `assets/brand-team-banner.jpg` – breites Studio-/Team-Motiv
- `assets/brand-mascot.png` – dekorative 3D-/VR-Markenfigur; nie als reales Teammitglied darstellen
- `assets/brand-lightbulb.png` – dekoratives Innovationsmotiv

### Services

- `assets/service-website-development.jpg` – Webdesign & Website-Erstellung
- `assets/service-digital-marketing.jpg` – Digital Marketing
- `assets/service-seo-optimization.jpg` – SEO-Optimierung
- `assets/service-photo-advertising-video.jpg` – Foto & Werbevideos
- `assets/service-social-media-marketing.jpg` – Social Media Marketing
- `assets/service-google-marketing.jpg` – Google Marketing
- `assets/service-graphic-design.jpg` – Graphic Design
- `assets/service-analysis-planning.jpg` – Analyse und Planung

### Team

- `assets/team-marco-bram.jpg` – Marco Bräm
- `assets/team-adem-mehmeti.jpg` – Adem Mehmeti
- `assets/team-gazmend-gjerqeku.jpg` – Gazmend Gjerqeku
- `assets/team-sebastian-stein.png` – Sebastian Stein
- `assets/team-ariane-schmitz.jpg` – Ariane Schmitz
- `assets/team-laura-stein.jpg` – Laura Stein

Teamdaten sind zeitkritisch. Baue sie datengetrieben, damit sie leicht aktualisiert oder bis zur Inhaberfreigabe ausgeblendet werden können.

### Portfolio

- `assets/project-01-auto-pozzo.png` – Auto Pozzo
- `assets/project-02-tkc-ag.png` – TKC AG
- `assets/project-03-mehoma.png` – MEHOMA
- `assets/project-04-serrano-reinigung.png` – Serrano Reinigung
- `assets/project-05-mila-dopiz.png` – Mila d’Opiz
- `assets/project-06-carrosserie-stocker.png` – Carrosserie Stocker AG
- `assets/project-07-baur-ag.png` – Baur AG
- `assets/project-08-garage-schneider.png` – Garage T. Schneider
- `assets/project-09-natura-balance.png` – Natura Balance Schweiz
- `assets/project-10-klimas-innenausbau.png` – Klimas Innenausbau
- `assets/project-11-polyprojekt.gif` – Polyprojekt GmbH, animierte Vorschau
- `assets/project-12-sun-foiltec.png` – Sun Foiltec GmbH

Verwende nur die sachlichen Projektbeschreibungen aus `research/content-notes.md`. Keine erfundenen Ergebnisse, Projektdauern, Technologien oder Kundenzitate.

## 3. Designsystem

Die primären Markenfarben sind verbindlich und stammen aus dem aktuellen Logo:

- Dunkles Petrol: `#025159`
- Türkis: `#028D86`

Aktuelle unterstützende Websitefarben: `#F7F7FA`, `#000000B3`, `#FFFFFF`, `#000000`, `#E2E2E2`; `#FFBE11` nur sparsam als kleiner Akzent. Überschriften dürfen sich an **Syne**, Fliesstext an **Kanit** orientieren. Binde Fonts performant und datenschutzbewusst lokal ein, sofern die Lizenz dies erlaubt; ansonsten verwende passende System-Fallbacks.

Die Gestaltung soll hochwertig, eigenständig und technisch wirken: grosszügige Typografie, klare Informationshierarchie, ruhige helle Flächen, präzise dunkle Abschnitte, abgerundete Karten und subtile räumliche Tiefe. Die Marke darf modernisiert, aber nicht in eine andere Farbwelt umgedeutet werden.

## 4. Three.js-Erlebnis

Implementiere eine geschmackvolle Three.js-Erweiterung mit React Three Fiber. Sie soll eine echte räumliche Markenidee vermitteln und darf Inhalt, Barrierefreiheit oder Ladezeit nicht beeinträchtigen.

- Hero: abstrakte extrudierte Doppel-M-/Aufwärtsform in `#025159` und `#028D86`, sanftes Licht und minimale Pointer-Parallaxe.
- Wortmarke nicht frei nachzeichnen. Nutze `assets/business-logo.png` als verifizierte Markenreferenz oder Textur.
- Optional: acht ruhige Service-Knoten als räumliche Konstellation; Auswahl muss immer mit semantischem HTML gespiegelt sein.
- Optional: Portfolio als räumliche Kartenebene; zusätzlich vollständiges HTML-Raster bereitstellen.
- Dynamischer Client-Import, begrenzte DPR, adaptive Qualität, Lazy Loading, Pausieren ausserhalb des Viewports.
- Bei `prefers-reduced-motion`, fehlendem WebGL oder schwachen Geräten: statisches, visuell gleichwertiges Erlebnis mit `assets/business-cover.jpg`.
- Keine Scroll-Sperre, keine Canvas-only-Navigation, keine langen Intro-Sequenzen und kein Audio-Autoplay.

## 5. Informationsarchitektur

Erstelle mindestens folgende Routen:

- `/` – Homepage
- `/leistungen` – Übersicht aller acht Services
- `/leistungen/webdesign-website-erstellung`
- `/leistungen/digital-marketing`
- `/leistungen/seo-optimierung`
- `/leistungen/foto-werbevideos`
- `/leistungen/social-media-marketing`
- `/leistungen/google-marketing`
- `/leistungen/graphic-design`
- `/leistungen/analyse-und-planung`
- `/projekte` – Portfolio/Galerie
- `/projekte/[slug]` – datengetriebene Detailseite für jeden bestätigten öffentlichen Projektbeitrag aus `data/site-content.json`
- `/blog` – Übersicht der redaktionellen Beiträge
- `/blog/[slug]` – Detailseiten für die öffentlich vorhandenen Fachartikel
- `/ueber-uns` – Unternehmen, Werte und optional freigegebene Teamsektion
- `/team` – alle bestätigten öffentlichen Teamrollen und Porträts
- `/partner` – vorhandene Partnerseite nur mit geprüften aktuellen Logos/Beziehungen
- `/graphic-design-portfolio` – vorhandene Grafikarbeiten, sofern freigegeben
- `/werbevideos-portfolio` – vorhandene Videoarbeiten, sofern freigegeben
- `/kostenlose-pruefung` – bestehender Analyse-/Lead-Flow, sofern das Angebot bestätigt ist
- `/kontakt` – Kontaktdaten, Karte als datenschutzfreundlicher Link und Terminformular
- `/karriere` – nur mit bestätigten aktuellen Stellen; sonst allgemeine Kontaktmöglichkeit oder Route nicht indexieren
- `/agb` – bestehende AGB nur nach Prüfung migrieren; Rechtsstand sichtbar machen
- `/datenschutz` – datenschutzgerechte, projektspezifische Erklärung; keine erfundenen Verantwortlichen oder Tools
- benutzerdefinierte `not-found`/404-Seite

Führe vor der Umsetzung eine Migrationsmatrix aus `data/site-inventory.json` und `data/site-content.json`: Jede der 109 archivierten URLs muss entweder (a) eine neue kanonische Zielroute, (b) eine permanente Weiterleitung oder (c) einen dokumentierten, vom Inhaber bestätigten Ausschluss erhalten. Erhalte alle freigegebenen Projekt-/Arbeitsbeiträge; fasse keine unterschiedlichen Projekte stillschweigend zusammen. Die öffentliche REST-Seite `mi-dashboard` sowie Beiträge mit kopierten oder fehlerhaften Slugs dürfen nicht ungeprüft indexiert werden.

Homepage-Struktur:

1. 3D-Hero mit Headline, kurzer Subline und CTAs
2. Vertrauens-/Positionierungsblock ohne ungeprüfte Zahlen
3. Acht Services
4. Arbeitsweise von Analyse über Umsetzung bis Betreuung
5. Ausgewählte Projekte
6. About-/Team-Teaser
7. Zeitkritisches Angebot nur bei gesetztem, bestätigtem Content-Flag
8. FAQ
9. Abschluss-CTA und Kontakt

## 6. Inhalte und Wahrheitsregeln

- Nutze die Formulierungen und Fakten aus `research/content-notes.md`.
- Behandle Angaben in `data/business.json` mit Status `time_sensitive_owner_confirmation_required`, `selfAssertedDifferentiators` oder `unverifiedMarketingClaims` nicht als automatisch freigegeben.
- Preise, Laufzeiten und Paketbestandteile nie ausweiten oder umformulieren, als wären sie dauerhaft garantiert.
- Bewertungswert nicht anzeigen, solange Plattform, aktueller Score und Review-Anzahl nicht bestätigt sind.
- „100+ Kunden“, „Antwort innerhalb 24h“, „72.000“, Umsatz-/Rankingversprechen und Superlative standardmässig nicht veröffentlichen.
- Keine Zertifikate, Partnerschaften, Garantien, Mitarbeiterzahlen, Projektzahlen oder Reaktionszeiten erfinden.
- Öffnungszeiten nicht erfinden.
- Die Sprache bleibt durchgehend Deutsch; Servicebegriffe dürfen ihre öffentlich verwendeten englischen Namen behalten.

## 7. Termin- und Kontaktformular

Baue ein professionelles Formular mit klarer CTA **„Kostenloses Erstgespräch buchen“**. Felder:

- Name (Pflicht)
- Unternehmen
- E-Mail (Pflicht)
- Telefonnummer
- Interessierte Leistung
- Projektbeschreibung (Pflicht)
- bevorzugtes Datum und Zeitfenster als Wunsch, nicht als bestätigter Termin
- Datenschutz-Einwilligung (Pflicht)

Anforderungen:

- Serverseitige Validierung mit gemeinsamer Schemaquelle, z. B. Zod
- zugängliche Labels, Fehlertexte und Erfolgsmeldung
- Honeypot und Rate Limiting; optional CAPTCHA nur datenschutzbewusst
- keine Secrets im Browser
- Versand über Umgebungsvariablen, z. B. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`; alternativ ein dokumentierter Mailprovider mit entsprechenden Variablen
- klarer Fehlerpfad ohne Verlust der eingegebenen Daten
- kein Kalender-Versprechen, solange keine bestätigte Verfügbarkeitslogik vorhanden ist

## 8. Technischer Stack

- Node.js und npm
- Next.js mit App Router
- TypeScript mit strikter Konfiguration
- React Three Fiber/Three.js für die gezielte 3D-Ebene
- CSS Modules, Tailwind CSS oder ein vergleichbar wartbares System
- Inhalte aus typisierten lokalen Datenstrukturen ableiten; Geschäftsdaten nicht über Komponenten verstreuen
- Next/Image oder gleichwertige Optimierung für Rasterbilder
- Keine Abhängigkeit von einem WordPress-Runtime-Backend, sofern nicht ausdrücklich später beauftragt

Stelle mindestens folgende Scripts bereit:

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run start`

Die Produktion muss in Coolify mit `npm install`, `npm run build` und `npm run start` funktionieren. Kein eigener Dockerfile ist erforderlich und soll nicht erstellt werden.

## 9. SEO, Metadaten und Struktur

- Eindeutige deutsche Titles und Descriptions pro Route
- Canonicals, Open Graph, Twitter Cards und lokales Social-Share-Bild
- strukturierte Daten für `Organization` beziehungsweise `ProfessionalService` nur mit verifizierten Fakten
- Breadcrumbs auf Service- und Projektseiten
- `sitemap.xml` und `robots.txt`
- saubere interne Verlinkung und sprechende URLs
- `lang="de-CH"`
- Kontaktinformationen konsistent und klickbar (`tel:`, `mailto:`)
- Keine Review-/AggregateRating-Strukturdaten ohne bestätigte Plattform, Wert und Anzahl

## 10. Barrierefreiheit und Performance

- Semantisches HTML, Skip-Link, vollständige Tastaturbedienung und sichtbare Fokuszustände
- WCAG-2.2-AA-orientierte Kontraste und Formulare
- Aussagekräftige Alt-Texte; dekorative Bilder mit leerem Alt-Text
- `prefers-reduced-motion` vollständig respektieren
- Canvas mit zugänglichem Fallback und ohne zentrale Information
- Bilder lazy laden; Hero sinnvoll priorisieren
- 3D-Texturen komprimieren, Partikel und Postprocessing begrenzen
- Layout Shift vermeiden und responsive Breakpoints visuell testen
- Zielwerte: guter Lighthouse- und Core-Web-Vitals-Status auf realistischen Mobilgeräten

## 11. Qualitätssicherung

Vor Abschluss:

1. Alle in diesem Prompt genannten Dateien auf Existenz prüfen.
2. Keine entfernten Hotlinks für ausgelieferte Assets verwenden.
3. Alle Links, Formulare und Navigationszustände testen.
4. Responsive QA für kleine Mobilgeräte, Tablet, Laptop und grossen Desktop durchführen.
5. Tastatur-, Reduced-Motion- und No-WebGL-Fallback testen.
6. `npm run lint`, `npm run typecheck`, `npm run test` und `npm run build` erfolgreich ausführen.
7. Keine TypeScript-Fehler, defekten Routen oder Console Errors hinterlassen.
8. Prüfen, dass keine unbestätigten Preise, Reviews, Versprechen oder Teamangaben versehentlich veröffentlicht werden.
9. `.env.example` ohne Secrets und eine klare Deployment-Dokumentation ergänzen.

## 12. Akzeptanzkriterium

Das Ergebnis ist eine schnelle, responsive, barrierearme, SEO-fertige und visuell markentypische Mehrseiten-Website, deren 3D-Erlebnis Madex erkennbar macht, ohne die Geschäftsinformation zu überlagern. Alle Fakten sind auf das Kit zurückführbar, alle produktiven Assets liegen lokal vor, der Termin-Flow ist sicher vorbereitet und der Produktionsbuild läuft mit den standardmässigen npm-Befehlen für Coolify.

