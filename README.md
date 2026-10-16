# Madex IT Solutions – neue Website

Interaktiver Neuaufbau von [madex-it.ch](https://madex-it.ch/) mit Next.js 16, React 19, TypeScript, React Three Fiber (Three.js), Framer Motion und Lenis. Alle Inhalte, Seiten und das Menü der bisherigen Website wurden übernommen – komplett auf Deutsch (Schweiz).

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

Alle Variablen mit Erklärung stehen in `.env.example` (Admin-Zugang, Datenablage, SMTP, OpenAI, Google Analytics/Tag Manager, GA4-Berichte, Google-Bewertungen). Mindestens nötig für den Betrieb:

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Basis-URL für Canonicals, Sitemap, Open Graph, Links in E-Mails |
| `DATABASE_URL`, `APP_SECRET`, `APP_URL` | Neues Dashboard `/admin` (PostgreSQL, Verschlüsselung, öffentliche Adresse) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Altes Dashboard `/admin-alt` |
| `DATA_DIR`, `DATA_ENCRYPTION_KEY` | Ablage und Verschlüsselung von Anfragen, Chats, Einstellungen |
| `SMTP_*`, `MAIL_FROM`, `CONTACT_TO_EMAIL` | E-Mail-Benachrichtigung bei neuen Anfragen |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | KI-Chatbot «Orion» |
| `NEXT_PUBLIC_GA4_ID` / `NEXT_PUBLIC_GTM_ID` | Tracking (alternativ im Admin eintragen) |
| `GA4_PROPERTY_ID`, `GOOGLE_SERVICE_ACCOUNT_*` | Analytics-Berichte im Admin |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID` | Live-Google-Bewertungen (nur 4–5 Sterne), sonst hinterlegte Kundenstimmen |

### Coolify

1. Build: `npm install`, `npm run build`, Start: `npm run start`.
2. **Persistenten Speicher anlegen** (Storages → Volume) z. B. auf `/app/.data` und `DATA_DIR=/app/.data` setzen. Ohne Volume gehen Anfragen, Chats und Einstellungen bei jedem Deploy verloren.
3. `DATA_ENCRYPTION_KEY` einmal erzeugen (`openssl rand -base64 32`) und nie mehr ändern – sonst sind bestehende Daten nicht mehr lesbar.

## Neues Dashboard (`/admin`)

Die Website enthält das wiederverwendbare Dashboard aus der Vorlage `madexitsolutions/predashboard` (Shop, Beiträge,
Mediathek, SEO, Anfragen, Statistiken, Benutzer und Rollen). Beim ersten Aufruf von `/admin` wird das Inhaber-Konto
angelegt. Es braucht zusätzlich `DATABASE_URL`, `APP_SECRET` und `APP_URL` (siehe `.env.example`); lokal genügt `npm run dev`
(eingebettete Datenbank). Der Kern liegt in `src/app/admin`, `src/server`, `src/components/admin`, `src/modules`,
`src/app/api/{v1,payments,cron}`, `src/app/uploads` und `tests/dashboard` – Änderungen daran zuerst in der Vorlage machen.

## Altes Admin-Dashboard (`/admin-alt`)

Bleibt erreichbar, bis das neue Dashboard die Funktionen übernommen hat (vor allem Chatbot Orion und Chat-Verläufe).

Anmeldung mit Benutzername/Passwort aus der `.env` und verpflichtender Zwei-Faktor-Anmeldung (Authenticator-App, QR-Code beim ersten Login, 8 Wiederherstellungscodes). Sperre nach Fehlversuchen, automatische Abmeldung nach Inaktivität, Protokoll aller Anmeldungen.

- **Übersicht** – neue Anfragen, Chats, Einrichtungsstatus (SMTP, OpenAI, Analytics)
- **Anfragen** – alle Formulare (Kontakt, kostenlose Analyse, Hero-Formular) und Terminanfragen aus dem Chat; Status, Notizen, Verlauf, E-Mail erneut senden, CSV-Export
- **Chat-Verläufe** – Gespräche mit Orion (pseudonym), Löschung nach Aufbewahrungsfrist
- **SEO** – Titel, Beschreibung, Vorschaubild und noindex pro Seite mit Google-Vorschau; wirkt sofort, auch auf die Sitemap
- **Google Analytics** – Mess-ID/Tag-Manager-ID, Zustimmungs-Banner, Berichte der letzten 28 Tage
- **Chatbot & Wissen** – Name, Begrüssung, Hinweis-Blase, Modell, Firmenprofil, Wissensdatenbank, Verbindungstest
- **Pakete** – Pakete für den Paket-Finder im Chat
- **Sicherheit** – Limits, Spam-Schutz, IP-Sperren, Ereignisprotokoll
- **Konto** – 2FA zurücksetzen, Sitzungen beenden, Protokoll

## KI-Chatbot «Orion»

Das Chat-Fenster ist 1:1 das des bisherigen WordPress-Plugins (`madex-chatbot-main (14).zip`): Original-Skript, -Stylesheet, -Schrift und -Icons liegen unverändert in `public/chatbot/` und laufen in einem Shadow DOM. Neu ist nur der Server-Teil `/api/chat/ajax`, der das admin-ajax-Protokoll des Plugins spricht. Funktionen: Startansicht (Neu-/Bestandskunde), freie Fragen über OpenAI mit Firmenprofil und Wissensdatenbank (antwortet nur mit bestätigten Informationen, sonst Weiterleitung ans Team), Paket-Finder mit drei Fragen, Termin-/Analyse-/Support-Anfrage mit Prüfschritt und Referenznummer, frühere Gespräche im Browser, Kontakt-Buttons, Rate Limits und Spam-Schutz. 

## Seitenstruktur (wie madex-it.ch)

- **Marketing Lösungen** – `/marketing-solutions` + 9 Leistungsseiten (`/marketing-solutions/website-development`, `digital-marketing`, `seo-optimierung`, `photo-werbevideos`, `social-media-marketing`, `google-marketing`, `graphic-design`, `analyse-und-planung`, neu `ki-integration`)
- **Wer wir sind** – `/uber-uns`, `/das-team`, `/karriere` (der Blog wurde entfernt, alte Blog-URLs leiten auf passende Leistungsseiten weiter)
- **Portfolio** – `/portfolio`, `/website-portfolio` (74 Projekte, 3D-Projektring, Suche & Jahresfilter), `/graphic-design-portfolio` (Brandings, Print, Social Media mit Lightbox), `/werbevideos-portfolio`
- **Partner** – `/partners`
- **Kontakt** – `/kontakt`, `/kostenlose-prufung`
- Projektbeiträge unter ihren bisherigen URLs (`/<slug>`), dazu `/agb`, `/datenschutz`, `sitemap.xml`, `robots.txt`, 404-Seite

Die bisherigen URLs bleiben gültig; geänderte oder entfernte URLs werden per 308 weitergeleitet. Vollständige Zuordnung aller 109 archivierten URLs: [`docs/migration.md`](docs/migration.md).

## Design & Interaktion

- Startseite: animierter Hero (Partikelnetz, wechselndes Wort «Design / Websites / Marketing / Code & KI», Glas-Collage mit Website-Aufbau, KI-Analyse, Lead-Chart, tippendem Code, Brand-Design und Google-Ranking, Maus-Parallax), Gratis-Analyse-Formular, «Offerte» (CHF 8’000 → CHF 0.–), Ablauf, KI-Assistent, Leistungen in 3D, Pakete & Preise, Referenzen, Kundenstimmen, FAQ
- Kopfzeile: transparente Glas-Navigation mit Mega-Menü
- Unterseiten: ein eigenes 3D-Objekt pro Seite (z. B. Filmkamera mit Spulen, Zeichenstift mit Bézierkurve, Puzzle, Rakete) mit Studio-Licht und weichen Schatten
- Three.js wird nur bei Bedarf nachgeladen; bei `prefers-reduced-motion`, fehlendem WebGL oder schwachen Geräten gibt es statische Fallbacks

## Inhalte & Medien aktualisieren

- Geschäftsdaten, Menü, Pakete, FAQ, Team: `src/content/site.ts`
- Leistungen: `src/content/services.ts`
- Projekte, Portfolios, Partner, AGB: generiert aus dem Archiv nach `src/content/generated/` mit `python3 -I scripts/extract_content.py`
- Optimierte Bilder/Videos (WebP/MP4) in `public/media/` – erzeugt mit `python3 -I scripts/prepare_media.py` (Pillow + ffmpeg). Die Originale in `assets/` bleiben unverändert.

## Vor dem Go-live prüfen

- Angebotsangaben (CHF 250/Monat, Website im Wert von CHF 8’000, Laufzeiten) sowie „100+ Kunden“, „Antwort innerhalb 24h“ und „35+ Kundenrezensionen“ wurden wie auf der bisherigen Website übernommen – bitte auf Aktualität prüfen.
- Teamliste und offene Stelle aktualisieren (`src/content/site.ts`, `src/app/karriere/page.tsx`).
- «4.4 auf Google» im Hero entspricht der Vorlage – bitte mit dem aktuellen Google-Profil abgleichen (`src/components/home/Hero.tsx`).
- Preise: Auf der Website stehen Basic/Premium «Auf Anfrage». Das Firmenprofil des Chatbots (aus dem Plugin) nennt Basic CHF 500 und Premium CHF 750 – im Admin unter «Chatbot & Wissen» anpassen, damit Website und Chat übereinstimmen.
- Die Datenschutzerklärung beschreibt Chatbot (OpenAI) und Google Analytics (nur nach Zustimmung) – bitte rechtlich prüfen lassen.

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

