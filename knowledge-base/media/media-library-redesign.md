# Medien-Bibliothek: Masonry-Grid + Detail-Seitenleiste statt Popup

**Datum:** 2026-08-17
**Betroffene Bereiche:** apps/api (`src/media`), apps/web
(`src/components/media-*`, `src/app/dashboard/media`)

> **Update 2026-08-17 (Nachbesserungen nach Live-Test):** Reihe kleinerer
> Korrekturen direkt im Anschluss an den Erstumbau, alle per Nutzer-
> Feedback am laufenden Dev-Server gefunden:
> - **Grid-Bilder nutzten `thumbnailUrl`** – das ist laut
>   [media-square-thumbnails-and-tiles-block.md](./media-square-thumbnails-and-tiles-block.md)
>   **bewusst immer quadratisch** (für den "Kacheln"-Baustein). Dadurch
>   hatte jede Masonry-Kachel dasselbe Seitenverhältnis – kein
>   Masonry-Effekt sichtbar ("erzwinge masonry"). Fix: neue
>   `gridThumbnailSrc()`-Helper-Funktion wählt stattdessen die kleinste
>   responsive Variante (natürliches Seitenverhältnis) aus
>   `item.variants`, Fallback auf das Original.
> - **Grid dichter, Seitenleiste breiter**: `columns-3/4/5/6` (vorher
>   `2/3/3/4`), Panel `380px` (vorher `300px`).
> - **Auswahl-Ring am Grid unsichtbar** (`boxShadow: none` trotz
>   korrektem `--tw-ring-shadow`): `shadow-card` und `ring-*` setzen
>   beide `box-shadow`, aber `--shadow-card` ist projektweit auf `none`
>   gesetzt (flaches Design, siehe `globals.css`) – Tailwinds interne
>   Utility-Reihenfolge (nicht die Reihenfolge im `className`-String)
>   platziert `shadow-card`s `box-shadow: none` **nach** dem von
>   `ring-2`/`ring-primary` komponierten Wert und überschreibt ihn damit
>   komplett, statt zu kombinieren. Fix: `shadow-card` von der
>   Grid-Kachel entfernt (trug ohnehin nichts bei, da `none`).
>   **Lehre**: `shadow-*`/benutzerdefinierte Box-Shadow-Utilities und
>   `ring-*` auf demselben Element nie mischen, ohne die generierte
>   Reihenfolge zu prüfen – nicht additiv.
> - **`MediaEditDialog`-Titel brach bei langen Dateinamen aus dem Popup
>   aus** ("bearbeiten popup zerschossen"): `DialogHeader` ist
>   `flex flex-col`, `DialogTitle` bekommt darin `min-width: auto` als
>   Flex-Item-Default – `truncate` allein wirkt dadurch nicht. Fix:
>   `min-w-0` zusätzlich zu `truncate` (plus `pr-6` Abstand zum
>   ×-Schließen-Button).
> - **Doppelter Chevron im "Alle Dateitypen"-Dropdown**: `SelectTrigger`
>   rendert bereits selbst einen `ChevronDownIcon` – der zusätzlich
>   manuell eingefügte `<ChevronDown>` in `media-filters.tsx` erzeugte
>   einen zweiten. Entfernt.
> - **Auswahl-Ring braucht weißen Zwischenraum zum Bild** ("Bild, weißer
>   Border, dann grün"): `ring-offset-2 ring-offset-white` zusätzlich zu
>   `ring-2 ring-primary` ergänzt – funktioniert jetzt sauber, da
>   `shadow-card` (siehe oben) nicht mehr denselben `box-shadow`-Layer
>   blockiert.
> - **PDF/Nicht-Bild-Vorschau in der Detailansicht war höher als Bilder**
>   (`aspect-square` statt `max-h-[165px]`): auf `h-[165px]` umgestellt,
>   damit alle Dateitypen dieselbe Vorschau-Höhe haben.
> - **CSS-`columns-*` ist kein echtes Masonry** ("bilder müssen sich
>   automatisch einfügen und ... leerräume ... rechts lassen"): eine
>   Spalte wird bei `columns-*` vollständig befüllt, bevor die nächste
>   beginnt – eine kurze Spalte bleibt danach dauerhaft leer, statt dass
>   spätere Elemente dort einsortiert werden (genau das im Screenshot
>   gemeldete Loch). Fix: `useMasonryColumns()` (neuer Hook in
>   `media-explorer.tsx`) berechnet die Spaltenzuordnung selbst in JS –
>   `ResizeObserver` liefert die aktuelle Spaltenzahl (3/4/5/6 nach
>   Breakpoint), jedes Element wird der **aktuell kürzesten** Spalte
>   zugewiesen (Pinterest-Algorithmus), die geschätzte Höhe kommt aus
>   `item.width`/`item.height` (Seitenverhältnis, kein Bild-Laden nötig
>   für die Zuordnung selbst) – Elemente ohne Maße (Nicht-Bilder) zählen
>   als 1:1. Gerendert als `N` nebeneinanderliegende `flex flex-col`-
>   Spalten statt einer `columns-*`-Utility. Kachel-Markup dafür in eine
>   eigene `MediaTile`-Komponente extrahiert.
> - **Fokuspunkt in der Detail-Vorschau ignoriert**: `object-cover` schnitt
>   bislang immer von der Bildmitte, unabhängig vom gesetzten
>   `Media.focalX`/`focalY`. Fix: `focalObjectPosition()` (bereits
>   bestehender Helfer aus `block-field-output.tsx`, dort schon fürs
>   Seiten-Designer-Bildfeld genutzt) liefert den passenden CSS
>   `object-position`-Wert, hier per `style` auf das Vorschaubild
>   angewendet. `MediaItem.focalX`/`focalY` sind `number | null`
>   (nullable), der Helfer erwartet `number | undefined` (optional) –
>   `?? undefined` beim Aufruf nötig, sonst Typfehler.
> - **Diverse Detail-Anpassungen**: Vorschaubild in der Detailansicht
>   `max-h-[165px]` (Nutzervorgabe, nach Zwischenschritt 180px);
>   ⋮-Menü jetzt `absolute` über dem Vorschaubild mit weißem
>   Kreis-Hintergrund statt in einer eigenen Zeile darüber;
>   Bearbeiten/Link-kopieren-Buttons mit `min-w-0` + `truncate` gegen
>   Überlauf abgesichert; Ordner-Icon `bg-primary/15`/`text-primary`
>   (Marken-Lime statt Amber, "nutze unser Grün"); Ordner-Karten `w-56`
>   (vorher `w-40`, "0 Dateien" brach sonst um); Rahmen der
>   Nicht-Bild-Platzhalter (PDF-Icon-Box) auf `#D4D4D4` verdunkelt;
>   Tag-Filter-Pillen im ausgewählten Zustand nutzen jetzt denselben
>   dunklen Fülleton wie die "Alle"-Pille (`bg-[#132033]`) statt
>   `bg-muted`; Dateityp-/"Nur ungenutzte"-Pillen von `rounded-full` auf
>   `rounded-xl` dann `rounded-lg` (explizite Nutzervorgabe "radius-xl:
>   .75rem", dann "etwas weniger"); Hover-Overlay auf Grid-Kacheln
>   (Download-Button + Dateiname/Tags) ergänzt, kam in der ursprünglichen
>   Umsetzung noch nicht vor; `ui/input.tsx` hat jetzt `flex items-center`
>   (Datei-Input-Button und Platzhaltertext standen vorher nicht auf
>   einer Linie – wirkt auf **jedes** Input im Projekt).

> **Update 2026-08-17 (Datei-Typ-Icons + Dialog-Überlauf-Fix):**
> - **Nicht-Bild-Dateitypen bekommen farbige Icon-Kacheln** (Grid-Kachel
>   `media-explorer.tsx` **und** Detail-Panel-Vorschau
>   `media-detail-panel.tsx`, 1:1 nach Bildvorlage): neue Helfer in
>   `lib/media-type.ts` – `isSvg()` (eigene Prüfung, siehe unten warum
>   nicht `mediaCategory()` angepasst wurde), `mediaTypeStyle()` (liefert
>   `{bg, fg}`-Pastellton-Paar pro Typ: SVG lime, PDF rot, Video sky,
>   Excel/Spreadsheet emerald, PowerPoint/Presentation orange, Word blau,
>   Rest grau) und `fileExtensionLabel()` (Dateiendung aus dem
>   Dateinamen, z.B. "DOCX" statt der vollen MIME-Type-Zeichenkette).
>   `mediaTypeLabel()` bekam einen SVG-Sonderfall vorangestellt ("SVG"
>   statt "Bild").
>   **Bewusst NICHT `mediaCategory()` selbst angepasst**: die zählt SVG
>   absichtlich weiter als `"image"`, weil `media-browser-panel.tsx`
>   (Bild-Picker im Seiten-Designer) davon eine echte `<img>`-Vorschau
>   erwartet – nur die drei Medien-Übersicht-Komponenten prüfen
>   zusätzlich `isSvg()`, um SVGs *dort* stattdessen als Icon-Kachel zu
>   zeigen (ein rohes SVG als Grid-Bild kann bei sehr breiten/schmalen
>   Viewports das Masonry-Seitenverhältnis verzerren, ein festes Icon
>   nicht).
>   **Scope bewusst begrenzt**: nur Design bestehender, bereits
>   hochladbarer Typen (Bild/PDF/Office/Video + SVG-als-Icon) – explizite
>   Nutzerentscheidung gegen "auch MP3/ZIP-Upload ermöglichen".
> - **`MediaEditDialog`-Überlauf bei langem Dateinamen kam beim ersten Fix
>   (siehe Eintrag oben, `min-w-0 truncate` auf `DialogTitle`) wieder** –
>   diesmal auch mit den Abbrechen/Speichern-Footer-Buttons sichtbar
>   außerhalb des Dialogs. **Eigentliche Ursache**: `DialogContent`
>   (`ui/dialog.tsx`) ist `display: grid`, nicht `flex` –
>   `DialogHeader`/`DialogFooter` sind direkte **Grid-Items** darin.
>   Grid-Items bekommen (genau wie Flex-Items) `min-width: auto` als
>   Default, unabhängig davon, ob irgendein tiefer verschachteltes
>   Kind-Element bereits `min-w-0` hat – `min-w-0` "vererbt" sich nicht
>   automatisch nach unten, **jede** Container-Ebene in der Kette, die
>   theoretisch am Inhalt wachsen könnte, braucht ihr eigenes `min-w-0`.
>   Der erste Fix hatte nur `DialogTitle` (2 Ebenen tiefer) behandelt,
>   nicht `DialogHeader` selbst als Grid-Item von `DialogContent` – bei
>   einem noch längeren Dateinamen reichte dessen Grid-Item-Mindestbreite
>   dann aus, um den ganzen Dialog (inkl. Footer, da `DialogFooter`
>   ebenfalls ein ungeschütztes Grid-Item ist) zu sprengen. Fix:
>   `min-w-0` **global** auf `DialogHeader` (`flex min-w-0 flex-col
>   gap-2`) und `DialogFooter` (`flex min-w-0 flex-col-reverse gap-2 ...`)
>   in `ui/dialog.tsx` ergänzt – wirkt auf **jeden** Dialog im Projekt,
>   nicht nur `MediaEditDialog`. Per CDP-Screenshot mit künstlich sehr
>   langem Titel verifiziert: Titel truncatet sauber mit Ellipsis, Footer
>   bleibt vollständig innerhalb der Dialog-Grenzen.
>   **Lehre**: bei Flex/Grid-Überlauf-Bugs mit `truncate`/`min-w-0` immer
>   die **gesamte** Container-Kette bis zum äußersten Flex/Grid-Parent
>   prüfen, nicht nur das Element mit dem sichtbar abgeschnittenen Text –
>   ein Fix an einer einzelnen tiefen Stelle kann bei längerem Inhalt
>   erneut brechen, wenn eine Zwischenebene ungeschützt bleibt.

> **Update 2026-08-15 (Spaltenzahl-Flackern beim Laden):** "wenn man
> medien aufruft, flippen die bilder kurz von einer größeren größe zu
> einer kleineren" – `useMasonryColumns()` initialisierte `columnCount`
> immer mit `4`, unabhängig von der tatsächlichen Container-Breite. Der
> `ResizeObserver`, der die echte Spaltenzahl (3/4/5/6) ermittelt, lief
> in einem normalen `useEffect` – der feuert erst **nach** dem ersten
> Browser-Paint, wodurch auf breiten Bildschirmen (die z.B. 5 oder 6
> Spalten bräuchten) kurz die für `4` berechnete, gröbere Aufteilung
> sichtbar war, bevor auf die richtige, engere Spaltenzahl umgesprungen
> wurde (größere Kacheln → kleinere Kacheln, sichtbares "Flippen"). Fix:
> `useEffect` → `useLayoutEffect` – läuft synchron nach dem Commit, aber
> **vor** dem Browser-Paint, sodass der korrigierte `setColumnCount`-Wert
> direkt im ersten sichtbaren Frame steht statt in einem zweiten,
> sichtbar abweichenden Frame. Per CDP mit engmaschigem Sampling (alle
> ~80ms über 1,2s nach dem Navigieren) verifiziert: Spaltenzahl bleibt ab
> dem ersten Messpunkt konstant, kein Zwischenwert mehr sichtbar.
> **Lehre**: Layout-Messungen (`ResizeObserver`, `getBoundingClientRect`
> u.ä.), die den initialen Render einer Komponente beeinflussen sollen,
> gehören in `useLayoutEffect`, nicht `useEffect` – sonst rendert die
> Komponente erst mit einem Platzhalter-/Default-Wert sichtbar, bevor
> der Wert im nächsten Frame korrigiert wird.

> **Update 2026-08-15 (Grüner Fokus-Ring beim Öffnen des Upload-Popups):**
> "datei auswählen passt nicht mehr" – der grüne Fokus-Ring lag sofort
> beim Öffnen um "Datei auswählen", ohne dass der Nutzer interagiert
> hatte. Ursache: das Datei-Feld ist das erste fokussierbare Element im
> Formular, Base UI fokussiert es beim Öffnen automatisch (Standard-
> verhalten von `DialogPrimitive.Popup`) – bei einem normalen Textfeld
> unauffällig, bei einem nativen Datei-Input-Button aber wie ein
> UI-Bug wirkend. Fix: `initialFocus={false}` auf `DialogContent` in
> `media-upload-dialog.tsx` (Prop wird via `DialogPrimitive.Popup.Props`
> durchgereicht, siehe `ui/dialog.tsx`) – nur für diesen einen Dialog,
> nicht global, da Auto-Fokus auf ein erstes Textfeld in anderen
> Formularen weiterhin erwünscht/üblich ist.

> **Update 2026-08-15 (Datei-Input-Zentrierung, endgültig):** "datei
> auswählen ist nicht mittig" – der vorherige `flex items-center`-Fix
> (siehe oben) reichte nicht: `<input type="file">` rendert Button +
> Label als internen UA-Shadow-Content, dessen vertikale Position vom
> Browser nicht wirklich über `align-items` auf dem Input-Element
> gesteuert wird (`display:flex`/`align-items:center` wurde zwar korrekt
> berechnet, wirkte sich aber nicht auf die Shadow-Content-Position aus).
> Zuverlässiger, altbekannter Trick: `line-height` explizit auf die
> Content-Box-Höhe setzen (`leading-[2.5rem]`, entspricht `h-12` minus
> `py-1`-Padding) statt sich auf Flex-Zentrierung zu verlassen – der
> Browser positioniert den Datei-Button/das Label anhand der Zeilenhöhe,
> nicht anhand von Flex-Alignment. Zusätzlich `file:align-middle` ergänzt.
> Gilt global in `ui/input.tsx`, wirkt sich auf normale Text-Inputs nicht
> sichtbar aus (per Screenshot verifiziert) – bei einzeiligen Feldern mit
> fester Höhe ändert eine größere Zeilenhöhe nichts an der Textposition.
> **Lehre**: `<input type="file">` lässt sich NICHT zuverlässig per
> Flexbox auf dem Input-Element selbst zentrieren (Shadow-Content-
> Layout folgt nicht immer `align-items`) – `line-height` = Content-
> Box-Höhe ist der robustere Weg.
>
> **Zusätzlich (gleicher Anlass)**: Grüner Fokus-Ring erschien beim
> Öffnen des Upload-Popups sofort um "Datei auswählen", ohne Nutzer-
> Interaktion – Base UI fokussiert automatisch das erste fokussierbare
> Element im Dialog, bei einem Datei-Input wirkt das wie ein UI-Bug statt
> wie normales Auto-Fokus-Verhalten. Fix: `initialFocus={false}` auf
> `DialogContent` in `media-upload-dialog.tsx` (nur dort, nicht global).

> **Update 2026-08-15 (Dateityp-Filter als Pillen statt Dropdown):**
> "stelle dateitypen nicht als dropdown, sondern so dar wie auf dem
> bild" – `MediaFilters` zeigte den Dateityp-Filter bisher als
> `<Select>`-Dropdown ("Alle Dateitypen"/"Bild"/"PDF"/... einzeln). Jetzt
> als Pillen-Reihe mit Zähler (1:1 nach Bildvorlage, gleiches visuelles
> Muster wie die bereits bestehenden Tag-Filter-Pillen: aktiv =
> `bg-[#132033]`-gefüllt mit hellem Zähler-Badge, inaktiv = Rahmen mit
> grauem Zähler-Badge). Nutzerentscheidung zum Kategorien-Umfang: nur
> **echte, hochladbare** Kategorien (Alle/Bilder/Video/Dokumente) statt
> der Bildvorlage 1:1 zu übernehmen, die zusätzlich "Audio"/"Archive"
> zeigt – für beide gibt es keinen Upload-Support (`ALLOWED_MIME_TYPES`
> in `media.config.ts`), sie würden also immer "0" anzeigen.
> - **Neuer Zähler-Endpoint** `GET /media/counts?folderId=` (`MediaService#getCounts`,
>   `apps/web/lib/api-server.ts#getMediaCounts`) – bewusst nur nach
>   `folderId` gescoped, nicht zusätzlich nach den übrigen aktiven
>   Filtern (Tag/Größe): die Pillen sollen die Gesamtverteilung im
>   aktuellen Ordner zeigen, nicht "wie viele bleiben nach Filter X übrig".
> - **"Dokumente"-Pille fasst PDF + Office zusammen**: kein neuer echter
>   `MediaCategory`-Wert (der bleibt `image`/`pdf`/`video`/`office`/`other`,
>   u.a. für die Datei-Typ-Icons weiterhin einzeln gebraucht, siehe oben),
>   sondern ein reines Filter-Pseudo-Typ `"document"` nur in
>   `QueryMediaDto`/`MediaService#findAll`, das serverseitig zu
>   `mimeTypesForCategory('pdf') + mimeTypesForCategory('office')`
>   aufgelöst wird.

## Was wurde gebaut

Die Medien-Übersicht (`/dashboard/media`) wurde komplett neu gebaut, 1:1
nach Bildvorlage:

- **Filterleiste neu**: "Alle Dateitypen"-Dropdown und "Nur ungenutzte"
  jetzt als Pillen (`media-filters.tsx`), darunter "NACH TAG FILTERN" +
  farbige Tag-Pillen – nutzt dieselbe `tagDotColor()`-Palette wie die
  Tags-Seite (siehe
  [row-action-icon-buttons.md](../frontend/row-action-icon-buttons.md)),
  damit ein Tag app-weit immer dieselbe Farbe hat. Der bisherige
  Min/Max-Größe-Filter (Freitext-KB-Eingabe) wurde entfernt – kommt in
  der Bildvorlage nicht vor.
- **Ordner-Kacheln neu** (`media-explorer.tsx`): kompakte horizontale
  Karten (Icon + Name + Dateianzahl + ⋮-Menü) statt der bisherigen
  großen Kreis-Icons. Ordner-Icon-Hintergrund nutzt `bg-primary/15`/
  `text-primary` (Marken-Lime, Nutzerkorrektur "nutze unser Grün" –
  ursprünglich amber/orange wie der alte Kreis-Stil).
- **Masonry-Grid statt fester Spalten**: CSS-Columns (`columns-2/3/4`,
  `break-inside-avoid` über `mb-3` auf jeder Kachel) statt
  `grid-cols-*` mit erzwungenem `aspect-square` – Bilder behalten ihr
  natürliches Seitenverhältnis, unterschiedliche Höhen packen sich wie
  bei Pinterest. Datei-Typ-Badge (Dateiendung, z.B. "JPG"/"PDF") oben
  links, immer sichtbar.
- **Hover-Overlay** (Nutzervorgabe, zweiter Nachtrag): beim Hover über
  eine Kachel erscheint unten ein dunkler Farbverlauf mit Dateiname +
  farbigen Tag-Pillen, oben rechts ein Download-Icon-Button
  (`stopPropagation`, damit der Download-Klick nicht zusätzlich die
  Kachel auswählt) – nur `opacity-0`→`opacity-100` per `group-hover`,
  kein zusätzlicher State nötig.
- **Klick auf eine Kachel öffnet die Detailansicht rechts** statt eines
  Popups (`media-detail-panel.tsx`, neu, ersetzt das gelöschte
  `media-preview-dialog.tsx`): großes Vorschaubild, Dateiname,
  Format/Maße/Größe/Hochgeladen/**Verwendet** (neu, siehe unten),
  Tags als farbige Pillen + "+ Tag" (öffnet weiterhin
  `media-tags-dialog.tsx`), "Herunterladen"-Button (voll, lime),
  "Bearbeiten"/"Link kopieren" nebeneinander, Duplizieren/Löschen über
  ein kleines ⋮-Menü oben rechts im Panel.
- **"Bearbeiten" bündelt die bisherigen Einzel-Aktionen** in einem Popup
  (`media-edit-dialog.tsx`, neu, ersetzt das gelöschte
  `media-card-actions.tsx`): Alt-Text-Feld, Ordner-Zeile mit
  "Verschieben"-Button (öffnet `MoveToFolderDialog` als zusätzliche
  Ebene), bei zuschneidbaren Bildern zusätzlich "Zuschneiden"/
  "Fokuspunkt setzen" (öffnen `MediaCropDialog`/`MediaFocalPointDialog`
  ebenfalls als zusätzliche Ebene) – explizite Nutzerentscheidung
  gegenüber der Alternative "nur Alt-Text, Rest bleibt im ⋮-Menü".
- **Neues "Verwendet"-Feld**: `GET /media/:id/usage` (neuer Endpoint,
  `MediaService#getUsage`) zählt, in wie vielen Inhalten das Medium
  referenziert wird – **derselbe** On-Demand-Scan wie `findUnused`
  (`normalizeUrl`/`collectReferencedUrls` wiederverwendet), hier nur auf
  ein einzelnes Medium statt die ganze Bibliothek. Lazy vom
  Detail-Panel nachgeladen (eigener `/api/media/[id]/usage`-Proxy-Route),
  nicht Teil der Haupt-Listenabfrage – zu teuer, um für jede Kachel im
  Voraus zu berechnen.
- **Bewusst entfernt**: Checkbox-Massenauswahl/Sammel-Löschen aus dem
  Grid (`useSelection`/`SelectionToolbar`) – kommt in der Bildvorlage
  nicht vor.
- **Datei-Input-Ausrichtung korrigiert** (Nutzer-Feedback: "Datei
  auswählen"-Button und Platzhaltertext standen nicht auf einer Linie):
  `ui/input.tsx`s Basis-Klasse hat jetzt `flex items-center` – wirkt auf
  **jedes** Input im Projekt (harmlos für normalen Text, war vorher rein
  inline/Baseline-ausgerichtet).

## Warum diese Lösung

- **CSS-Columns statt JS-Masonry-Bibliothek**: "auch mit masonry" ließ
  sich nativ per `columns-*` + `break-inside-avoid` lösen, ohne eine
  neue Abhängigkeit (z.B. `react-masonry-css`) einzuführen – Browser-
  Unterstützung ist hier ausreichend, keine Reflow-Bibliothek nötig.
- **Eigener `/usage`-Endpoint statt Bulk-Vorberechnung**: die
  Haupt-Listenabfrage bleibt schnell, der teure Content-weite Scan
  passiert nur für das eine gerade angeschaute Medium.
- **Bestehende Dialoge (Crop/Fokuspunkt/Verschieben/Tags) wiederverwendet
  statt neu gebaut**: alle vier waren schon als kontrollierte
  `open`/`onOpenChange`-Komponenten vorhanden – `MediaEditDialog` öffnet
  sie einfach als zusätzliche Ebene, keine Logik-Duplizierung.

## Stolpersteine / Besonderheiten

- **Suche-Deep-Link (`?highlight=<id>`) brauchte eigene Anpassung**: die
  alte `MediaGrid` zeigte den Dateinamen sichtbar im Text und konnte ihn
  per `HighlightText` farblich markieren; die neuen Kacheln zeigen den
  Namen nur noch im Hover-Overlay/Detail-Panel. Fix: `useHighlightParam`
  synchronisiert jetzt `selectedId` (öffnet automatisch das Detail-Panel
  des Treffers) statt nur einen Text zu markieren – Render-Zeit-Sync
  (`syncedActiveId`), da `useHighlightParam`s `activeId` beim ersten
  Klick irgendwo auf der Seite automatisch wieder auf `null` zurückfällt
  (siehe dessen eigener Kommentar) und `selectedId` das nicht mit zurücksetzen darf.
- **`hideFolders`-Prop für die "Nur ungenutzte"-Ansicht**: diese Liste
  ist absichtlich ordnerübergreifend – Breadcrumb/Ordner-Kacheln aus
  `MediaExplorer` würden dort keinen Sinn ergeben, daher per Flag
  ausgeblendet statt eine zweite, fast identische Komponente zu bauen.
- **Download-Button im Hover-Overlay braucht `stopPropagation`**: ohne
  das würde ein Klick auf den Download-Link zusätzlich den `onClick`
  des umschließenden `<button>` (Kachel-Auswahl) auslösen.

## Relevante Dateien

- `apps/api/src/media/{media.service,media.controller}.ts` (`getUsage`)
- `apps/web/src/app/api/media/[id]/usage/route.ts` (neu)
- `apps/web/src/app/dashboard/media/page.tsx`
- `apps/web/src/components/media-explorer.tsx`,
  `media-detail-panel.tsx`, `media-edit-dialog.tsx`, `media-filters.tsx`
  (alle neu bzw. komplett ersetzt)
- `apps/web/src/lib/tag-colors.ts` (wiederverwendet aus der
  Tags-Neugestaltung)
- `apps/web/src/components/ui/input.tsx` (`flex items-center`)
- `apps/web/src/components/ui/dialog.tsx` (`min-w-0` auf `DialogHeader`/
  `DialogFooter` – projektweiter Fix, nicht nur Medien-Bereich)
- `apps/web/src/lib/media-type.ts` (`isSvg`, `mediaTypeStyle`,
  `fileExtensionLabel`, Datei-Typ-Icon-Kacheln)
- Gelöscht: `media-grid.tsx`, `media-folder-browser.tsx`,
  `media-card-actions.tsx`, `media-preview-dialog.tsx` (vollständig
  durch die oben genannten neuen Komponenten ersetzt, keine
  verbleibenden Importstellen)

## Offene Punkte

- Keine Massenauswahl/Sammel-Löschen mehr im Haupt-Grid (siehe oben) –
  falls gewünscht, müsste dafür ein neues Interaktionsmuster gefunden
  werden (Bildvorlage zeigt keins).
- "Verwendet" zählt nur `Content`-Referenzen (Rich-Text/Modul-Felder +
  OG-Bild), keine Referenzen aus `AppSettings.companyLogoUrl` – anders
  als `findUnused`, das Company-Logo mit einschließt. Für "in wie vielen
  **Seiten** verwendet" war das bewusst nicht nötig; ließe sich bei
  Bedarf ergänzen.
