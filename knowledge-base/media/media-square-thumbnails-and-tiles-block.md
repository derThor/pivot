# Quadratisches Thumbnail (Fokuspunkt-Anker) + Seiten-Designer-Baustein „Kacheln"

**Datum:** 2026-08-09
**Betroffene Bereiche:** apps/api, apps/web, packages/database

## Was wurde gebaut

Erstes festes Bild-Format, das den bisher ungenutzten Fokuspunkt
(`Media.focalX/focalY`, siehe [media-processing-and-management.md](./media-processing-and-management.md))
tatsächlich konsumiert:

- **Backend**: `Media.thumbnailUrl String?` – ein serverseitig
  generiertes, quadratisches 400×400px-Thumbnail pro Bild
  (`MediaImageProcessingService.generateSquareThumbnail()`), zentriert
  auf den Fokuspunkt (Default: Bildmitte). Wird beim Upload, Zuschneiden,
  Duplizieren generiert und bei Fokuspunkt-Änderung (`PATCH
  /media/:id`) neu erzeugt (altes File wird dabei gelöscht). Läuft auch
  für gif (statisches Thumbnail vom ersten Frame – anders als bei den
  Responsive-Varianten, wo Animation die Verarbeitung ausschließt).
  Immer als PNG ausgegeben, unabhängig vom Quellformat (vermeidet
  Format-Fallstricke, z.B. gif-Encoding). Gated durch denselben
  Schalter wie die Responsive-Varianten
  (`AppSettings.mediaResponsiveVariantsEnabled`) – kein zweiter Schalter
  extra dafür.
- **Medienbibliothek-Grid**: Kachel-Vorschau (`media-preview-dialog.tsx`)
  nutzt jetzt `thumbnailUrl` statt des Originals, Seitenverhältnis von
  `4:3` auf `aspect-square` geändert.
- **Neuer Seiten-Designer-Baustein „Kacheln"** (`ModuleType` Slug
  `tiles`, Seed): vier feste `type: "image"`-Felder (`image1`…`image4`),
  **kein neuer Repeater-Feldtyp** – bewusst als feste Anzahl statt
  variabler Liste modelliert (Nutzer-Entscheidung). Wird generisch über
  „mehr als ein Bild-Feld im selben Modul" erkannt
  (`isTilesModule()` in `block-field-output.tsx`), nicht über den Slug –
  funktioniert dadurch automatisch für jedes künftige Modul mit
  mehreren Bild-Feldern.

## Warum diese Lösung

- **Ein Wert (`thumbnailUrl`) statt neuer Tabelle**: anders als die
  Responsive-Varianten (mehrere Breiten × Formate, daher eigene
  `MediaVariant`-Relation) gibt es hier nur genau ein festes Format –
  eine Spalte auf `Media` reicht.
- **Erkennung über Feldanzahl statt Modul-Slug**: `isTilesModule()`
  prüft `contentFields.filter(f => f.type === "image").length > 1`
  statt `moduleType.slug === "tiles"` zu hardcoden – robuster und
  erweiterbar, ohne dass an mehreren Stellen der Slug gepflegt werden
  müsste.
