# Übergabe – Stand Madex-Website (16.10.2026)

Next.js 16 Website von Madex IT Solutions (Deutsch/Schweiz, kein «ß»). Erst `AGENTS.md` lesen
(Next.js 16: Doku in `node_modules/next/dist/docs/`), dann `README.md`.

## Arbeitsweise
- Immer nach `main` pushen **und** auf den Branch `claude/admiring-wozniak-762nkb`.
- Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` und `Claude-Session: …`.
- Prüfen: `npx tsc --noEmit && npx eslint . && npx vitest run && npx next build`.
- Dev: `ADMIN_USERNAME=madex ADMIN_PASSWORD=… DATA_DIR=… DATA_ENCRYPTION_KEY=… npx next dev`.

## Zuletzt umgesetzt (alles in `main`)
- **Logo:** SVG-Logo überall (`components/ui/Logo.tsx`). Auf hellem Grund Originalfarben, auf dunklem Grund komplett weiss.
- **Startseite:**
  - Neues Logo-Intro (`layout/Preloader.tsx`, einmal pro Sitzung); kein Ladebildschirm mehr zwischen Seiten.
  - Partnerlogos in 2 Reihen ohne Doppelungen.
  - KI-Bereich «KI-Lösungen nach Mass» mit Einsatzbeispielen (`home/AiSolutions.tsx`).
  - «Was wir tun» als Kundenweg in drei Stufen (`sections/ServicesConstellation.tsx`).
  - FAQ-Buttons ausgerichtet.
- **Google-Bewertungen** (nur 4–5 Sterne) über die Places API (`lib/server/google-reviews.ts`). Es fehlen noch `GOOGLE_PLACES_API_KEY` und `GOOGLE_PLACE_ID` auf dem Server; ohne sie erscheinen die hinterlegten Kundenstimmen.
- **Blog** entfernt; alte URLs leiten weiter (`next.config.ts`).
- **3D-Szenen** neu: Pen-Tool, KI, Google Marketing, Analyse, Karriere, Kontakt; Portfolio-Szene mit Website-Skeletten.
- **Portfolio:**
  - Website-Portfolio als leichte Projektleiste.
  - Projektseite mit CSS-Geräte-Mockup (Laptop-Tastatur korrigiert).
  - Werbevideos mit YouTube-Vorschaubildern.
- **Kontaktseite, Formular, Kostenlose Prüfung:** überarbeitet; Typografie langer Texte über `src/app/prose.css`.
- **Admin-Dashboard** (eigenes `/admin` dieser Website) neu organisiert: SEO-Tabelle mit Filtern, gruppierte Navigation.

## Dashboard aus der Vorlage (in `main`)
- Der Kern von `madexitsolutions/predashboard` ist eingebaut: `/admin` (neu), `src/server`, `src/components/admin`, `src/modules`,
  `src/lib/{format,catalog,…}.ts`, `src/app/api/{v1,payments,cron}`, `src/app/uploads`, `src/instrumentation.ts`, `tests/dashboard`,
  `scripts/db-*.ts`, `drizzle.config.ts`. Die Website (`src/app/(site)`) ist unverändert.
- Das alte Admin (`/admin-alt`) ist entfernt. Kontakt-, Analyse- und Chat-Terminanfragen gehen über `createInquiry()` in
  `/admin/anfragen`; SEO-Overrides kommen aus `/admin/seo`, die GA4-ID aus Integrationen → Google Analytics.
- Erstes Konto: Ersteinrichtung unter `/admin` oder `ADMIN_EMAIL`/`ADMIN_PASSWORD`; Notfall `ADMIN_RESET=true` oder `npm run admin:reset`
  (siehe `ownerFromEnv`/`resetOwner` in `src/server/db/bootstrap.ts`). `/admin/status` zeigt ohne Login, was fehlt.
- Ohne `DATABASE_URL` läuft in Produktion die eingebaute Datenbank (PGlite, `DATA_DIR/pglite`); `APP_SECRET` optional (sonst
  `DATA_DIR/.app-secret`). Sicherung unter Sicherheit → Datensicherung, Wiederherstellen mit `npm run db:restore`.
- Diese Kern-Änderungen (eingebaute DB, Schlüssel, Cookie, Status-Seite, Datensicherung, admin:reset, db:restore) sind auch in der
  Vorlage `predashboard` (main) – Kern und Vorlage sind wieder gleich.
- Orion läuft weiter mit seinen Standardeinstellungen (`src/lib/server/settings.ts`, Speicher in `DATA_DIR`); eine Oberfläche
  für Chatbot, Wissen, Pakete und Chat-Verläufe fehlt, bis das Modul «KI-Assistent» in der Vorlage gebaut ist.
- **Betrieb:** nur `DATA_DIR` (dauerhafter Ordner/Volume) ist Pflicht; `DATABASE_URL` nur für einen externen PostgreSQL-Server,
  `APP_URL` für Links, `CRON_SECRET` für /api/cron. Die Migrationen liegen in `drizzle/` (aus der Vorlage) und werden beim Start angewendet.
- Updates der Vorlage: die Kern-Ordner aus `predashboard` hierher kopieren (Website-Ordner nicht anfassen), dann `npm test`.
- Danach: Orion als Modul «KI-Assistent» in die Vorlage (Einstellungen, Wissen, Pakete, Chat-Verläufe).

## Offen
- **Videotitel:** Die Kacheln zeigen «Werbevideo N». `VideoGrid` nimmt eine Map `titles` (YouTube-ID → Titel) entgegen; die Titel liefert der Inhaber.
- **Vorschaubilder** (i.ytimg.com) live nach dem Deploy prüfen; in der Testumgebung waren sie blockiert.
- **Geplant:** Diese Website an das neue wiederverwendbare Dashboard anbinden, Repo `madexitsolutions/predashboard` (Stand dort in `HANDOFF.md`):
  - Anfragen an dessen `POST /api/v1/inquiries` senden.
  - SEO aus `GET /api/v1/seo` lesen.
  - Den Chatbot Orion als neues Modul «KI-Assistent» ins Predashboard verschieben.

  Danach das eigene `/admin` dieser Website entfernen. Das kommt erst, wenn das Predashboard fertig ist.
