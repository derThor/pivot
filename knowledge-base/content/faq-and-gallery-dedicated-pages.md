# FAQ- und Galerie-Verwaltung: dedizierte Seiten statt generischer Global-Module-Verwaltung

**Datum:** 2026-08-15
**Betroffene Bereiche:** apps/web

## Was wurde gebaut

FAQ- und Bildergalerie-Inhalte basieren weiterhin auf dem generischen
`GlobalModule`-Modell (siehe [page-designer.md](./page-designer.md)), werden
aber nicht mehr über die generische `/dashboard/global-modules`-Tabelle
verwaltet, sondern über zwei eigene, auf das jeweilige Datenmuster
zugeschnittene Seiten:

- **`/dashboard/content/faqs`** (`faq-groups-manager.tsx`): Karten pro
  FAQ-Gruppe (Icon, Name, Beschreibung, Fragen-Anzahl-Badge, ⋮-Menü,
  aufklappbarer Fragen-Bereich). Jede Frage zeigt einen
  Veröffentlicht/Entwurf-Punkt, Frage/Antwort und Bearbeiten/Löschen-Buttons.
  Anlegen/Bearbeiten läuft über zwei getrennte, jeweils minimale Dialoge
  (`faq-group-dialog.tsx`: nur Name+Beschreibung; `faq-question-dialog.tsx`:
  nur Frage+Antwort+Veröffentlicht) statt eines gemeinsamen Formulars mit
  allen Fragen – das war eine explizite Nutzervorgabe, um das Popup klein
  zu halten. Gruppen starten beim Laden der Seite eingeklappt (kein
  automatisches Aufklappen des ersten Eintrags).
- **`/dashboard/content/galleries`** (`gallery-grid.tsx` für die Übersicht,
  `gallery-editor.tsx` als eigene Bearbeiten-Seite unter
  `/dashboard/content/galleries/[id]`): Karten-Grid (max. 4/Zeile,
  responsiv bis 1 Spalte), bis zu 3 Bild-Kacheln pro Karte +
  Gesamtanzahl-Badge. Anlegen (`gallery-dialog.tsx`) fragt nur Name +
  Anzeige-Einstellungen ab, keine Bilder – Bilder werden erst danach über
  eine "Bilder hinzufügen"-Kachel ergänzt. Die Bearbeiten-Seite hat eine
  Live-Vorschau (Swiper, max. 400px Bildhöhe), ein sortierbares
  Thumbnail-Grid (natives HTML5-Drag&Drop, gleiches Muster wie
  `navigation-items-editor.tsx`) mit Hinzufügen/Löschen, Klick-zu-
  Bildunterschrift-Popup pro Bild sowie eine Anzeige-Einstellungen-Sidebar
  (Effekt, Endlosschleife, Autoplay, Beschreibung anzeigen). Nach dem
  Speichern geht es zurück zur Galerien-Übersicht.

`global-modules-manager.tsx` und der Dialog-Teil (Default-Export
`GlobalModuleFormDialog`) von `global-module-form-dialog.tsx` sind dadurch
**totes Gewicht** (keine Importstelle mehr im Code) – bewusst noch nicht
gelöscht, siehe Offene Punkte. Der benannte Export `GallerySettingsEditor`
aus derselben Datei ist weiterhin aktiv (wird von `gallery-dialog.tsx` und
den Einstellungen im Editor genutzt).

## Warum diese Lösung

Eine einzige generische Tabelle/ein generisches Formular für beliebige
`GlobalModule`-Typen ist für stark repeater-lastige Inhalte wie FAQ
(verschachtelte Fragen) und Galerien (Bild-Reihenfolge, Live-Vorschau,
pro-Bild-Metadaten) zu unhandlich – die Nutzervorgabe war explizit, das
FAQ-Bild/die Galerie-Vorlage 1:1 nachzubauen, was mit dem generischen
Formular nicht möglich war. Die Formerkennung
(`isFaqModuleType`/`isGalleryModuleType` in `block-field-output.tsx`,
Repeater mit/ohne Bild-Unterfeld) bleibt bestehen und entscheidet, welche
Seite ein `GlobalModule`-Eintrag im Sidebar-Menü bekommt – es gibt weiterhin
keine hartkodierten Modul-Slugs.

## Stolpersteine / Besonderheiten