- **Kacheln bekommen keine Drag-Resize-/Float-Kontrollen**: anders als
  bei „Bild + Text" (ein Bild-Feld, frei positionierbar) ergäbe
  individuelles Resizen/Ausrichten pro Kachel innerhalb eines festen
  2×2-Rasters keinen Sinn. Der Block-Editor rendert für Module mit
  mehreren Bild-Feldern deshalb einen komplett eigenständigen
  Rendering-Zweig (eigenes Grid, Hover-Overlay „Ersetzen" pro Kachel)
  statt `EditableImageField` wiederzuverwenden – bestehende Module
  (Bild, Bild+Text, …) bleiben dadurch unangetastet, null Regressions-
  Risiko.

## Stolpersteine / Besonderheiten

- **Die Block-Toolbar (Ausrichtung/„Ersetzen" oben am Block) hätte ohne
  Anpassung auch für Kacheln funktioniert – aber falsch**: `const
  imageField = contentFields.find(f => f.type === "image")` liefert für
  jedes Modul mit *mindestens einem* Bild-Feld einen Treffer (das erste
  von vieren bei Kacheln), nicht nur bei genau einem. Ohne den
  zusätzlichen `!isTiles`-Guard in `block-editor-field.tsx` hätte die
  Toolbar einen scheinbar funktionierenden, aber nur auf `image1`
  wirkenden Ausrichtungs-Dropdown gezeigt – irreführend, da die anderen
  drei Kacheln davon unberührt geblieben wären.
- **`resolveBlockLayout()` ignoriert `instance.layout` für Module mit
  Bild-Feld(ern) + mehreren Feldern vollständig** (liefert immer
  `{align:"none", width:100}`, bevor `layout` überhaupt geprüft wird).
  Ein Whole-Block-Resize-Handle für Kacheln anzuzeigen wäre daher
  wirkungslos gewesen (das Ändern von `instance.layout` hätte nichts
  bewirkt) – deshalb bewusst auch keine Block-Layout-Kontrollen für
  Kacheln (`hasBlockLayoutControls` bleibt an `imageField` gekoppelt,
  unverändert).
- **`prisma migrate dev` seedet nicht, wenn "Already in sync" gemeldet
  wird** (keine neue Migration) – nach reinen `seed.ts`-Änderungen ohne
  Schema-Änderung muss der Seed explizit über `pnpm --filter
  @pivot/database seed` erneut ausgeführt werden.
- **Windows `EPERM` beim `prisma generate`** (siehe auch
  [media-processing-and-management.md](./media-processing-and-management.md)):
  trat hier erneut auf, weil eine reine `seed.ts`-Änderung den laufenden
  `nest start --watch`-Prozess nicht neu kompiliert (nur `apps/api/src`
  wird beobachtet) – die Query-Engine-DLL blieb dadurch gesperrt, bis
  der API-Kindprozess manuell beendet wurde (startet unter `nest --watch`
  danach automatisch neu).
- **E2E-Tests können keine Datei per HTTP von `/uploads/...` abrufen** –
  `useStaticAssets()` wird nur in `main.ts` registriert, nicht im
  Test-Bootstrap (`test/setup-app.ts`). Für Assertions auf generierte
  Dateien (z.B. Thumbnail-Dimensionen) muss direkt von Disk gelesen
  werden (`UPLOAD_DIR` aus `media.config.ts`), nicht per `supertest`-GET.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`Media.thumbnailUrl`),
  `prisma/seed.ts` (ModuleType „Kacheln")
- `apps/api/src/media/media-image-processing.service.ts`
  (`generateSquareThumbnail`, `THUMBNAIL_SIZE`, `isThumbnailable`),
  `media.service.ts` (`generateThumbnailIfEnabled`, Verdrahtung in
  `processUpload`/`crop`/`duplicate`/`update`/`remove`)
- `apps/web/src/components/block-field-output.tsx` (`isTilesModule`,
  `TilesGridOutput`, `ImageFieldValue.thumbnailUrl`)
- `apps/web/src/components/block-editor-field.tsx` (Kacheln-Render-Zweig,
  `!isTiles`-Guard an der Block-Toolbar)
- `apps/web/src/components/media-preview-dialog.tsx`,
  `apps/web/src/app/preview/[token]/page.tsx`,
  `apps/web/src/components/content-versions-list.tsx`
- `apps/api/test/media-processing.e2e-spec.ts`

## Nachtrag 2026-08-09: Fokuspunkt auch für „Bild"/„Bild + Text"

Ursprünglich bewusst nur auf das quadratische Thumbnail beschränkt (siehe
oben). Nutzer-Feedback nach dem ersten Test: bei den bestehenden
Einzelbild-Bausteinen („Bild", „Bild + Text") wurde der Fokuspunkt
nicht angewendet, das Bild blieb an der Bildmitte zugeschnitten. Nachträglich
ergänzt:

- `ImageFieldValue.focalX/focalY` (analog zu `mediaId`/`variants`/
  `thumbnailUrl` beim Auswählen im Picker mitgespeichert).
- Neuer Export `focalObjectPosition(img)` in `block-field-output.tsx` →
  CSS `object-position`-Wert (`"{x*100}% {y*100}%"` oder `undefined`).
  Angewendet auf das `<img style={{objectPosition: ...}}>` sowohl in
  `BlockFieldOutput` (Vorschau/Live/Versionshistorie) als auch in
  `EditableImageField` (Editor-Canvas, WYSIWYG-Parität).

**Wichtige Einschränkung**: der Fokuspunkt wird wie `thumbnailUrl` als
Snapshot **zum Auswahlzeitpunkt** in die Content-JSON geschrieben, nicht
live nachgeladen. Ein Bild, das bereits vor dieser Änderung (oder vor
dem Setzen des Fokuspunkts) in einen Block gezogen wurde, übernimmt den
aktuellen Fokuspunkt erst, wenn es im Editor erneut ausgewählt
("Ersetzen") wird.

## Offene Punkte

- Nur ein festes Format (Quadrat, 400px) – falls später weitere Formate
  (z.B. 16:9 „wide") gebraucht werden, siehe Kacheln-Erkennungsmuster
  als Vorbild für eine generische Lösung statt Einzelfall-Code.
- „Kacheln" hat eine feste Anzahl (4) Bild-Slots, keine variable Liste –
  bewusste Vereinfachung (Nutzer-Entscheidung), ein Repeater-Feldtyp im
  Baustein-Schema-System wäre ein deutlich größerer Eingriff.
- Fokuspunkt-Snapshot in Content-JSON wird bei nachträglicher
  Fokuspunkt-Änderung nicht rückwirkend für bereits platzierte Bilder
  aktualisiert (siehe Nachtrag oben) – für eine "live" Lösung müsste
  `mediaId` statt eines Snapshots zur Laufzeit aufgelöst werden
  (größerer Eingriff, betrifft auch `variants`/`thumbnailUrl`).
