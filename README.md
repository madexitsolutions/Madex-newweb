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
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Optional: Inhaber-Konto für `/admin` bei leerer Datenbank anlegen (sonst Ersteinrichtung unter `/admin`) |
| `DATA_DIR`, `DATA_ENCRYPTION_KEY` | Ablage und Verschlüsselung von Anfragen, Chats, Einstellungen |
| `SMTP_*`, `MAIL_FROM`, `CONTACT_TO_EMAIL` | E-Mail-Benachrichtigung bei neuen Anfragen |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | KI-Chatbot «Orion» und die Texte der Website-Analyse |
| `ANALYSE_HOURLY_LIMIT`, `ANALYSE_DAILY_LIMIT` | Website-Analyse: Kostenbremse für alle Besucher zusammen (Standard 12 pro Stunde, 40 pro Tag) |
| `PAGESPEED_API_KEY` | Website-Analyse: Google-Messung (Ladezeit, Core Web Vitals, Bildschirmfotos); ohne Schlüssel läuft die Analyse ohne diesen Teil |
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

## Anmeldung im Dashboard (`/admin`)

Anmeldung mit **E-Mail-Adresse** und Passwort, danach Zwei-Faktor-Code (Authenticator-App). Das erste Konto entsteht
über die Ersteinrichtung unter `/admin` oder automatisch aus `ADMIN_EMAIL` + `ADMIN_PASSWORD` (solange noch kein Benutzer existiert).

- **Status:** `/admin/status` zeigt Datenbank, Datenordner, Schlüssel, Konto und HTTPS – angemeldeten Admins; mit
  `STATUS_PAGE_PUBLIC=true` vorübergehend auch ohne Anmeldung (z. B. wenn die Anmeldung selbst nicht klappt).
- **Notfallzugang:** `ADMIN_RESET=true` setzen und neu starten (Konto `ADMIN_EMAIL` bekommt `ADMIN_PASSWORD`, 2FA wird neu eingerichtet),
  danach entfernen. Oder im Terminal bei gestoppter App: `npm run admin:reset -- name@firma.ch`.
- **Datenbank:** ohne `DATABASE_URL` läuft die eingebaute PostgreSQL-Datenbank (PGlite) in `DATA_DIR/pglite` – auch in Produktion,
  z. B. auf Hostinger ohne eigenen Datenbank-Server. Die App darf dann nur einmal laufen. Mit `DATABASE_URL` wird ein externer
  PostgreSQL-Server verwendet (Coolify, Neon, Supabase).
- **Sicherung:** Sicherheit → Datensicherung lädt die Datenbank herunter; Wiederherstellen bei gestoppter App mit
  `npm run db:restore -- datei.tar.gz`. Den Ordner `DATA_DIR` (Uploads, `.app-secret`) zusätzlich sichern.

Kontakt-, Analyse- und Chat-Terminanfragen landen unter `/admin/anfragen`; Empfänger unter Einstellungen → E-Mail (bis dahin `CONTACT_TO_EMAIL`).

## KI-Chatbot «Orion»

Das Chat-Fenster ist 1:1 das des bisherigen WordPress-Plugins: Original-Skript, -Stylesheet, -Schrift und -Icons liegen unverändert in `public/chatbot/` und laufen in einem Shadow DOM. Neu ist nur der Server-Teil `/api/chat/ajax`, der das admin-ajax-Protokoll des Plugins spricht. Funktionen: Startansicht (Neu-/Bestandskunde), freie Fragen über OpenAI mit Firmenprofil und Wissensdatenbank (antwortet nur mit bestätigten Informationen, sonst Weiterleitung ans Team), Paket-Finder mit drei Fragen, Termin-/Analyse-/Support-Anfrage mit Prüfschritt und Referenznummer, frühere Gespräche im Browser, Kontakt-Buttons, Rate Limits und Spam-Schutz. 

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
- Projekte, Portfolios, Partner, AGB: `src/content/generated/` (einmalig aus der alten WordPress-Seite übernommen)
- Bilder und Videos der Website: `public/media/` (WebP/MP4, für das Web optimiert). Neue Dateien vorher verkleinern, z. B. Bilder als WebP, Videos als 720p-MP4.
- Ausgangsmaterial der alten Seite (Originalbilder `assets/`, HTML-Archiv, Recherche, Build-Prompt, Chatbot-Plugin-Zip) liegt nicht mehr im Repository, sondern im Branch `archiv-ausgangsmaterial`.

## Vor dem Go-live prüfen

- Angebotsangaben (CHF 250/Monat, Website im Wert von CHF 8’000, Laufzeiten) sowie „100+ Kunden“, „Antwort innerhalb 24h“ und „35+ Kundenrezensionen“ wurden wie auf der bisherigen Website übernommen – bitte auf Aktualität prüfen.
- Teamliste und offene Stelle aktualisieren (`src/content/site.ts`, `src/app/karriere/page.tsx`).
- «4.4 auf Google» im Hero entspricht der Vorlage – bitte mit dem aktuellen Google-Profil abgleichen (`src/components/home/Hero.tsx`).
- Preise: Auf der Website stehen Basic/Premium «Auf Anfrage». Das Firmenprofil des Chatbots (aus dem Plugin) nennt Basic CHF 500 und Premium CHF 750 – im Admin unter «Chatbot & Wissen» anpassen, damit Website und Chat übereinstimmen.
- Die Datenschutzerklärung beschreibt Chatbot (OpenAI) und Google Analytics (nur nach Zustimmung) – bitte rechtlich prüfen lassen.