- **Swiper-Effekt greift erst nach Remount:** Effekt-Module (Cube, Cards,
  Coverflow, …) werden nur beim Mount initialisiert. Ein reiner
  Prop-Wechsel wirkt sich nicht live aus – Fix: `key={settings.effect}` auf
  `<Swiper>`, erzwingt Remount bei Effekt-Wechsel (`gallery-swiper.tsx`).
- **`loop` bricht Navigation bei "cards"/"cube":** Diese Effekte sind mit
  Swipers `loop`-Modus inkompatibel (Pfeile/Punkte reagieren nicht mehr
  zuverlässig). Fix: `LOOP_INCOMPATIBLE_EFFECTS` in `gallery-settings.ts`,
  `loop` wird für diese Effekte hart auf `false` erzwungen
  (`gallery-swiper.tsx`), UI deaktiviert den Endlosschleife-Schalter mit
  Hinweistext und schaltet ihn beim Wechsel zu einem inkompatiblen Effekt
  automatisch aus (`handleEffectChange` in `gallery-editor.tsx` und
  `global-module-form-dialog.tsx` – beide Stellen, da Create-Dialog und
  Editor-Seite getrennte `GallerySettingsEditor`-Nutzungen haben).
- **`showCaptions`-Einstellung an zwei Stellen pflegen:** Die "Beschreibung
  anzeigen"-Einstellung muss sowohl im Create-Dialog
  (`GallerySettingsEditor`) als auch im Editor (`SettingsSwitchRow` in
  `gallery-editor.tsx`) vorhanden sein, da beide unabhängige UI-Instanzen
  sind, die auf dasselbe `GallerySettings.showCaptions`-Feld schreiben.
- **Dialog-Scroll-Squish-Bug:** `overflow-y-auto` innerhalb eines
  `max-h-[85dvh]`-begrenzten Dialogs mit `flex flex-col gap-*`-Kindern
  quetscht Inhalt zusammen statt zu scrollen (`scrollHeight` blieb dabei
  fälschlich gleich `clientHeight`). Fix: `space-y-*` statt
  `flex flex-col gap-*` in der scrollbaren Region, plus `overflow-hidden`
  auf der Basis-`DialogContent`-Klasse (`ui/dialog.tsx`). Betrifft
  `gallery-dialog.tsx` und `global-module-form-dialog.tsx`. Beim Testen
  sind `scrollIntoView` und synthetische Wheel/Mouse-Events unter
  Touch-Emulation **keine** verlässlichen Nachweise für echtes
  Scroll-Verhalten – nur `Input.dispatchTouchEvent` (CDP) bestätigt es
  zuverlässig.
- **Inline-Validierung ist Konvention, keine Ausnahme:** Alle neuen Dialoge
  zeigen Feldfehler direkt unter dem betroffenen Input (nicht als
  Sammel-Meldung unten) – siehe `nameError`/`submitError`-Trennung in
  `faq-group-dialog.tsx`, `faq-question-dialog.tsx`, `gallery-dialog.tsx`.

## Relevante Dateien

- `apps/web/src/components/faq-groups-manager.tsx`
- `apps/web/src/components/faq-group-dialog.tsx`
- `apps/web/src/components/faq-question-dialog.tsx`
- `apps/web/src/components/gallery-grid.tsx`
- `apps/web/src/components/gallery-dialog.tsx`
- `apps/web/src/components/gallery-editor.tsx`
- `apps/web/src/components/gallery-swiper.tsx`
- `apps/web/src/lib/gallery-settings.ts`
- `apps/web/src/app/dashboard/content/galleries/[id]/page.tsx`
- `apps/web/src/components/global-module-form-dialog.tsx` (nur noch
  `GallerySettingsEditor` aktiv genutzt)

## Offene Punkte

- `global-modules-manager.tsx` und der Dialog-Teil von
  `global-module-form-dialog.tsx` sind totes Gewicht (keine Importstelle
  mehr) – dem Nutzer zur Löschung vorgeschlagen, aber noch nicht bestätigt.

## Update 2026-08-22: Effekte "Umblättern"/"Kreativ", Scrollbar, Vorschaubilder

Nutzervorgabe: "bau den effect flip und creative in galerie zum
auswählen ein ... außerdem als setting punkt scrollbar ... zusätzlich
thumnails einbauen".

