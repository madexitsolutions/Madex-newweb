# Three.js-Richtung für Madex IT Solutions

Dieses Dokument beschreibt eine technisch realistische 3D-Designrichtung. Es ist kein fertiges Website-Konzept und keine Freigabe für neue Geschäftsbehauptungen.

## Leitidee

**„Digital momentum“:** Das doppelte, nach oben gerichtete Madex-Symbol wird als abstrakte räumliche Bewegung interpretiert. Dunkles Petrol (`#025159`) und Türkis (`#028D86`) bilden das verbindliche Farbsystem; Weiss, Schwarz und helles Grau halten Inhalte lesbar.

Da das aktuelle Logo nur als verifizierte PNG-Datei vorliegt, darf die Wortmarke nicht ungeprüft nachgezeichnet werden. Für die 3D-Szene gibt es zwei sichere Optionen:

1. Logo-PNG als hochauflösende Textur auf einer leicht räumlichen Fläche verwenden.
2. Nur das einfache doppelte Pfeil-/M-Motiv prozedural nachbilden und es als abstrahierte Animation kennzeichnen; vor finalem Einsatz visuell mit dem Inhaber abgleichen.

## Empfohlene 3D-Momente

### Hero

- Eine reduzierte, extrudierte Doppel-M-Form schwebt über einem dezenten Tiefenraster.
- Maus-/Gyro-Parallaxe bleibt sehr klein; kein unruhiges Dauerrotieren.
- Zwei Materialien verwenden: `#025159` und `#028D86`, ergänzt durch weiche weisse Rim-Lights.
- Text und CTAs bleiben echtes HTML über dem Canvas.
- Statischer Fallback: `assets/business-cover.jpg` mit Logo-Overlay.

### Service-Navigation

- Acht Service-Knoten können sich in einer ruhigen räumlichen Konstellation anordnen.
- Fokus/Keyboard-Auswahl hebt einen Knoten hervor und aktualisiert eine zugängliche HTML-Detailkarte.
- Die acht JPG-Dateien mit dem Präfix „service-“ im Ordner `assets/` dienen als Karten- oder Texturvorschau, nicht als unkomprimierte Vollbildtexturen.

### Projektgalerie

- Portfolio-Mockups als gekrümmte Karten oder leicht versetzte Ebenen in einem horizontalen Raum.
- Der komplette Inhalt muss zusätzlich als semantisches HTML-Raster verfügbar sein.
- `assets/project-11-polyprojekt.gif` nur bei Sichtbarkeit abspielen; ansonsten Poster/Fallback vorsehen.

### About/Team

- Schwarz-weisse Team-/Studiofotografie mit subtiler Tiefenmaske und türkisem Licht.
- Porträts bleiben unverzerrte 2D-Inhalte; keine KI-Veränderung von Personen.
- `assets/brand-mascot.png` kann als separates, dekoratives Easter Egg erscheinen, aber nicht als Teammitglied.

## Technische Leitplanken

- Three.js über React Three Fiber nur dort einsetzen, wo der räumliche Effekt einen klaren Mehrwert liefert.
- Canvas dynamisch und clientseitig laden; Hauptinhalt muss servergerendert und ohne WebGL vollständig nutzbar sein.
- Device Pixel Ratio begrenzen, adaptive Qualität verwenden und Animationen pausieren, sobald der Canvas nicht sichtbar ist.
- `prefers-reduced-motion` respektieren: Kamerafahrten und automatische Bewegung deaktivieren; statische Szene oder Bildfallback anzeigen.
- Keine Scroll-Sperren und keine Navigation, die nur im Canvas existiert.
- Texturen vor dem Deployment als WebP/AVIF-Varianten generieren; die Originaldateien im Kit unverändert lassen.
- Lazy Loading für Projekt- und Teammedien; Hero-Asset priorisieren.
- Auf mobilen Geräten vereinfachte Geometrie, reduzierte Partikelzahl und keine teuren Postprocessing-Ketten.
- Ziel: Core Web Vitals nicht durch 3D opfern; Interaktion und Kontakt-CTA müssen sofort verfügbar bleiben.

## Nicht verwenden

- Keine zufälligen Stockbilder oder generierten Kundenergebnisse.
- Keine erfundenen 3D-Produktvisualisierungen, die wie reale Madex-Arbeiten wirken.
- Keine frei erfundenen Kennzahlen, Dashboardwerte oder Kampagnenergebnisse in 3D-UI.
- Keine aggressive Motion, die Lesbarkeit, Fokusführung oder Barrierefreiheit beeinträchtigt.
- Keine 3D-Neuzeichnung der Wortmarke ohne Markenfreigabe.

