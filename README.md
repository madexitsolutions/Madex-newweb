# Madex IT Solutions – neue Website

Interaktiver Neuaufbau von [madex-it.ch](https://madex-it.ch/) mit Next.js 15, TypeScript, React Three Fiber (Three.js), Framer Motion und Lenis. Alle Inhalte, Seiten und das Menü der bisherigen Website wurden übernommen – komplett auf Deutsch (Schweiz).

## Schnellstart

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm run test
npm run build && npm run start
```

Node.js ≥ 20.9. Für Coolify reichen `npm install`, `npm run build` und `npm run start` (Port über `PORT`, Standard 3000). Kein Dockerfile nötig.

## Umgebungsvariablen

Siehe `.env.example`. Das Kontakt-/Terminformular (`/api/kontakt`) versendet per SMTP:

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Basis-URL für Canonicals, Sitemap, Open Graph |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Mailserver |
| `CONTACT_TO_EMAIL` | Empfänger der Anfragen (z. B. info@madex-it.ch) |
| `CONTACT_FROM_EMAIL` | Absenderadresse |

Ohne SMTP-Konfiguration zeigt das Formular eine freundliche Fehlermeldung mit Telefon und E-Mail; eingegebene Daten bleiben erhalten. Validierung (Zod) läuft im Browser und auf dem Server, dazu Honeypot und Rate Limiting.

## Seitenstruktur (wie madex-it.ch)

- **Marketing Lösungen** – `/marketing-solutions` + 8 Leistungsseiten (`/marketing-solutions/website-development`, `digital-marketing`, `seo-optimierung`, `photo-werbevideos`, `social-media-marketing`, `google-marketing`, `graphic-design`, `analyse-und-planung`)
- **Wer wir sind** – `/uber-uns`, `/das-team`, `/blog`, `/karriere`
- **Portfolio** – `/portfolio`, `/website-portfolio` (74 Projekte, 3D-Projektring, Suche & Jahresfilter), `/graphic-design-portfolio` (Brandings, Print, Social Media mit Lightbox), `/werbevideos-portfolio`
- **Partner** – `/partners`
- **Kontakt** – `/kontakt`, `/kostenlose-prufung`
- Projekt- und Blogbeiträge unter ihren bisherigen URLs (`/<slug>`), dazu `/agb`, `/datenschutz`, `sitemap.xml`, `robots.txt`, 404-Seite

Die bisherigen URLs bleiben gültig; geänderte oder entfernte URLs werden per 308 weitergeleitet. Vollständige Zuordnung aller 109 archivierten URLs: [`docs/migration.md`](docs/migration.md).

## 3D & Interaktion

- Hero: extrudierte, glänzende Doppel-M-Bildmarke (abstrahiert aus dem Logo), reagiert auf Maus und Scrollen, Partikel, Lichtringe
- Unterseiten: Shader-Hintergrund (Petrol/Türkis-Strömung, Perspektivraster, Maus-Licht) mit schwebender Marke
- „Was wir tun“: 3D-Konstellation der acht Leistungen, synchron mit der HTML-Liste
- Website-Portfolio: drehbarer 3D-Ring mit Projekt-Mockups (ziehen/klicken)
- Seitenübergänge mit Vorhang, Preloader beim ersten Besuch, Smooth Scrolling, Magnet-Buttons, 3D-Tilt-Karten, Text-Reveals, horizontales Projekt-Scrolling, eigener Cursor, Orion-Assistent
- Three.js wird nur bei Bedarf nachgeladen, pausiert ausserhalb des Sichtbereichs; bei `prefers-reduced-motion`, fehlendem WebGL oder schwachen Geräten gibt es statische Fallbacks

## Inhalte & Medien aktualisieren

- Geschäftsdaten, Menü, Pakete, FAQ, Team: `src/content/site.ts`
- Leistungen: `src/content/services.ts`
- Projekte/Blog, Portfolios, Partner, AGB: generiert aus dem Archiv nach `src/content/generated/` mit `python3 -I scripts/extract_content.py`
- Optimierte Bilder/Videos (WebP/MP4) in `public/media/` – erzeugt mit `python3 -I scripts/prepare_media.py` (Pillow + ffmpeg). Die Originale in `assets/` bleiben unverändert.

## Vor dem Go-live prüfen

- Angebotsangaben (CHF 250/Monat, Website im Wert von CHF 8’000, Laufzeiten) sowie „100+ Kunden“, „Antwort innerhalb 24h“ und „35+ Kundenrezensionen“ wurden wie auf der bisherigen Website übernommen – bitte auf Aktualität prüfen.
- Teamliste und offene Stelle aktualisieren (`src/content/site.ts`, `src/app/karriere/page.tsx`).
- Die Datenschutzerklärung beschreibt das Verhalten der neuen Website (keine Tracking-Cookies, YouTube erst nach Klick); bei Einführung von Analytics ergänzen.

---

# Research & Asset Kit

Erstellt am 14. Oktober 2026. Dieses Paket bereitet den bestehenden öffentlichen Webauftritt von Madex IT Solutions für einen professionellen Neuaufbau mit Next.js, TypeScript und einer gezielten Three.js-Ebene vor. Es baut die Website noch nicht.

## Inhalt des Pakets

- Verifizierte Kontakt-, Rechts- und Leistungsdaten
- Acht belegte Servicebereiche mit strukturierten Unterleistungen
- Aktueller, ausdrücklich als zeitkritisch markierter Angebots-Snapshot
- Markenfarben und Typografievariablen aus Logo und Live-Stylesheet
- 32 kuratierte, sofort einsetzbare Original-Assets ohne Hochskalierung oder inhaltliche Bearbeitung
- Vollständiger lokaler Medien-Mirror mit 3.142 erreichbaren Dateien aus Seiten, Beiträgen, `srcset`-Varianten und Elementor-Hintergründen
- Zwölf aktuelle Portfolio-Visuals und sechs öffentliche Team-Porträts
- Vollständiges Offline-Archiv von 109 öffentlichen URLs: 24 Seiten, 78 Beitrags-URLs, 2 Kategorien und 5 Tags
- Vollständige Sitemap-Inventur plus HTML-/CSS-Crawl mit 3.146 gefundenen Medien-URLs; 3.142 erfolgreich gespeichert und 4 auf der Live-Seite bereits nicht mehr erreichbar
- Deutsche Copy-Grundlage für Homepage, Services, About, Projekte, Kontakt und FAQ
- Eigener Leitfaden für eine barrierearme, performante Three.js-Umsetzung
- Vollständiger Build-Prompt für den nächsten Coding-Agenten

## Ordnerstruktur

```text
business-website-kit/
├── archive/
│   ├── pages/                      # 109 vollständige HTML-Snapshots
│   ├── sitemaps/                   # alle vier Child-Sitemaps plus Index
│   └── robots.txt                  # robots.txt-Snapshot
├── assets/
│   ├── all/                        # vollständiger Mirror von 3.142 Medien
│   └── [kuratierte Dateien]        # 32 sofort einsetzbare Kern-Assets
├── data/
│   ├── business.json               # strukturierte, konservative Geschäftsdaten
│   ├── media-inventory.json         # URL, lokaler Pfad, Hash, Status je Medium
│   ├── page-archive.json            # URL-zu-HTML-Datei-Manifest
│   ├── site-content.json            # vollständige WordPress-Inhalte für 100 Seiten/Beiträge
│   └── site-inventory.json          # komplette URL-/Sitemap-Inventur
├── research/
│   ├── business-profile.md         # Unternehmensprofil und Bestätigungsbedarf
│   ├── content-notes.md            # deutsche Website-Copy und FAQ-Grundlage
│   ├── sources.md                  # Quellen- und Assetnachweis
│   └── threejs-direction.md        # 3D-Konzept und technische Leitplanken
├── scripts/
│   └── capture-site.ps1             # reproduzierbarer Voll-Crawl
├── README.md
└── website-build-prompt.md         # ausführbarer Auftrag für den Coding-Agenten
```

## Verifizierter Kern

- Marke: Madex IT Solutions
- Rechtlicher Name: Madex IT Solutions GmbH
- UID: CHE-412.695.793
- Sitz: Buchenstrasse 36, 8212 Neuhausen am Rheinfall, Schweiz
- Kontakt: +41 52 589 67 59, +41 76 507 33 32, info@madex-it.ch
- Hauptleistungen: Webdesign, Digital Marketing, SEO, Foto/Werbevideo, Social Media Marketing, Google Marketing, Graphic Design sowie Analyse und Planung
- Logo-Farben: `#025159` und `#028D86`
- Öffentliches Zielsegment: Schweizer KMU, Start-ups und Unternehmen; regional werden insbesondere Schaffhausen, Zürich, Thurgau, Winterthur und die Ostschweiz genannt

Details und Quellen stehen in `data/business.json` und `research/sources.md`.

## Vor Veröffentlichung zu bestätigen

- Preis, Laufzeit, Kündigungsfrist und genaue Inklusivleistungen des aktuellen Angebots
- Aktuelle Teamliste, Rollen und Bildfreigaben
- Öffnungszeiten und Regeln für die Terminbuchung
- Bewertungsplattform, aktueller Score und Anzahl Reviews; der Bestand zeigt widersprüchlich 4,3 und 4,4
- Nachweise und Freigabe für „100+ Kunden“, „Antwort innerhalb 24h“ und „72.000“
- Weiterführung aller acht Leistungen, des Karrierebereichs und der aktuellen Stelle
- Datenschutztext, Formularzweck, Aufbewahrung, Mailanbieter und Tracking-Einwilligung
- Freigabe der Kundenprojektbilder für die neue Website

## Verwendung durch den Coding-Agenten

1. `website-build-prompt.md` vollständig lesen und als verbindliche Build-Spezifikation verwenden.
2. `data/business.json` als einzige strukturierte Quelle für Fakten, Services, Kontaktdaten und kuratierte Assetpfade verwenden.
3. Für vollständige Bestandsinhalte `data/site-content.json`, `data/page-archive.json` und `archive/pages/` durchsuchen.
4. Für jedes weitere Bild `data/media-inventory.json` verwenden; dort ist die Remote-URL einem exakten lokalen Pfad unter `assets/all/` zugeordnet.
5. `research/content-notes.md` als deutsche Copy-Grundlage nutzen; keine neuen Erfolgs-, Preis- oder Unternehmensbehauptungen ergänzen.
6. `research/sources.md` für jede strittige Information und jede Bildherkunft prüfen.
7. `research/threejs-direction.md` für Szenenkonzept, Fallbacks, Bewegung und Performancebudgets verwenden.
8. Originale in `assets/` unverändert lassen. Im Webprojekt optimierte Ableitungen erzeugen und mit sinnvollen Alt-Texten versehen.
9. Unsichere Inhalte entweder weglassen, als administrativ pflegbare Entwürfe kennzeichnen oder mit `TODO_OWNER_CONFIRMATION` markieren.

## Qualitätskontrolle

- Alle 32 kuratierten Assets wurden erfolgreich geladen und auf Dateigrösse sowie Bilddimensionen geprüft.
- SHA-256-Vergleich ergab keine Duplikate im kuratierten Ordner.
- 109 von 109 öffentlichen URLs wurden als HTML gespeichert; keine Seiten-Downloads sind fehlgeschlagen.
- 3.142 von 3.146 gefundenen Medien-URLs wurden gespeichert. Die vier Fehler sind echte 404-Antworten der Live-Seite und in `data/media-inventory.json` dokumentiert.
- Der vollständige Medien-Mirror umfasst rund 1,23 GB: 1.780 PNG-, 1.348 JPG-, 8 SVG-, 3 GIF- und 3 MP4-Dateien. Einige Uploads werden vom Server trotz JPG-/PNG-Endung als WebP ausgeliefert; sie wurden bytegenau so archiviert.
- Alle acht Servicebilder liegen als 1200 × 1200 Pixel vor.
- Logo-Farben wurden direkt aus der PNG-Datei gelesen; sie entsprechen auch den globalen CSS-Variablen der Live-Seite.
- Keine Datei wurde hochskaliert, verzerrt oder visuell verändert.
- `data/business.json` muss vor Weitergabe als valides JSON geprüft werden.
- Der Build-Agent muss Linting, TypeScript-Prüfung, Tests und Produktionsbuild erfolgreich ausführen.

## Recherche- und Zugriffsgrenzen

- Grundlage waren alle öffentlich erreichbaren URLs aus vier Sitemaps, zusätzliche öffentliche WordPress-REST-Einträge, der gerenderte HTML-Inhalt, zugehörige Elementor-Stylesheets sowie öffentliche Suchtreffer.
- Private Social-Media-Metriken, Analytics, Kampagnendaten, Verträge und interne Projektinformationen waren nicht zugänglich.
- `data/site-inventory.json` und `data/media-inventory.json` sind Fundstellen-Inventare, keine pauschalen Lizenz- oder Freigabeerklärungen.
- Kundenprojekte und Team-Porträts sind öffentlich eingebunden, sollten aber vom Inhaber für den neuen Auftritt bestätigt werden.
- Zwei neuere Projektbeiträge haben offensichtlich kopierte Slugs. Die Zuordnung wurde deshalb in `research/sources.md` transparent festgehalten.