- Zwei neue Swiper-Effekte in `GALLERY_EFFECTS` (`gallery-settings.ts`):
  `flip` ("Umblättern") und `creative` ("Kreativ"). `flip` erzwingt wie
  fade/cube/cards `slidesPerView: 1` (`overwriteParams()` in
  `node_modules/swiper/modules/effect-flip.mjs`) – zu
  `SINGLE_SLIDE_EFFECTS` ergänzt. `creative` erzwingt das NICHT (echtes
  Mehrfach-Slide-Layout bleibt möglich).
- `creative` hat ohne eigene Konfiguration keinen sichtbaren Übergang
  (Swiper-Default in `effect-creative.mjs` ist ein Identitäts-Transform,
  `translate/rotate: [0,0,0], opacity/scale: 1`) – in `gallery-swiper.tsx`
  daher ein `creativeEffect`-Preset hinterlegt (voriges Bild nach links/
  hinten mit Schatten, nächstes von rechts), eines von Swipers eigenen
  offiziellen Demo-Presets, keine erfundene Konfiguration.
- **Kein `LOOP_INCOMPATIBLE_EFFECTS`-Eintrag für flip/creative ergänzt** –
  die bestehende Liste (`cube`/`cards`) basiert auf echter
  Nutzerbestätigung eines konkreten Navigations-Bugs (2026-08-15), nicht
  auf einer Effekt-Eigenschaft wie "nur eine Slide sichtbar" (sonst wäre
  auch `fade` betroffen, ist es aber nicht). Ohne eigene Bestätigung für
  flip/creative bleibt `loop` dort aktivierbar; sollte sich ein
  Navigations-Bug zeigen, einfach zur Liste ergänzen.
- **"Scrollbar"/"Vorschaubilder" bekamen bewusst KEIN
  Inkompatibilitäts-Array** wie `LOOP_INCOMPATIBLE_EFFECTS` (Nutzervorgabe
  wollte eigentlich "wenn nicht möglich, deaktiviert lassen wie bei
  cards") – Recherche direkt im installierten `swiper`-Paket
  (`node_modules/swiper/modules/scrollbar.mjs`/`thumbs.mjs`) ergab: beide
  Module rufen nur effekt-unabhängige Kern-Methoden auf
  (`swiper.setTranslate()` bzw. `swiper.slideTo()`), die jedes
  Effekt-Modul (auch im `virtualTranslate`-Modus von fade/cube/flip/
  cards/creative) für seine eigene Slide-Transform-Berechnung
  konsumiert. Kein Quelltext-Hinweis auf eine echte Einschränkung
  gefunden (anders als beim damaligen Loop-Bug) – deshalb für alle
  Effekte aktivierbar gelassen, statt eine nicht belegte Einschränkung zu
  erfinden. Falls sich in der Praxis doch ein kaputter Effekt zeigt: genau
  das gleiche Muster wie `LOOP_INCOMPATIBLE_EFFECTS` nachrüsten.
- `GallerySettings.scrollbar`/`.thumbnails` (beide `boolean`, Default
  `false`) – neue Schalter "Scrollbar anzeigen"/"Vorschaubilder anzeigen"
  in beiden Editier-Oberflächen (`gallery-editor.tsx` UND
  `GallerySettingsEditor` in `global-module-form-dialog.tsx`, von dort
  auch `gallery-dialog.tsx` – siehe "Relevante Dateien").
- `gallery-swiper.tsx`: `Scrollbar`-Modul rendert (wie Navigation/
  Pagination) automatisch über die React-Swiper-Props, keine manuelle
  DOM-Struktur nötig. "Vorschaubilder" ist technisch eine ZWEITE,
  kleinere Swiper-Instanz (`Thumbs`-Modul, `onSwiper`/`thumbs={{ swiper
  }}`-Kopplung) mit quadratischen Thumbnails, aktives Thumbnail per
  `.swiper-slide-thumb-active`-Klasse hervorgehoben (Akzentfarbe über
  `--swiper-theme-color`, bereits bestehende CSS-Variable). Neue
  CSS-Imports: `swiper/css/scrollbar`, `swiper/css/thumbs`,
  `swiper/css/effect-flip`, `swiper/css/effect-creative` (alle über
  Swipers Package-Exports-Map aufgelöst, geprüft in
  `node_modules/swiper/package.json`).

Nicht per Browser getestet (kein Headless-Browser in dieser Session
verfügbar) – nur Typecheck/Lint sauber. Die Scrollbar-/Thumbnails-
Kompatibilitätsaussage stützt sich auf Quelltext-Analyse, nicht auf
gemeldetes Nutzer-Feedback wie bei `LOOP_INCOMPATIBLE_EFFECTS`.
