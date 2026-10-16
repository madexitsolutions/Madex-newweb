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
- Das bisherige Admin liegt jetzt unter `/admin-alt` (Orion, Chats, Pakete, alte Anfragen) und bleibt, bis das neue Dashboard sie übernimmt.
  Das Kontaktformular speichert weiterhin im alten Speicher (`/api/kontakt` → `/admin-alt/anfragen`).
- **Coolify braucht** (sonst startet der Server nicht): PostgreSQL-Datenbank und die Variablen `DATABASE_URL`, `APP_SECRET`, `APP_URL`,
  dazu `CRON_SECRET` und ein Volume auf `DATA_DIR`. Die Migrationen liegen in `drizzle/` (aus der Vorlage) und werden beim Start angewendet.
- Updates der Vorlage: die Kern-Ordner aus `predashboard` hierher kopieren (Website-Ordner nicht anfassen), dann `npm test`.
- Danach: Kontaktformulare auf `createInquiry()` umstellen, Orion als Modul «KI-Assistent» in die Vorlage, SEO aus dem Dashboard lesen, `/admin-alt` entfernen.

## Offen
- **Videotitel:** Die Kacheln zeigen «Werbevideo N». `VideoGrid` nimmt eine Map `titles` (YouTube-ID → Titel) entgegen; die Titel liefert der Inhaber.
- **Vorschaubilder** (i.ytimg.com) live nach dem Deploy prüfen; in der Testumgebung waren sie blockiert.
- **Geplant:** Diese Website an das neue wiederverwendbare Dashboard anbinden, Repo `madexitsolutions/predashboard` (Stand dort in `HANDOFF.md`):
  - Anfragen an dessen `POST /api/v1/inquiries` senden.
  - SEO aus `GET /api/v1/seo` lesen.
  - Den Chatbot Orion als neues Modul «KI-Assistent» ins Predashboard verschieben.

  Danach das eigene `/admin` dieser Website entfernen. Das kommt erst, wenn das Predashboard fertig ist.
