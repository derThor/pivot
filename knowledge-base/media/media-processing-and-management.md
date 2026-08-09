# Bildverarbeitung, Dateityp-Erweiterung & Medienverwaltung (Roadmap 2b.7)

**Datum:** 2026-08-08
**Betroffene Bereiche:** apps/api, apps/web, packages/database

## Was wurde gebaut

Alle 11 Punkte aus `docs/ROADMAP.md` Abschnitt 2b.7 in einem Zug:

- **Upload-Pipeline** (`apps/api/src/media/media-image-processing.service.ts`,
  sharp-basiert): Raster-Bilder (jpeg/png/webp) werden beim Upload
  normalisiert (Auto-Rotate anhand EXIF-Orientation, danach EXIF/Metadaten
  verworfen, Downscale-Cap bei 4000px längster Kante) – das Ergebnis
  ersetzt die hochgeladene Datei auf Disk (gleiche URL). Zusätzlich werden
  responsive WebP/AVIF-Varianten bei festen Breakpoints (320/640/1024/1920px,
  nur unterhalb der Quellbreite) generiert und als `MediaVariant`-Zeilen
  gespeichert – abschaltbar über `AppSettings.mediaResponsiveVariantsEnabled`
  (Einstellungen → Zugriff & Funktionen). gif (Animation) und svg (vektoriell)
  bleiben unverändert, `width`/`height` bei svg weiterhin `null`.
- **Zuschneiden** (`POST /media/:id/crop`) + **Fokuspunkt** (`focalX`/`focalY`
  auf `Media`, 0–1 normiert, via `PATCH /media/:id`): Zuschnitt erzeugt
  bewusst ein **neues** Medium statt das Original zu überschreiben (siehe
  „Warum diese Lösung"). Fokuspunkt wirkt nur auf künftig generierte
  Varianten/Zuschnitte, keine Laufzeit-`object-position`-Verdrahtung in
  bestehenden Content-Renderpfaden.
- **Dateityp-Erweiterung**: `ALLOWED_MIME_TYPES` in `media.config.ts` um
  PDF, Video (mp4/webm/quicktime) und Office (Word/Excel/PowerPoint, alt +
  OOXML) erweitert, mit kategoriespezifischen Größenlimits (Bild 10 MB,
  PDF/Office 25 MB, Video 200 MB, geprüft nach dem Schreiben in
  `MediaService.create()`). Vorschau ist bewusst leichtgewichtig/nativ:
  PDF via `<iframe>`, Video via `<video controls>`, Office nur Icon +
  Download-Link (`media-preview-dialog.tsx`) – kein ffmpeg/LibreOffice.
- **Datei einfügen im Rich-Text**: neuer Toolbar-Button (`Paperclip`-Icon)
  öffnet `FilePickerDialog` (kein Typfilter, im Gegensatz zum
  `ImagePickerDialog`), fügt einen Link (Text + Link-Mark, kein HTML-String)
  ein. Beide Picker-Dialoge teilen sich jetzt die Browsing-Logik
  (`media-browser-panel.tsx`).
- **Suche/Filter** (`GET /media?type=&minSize=&maxSize=&tagIds=`): neue
  `MediaTag`-Join-Tabelle nutzt den **bestehenden, gemeinsamen** `Tag`-Pool
  (kein separates Medien-Tag-Modell) – ein Tag ist für Content und Medien
  gleichzeitig nutzbar. Filter sind auf `/dashboard/media` vollständig
  URL-getrieben (`media-filters.tsx`), analog zum bestehenden `?folder=`.
- **Duplizieren** (`POST /media/:id/duplicate`): kopiert die physische
  Datei (nicht nur die URL), damit Original und Kopie unabhängige
  Lebenszyklen haben. Varianten werden für die Kopie neu generiert statt
  kopiert.
- **Erkennung ungenutzter Medien** (`GET /media/unused`): On-Demand-Scan,
  kein dauerhaft gepflegter Index (siehe „Warum diese Lösung"). Markiert
  nur – löscht nie automatisch, nutzt die bestehende Mehrfachauswahl im
  Frontend (Toggle „Nur ungenutzte Medien anzeigen" auf
  `/dashboard/media`, rendert dann `MediaGrid` flach statt
  `MediaFolderBrowser`, da Orphans ordnerübergreifend gesucht werden).

## Warum diese Lösung

- **Zuschneiden non-destruktiv (neues Medium statt Überschreiben):** `Media`
  wird ausschließlich per loser URL referenziert (Content-Module,
  Rich-Text-HTML, SEO-Bild, Logo) – kein Fremdschlüssel. Ein In-Place-
  Überschreiben der Originaldatei würde jede bestehende Verwendung
  rückwirkend und ohne bewusste Nutzerentscheidung ändern. Explizit vom
  Nutzer bestätigt (Alternative „destruktiv" wurde zur Wahl gestellt).
- **Varianten synchron beim Upload, kein Job-Queue-System:** Es existiert
  keine Queue-Infrastruktur (kein BullMQ/Redis-Worker) im Projekt – für
  diesen Funktionsumfang wäre das unverhältnismäßig. Der
  `AppSettings`-Schalter dient als Ausweichventil, falls die
  Upload-Latenz bei vielen/großen Bildern zum Problem wird.
- **"Ungenutzt"-Erkennung als On-Demand-Scan, nicht als Live-Index:** Ein
  laufend aktueller Index müsste jeden Content-Mutationspfad (Create,
  Update, jede Versionierung, Rollback) anfassen. Da es sich um ein
  Report-Feature handelt (keine Live-Zähler-UI), ist der Scan-Ansatz
  einfacher und ausreichend. Durchsucht bewusst nur aktive `Content`-
  Zeilen, keine `ContentVersion`-Historie (Nutzer-Entscheidung – schneller/
  einfacher, Kompromiss: ein nur in einer alten Version referenziertes
  Medium gilt hier als ungenutzt).
- **Medien-Tags = gemeinsamer Pool mit Content-Tags:** nutzt die
  bestehende Tag-Verwaltungsseite/-API sofort mit, statt ein zweites,
  isoliertes Tag-System zu pflegen (Nutzer-Entscheidung).
- **Duplizieren kopiert Bytes, nicht nur die URL:** `remove()` löscht die
  Datei von Disk – ein geteiltes File zwischen zwei `Media`-Zeilen hätte
  inkonsistente Lebenszyklen zur Folge (Löschen der einen Kopie würde die
  andere brechen).

## Stolpersteine / Besonderheiten

- **URL-Normalisierung für die Ungenutzt-Erkennung:** Medien werden an
  zwei unterschiedlichen Stellen in unterschiedlicher Form referenziert –
  Content-Module (`ImageFieldValue.url` etc.) speichern **relative** Pfade
  (`/uploads/xyz.jpg`), Rich-Text-HTML (`<img src>`/`<a href>`, über
  `mediaUrl()` im Frontend erzeugt) dagegen **absolute** URLs
  (`http://localhost:3001/uploads/...`). `normalizeUrl()` in
  `media.service.ts` strippt das Origin vor jedem Vergleich – ohne das
  würden alle Rich-Text-referenzierten Medien fälschlich als „ungenutzt"
  markiert.
- **`react-hooks/static-components`-Lint-Regel:** Ein `const Icon = ...;
  <Icon />`-Pattern (dynamische Icon-Auswahl je Mimetype) wird vom React-
  Compiler-ESLint als „component created during render" geflaggt, obwohl
  `Icon` nur eine stabile Referenz auf eine bestehende Lucide-Komponente
  ist. Umgangen in `media-preview-dialog.tsx` über
  `createElement(mediaTypeIcon(...), { className })` statt JSX-Tag-über-
  Variable.
- **Prisma-Migration mit neuem `@updatedAt`-Feld auf befüllter Tabelle:**
  `updatedAt DateTime @updatedAt` allein schlägt fehl, wenn bereits Zeilen
  existieren (kein Default für Bestandsdaten). Lösung: zusätzlich
  `@default(now())` setzen (`updatedAt DateTime @default(now())
  @updatedAt`) – deckt sowohl Bestandsdaten als auch künftige Updates ab.
- **Windows: `EPERM` beim `prisma generate` während laufendem `pnpm dev`:**
  Der laufende NestJS-Prozess hält die Query-Engine-DLL
  (`query_engine-windows.dll.node`) offen. `pnpm db:generate` schlägt mit
  `EPERM: operation not permitted, rename ...` fehl, solange `nest start
  --watch` (bzw. der von ihm gestartete Kindprozess) läuft. Abhilfe: Dev-
  Server kurz stoppen, generieren, neu starten.
- **`ImageFieldValue` trägt jetzt optional `mediaId`/`variants` mit:**
  nötig, damit `block-field-output.tsx` ein `<picture>` mit WebP/AVIF-
  `srcSet` rendern kann, ohne zur Laufzeit erneut die Medienbibliothek
  abzufragen. Ältere, ohne diese Felder gespeicherte Werte fallen weich
  auf ein einfaches `<img>` zurück (kein Migrations-Zwang für
  Bestandsinhalte).

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`Media.focalX/focalY/updatedAt`,
  neue Modelle `MediaVariant`, `MediaTag`, `AppSettings.mediaResponsiveVariantsEnabled`)
- `apps/api/src/media/media.service.ts`, `media.config.ts`,
  `media.controller.ts`, `media-image-processing.service.ts`,
  `dto/crop-media.dto.ts`, `dto/update-media.dto.ts`, `dto/query-media.dto.ts`
- `apps/web/src/components/media-crop-dialog.tsx`,
  `media-focal-point-dialog.tsx`, `media-tags-dialog.tsx`,
  `media-filters.tsx`, `media-browser-panel.tsx`, `file-picker-dialog.tsx`,
  `media-preview-dialog.tsx`, `media-card-actions.tsx`, `media-grid.tsx`
- `apps/web/src/lib/media-type.ts` (neu, Dateityp-Kategorisierung – muss
  synchron zu `ALLOWED_MIME_TYPES` im Backend gehalten werden),
  `lib/media.ts` (`isCroppableImage`)
- `apps/web/src/components/block-field-output.tsx`,
  `image-picker-dialog.tsx`, `rich-text-editor.tsx` (srcSet/`mediaId`,
  „Datei einfügen")
- `apps/web/src/app/dashboard/media/page.tsx` (Filter- + Unused-Toggle-
  Query-Params), `app/api/media/[id]/crop/route.ts`,
  `app/api/media/[id]/duplicate/route.ts` (neue BFF-Routen)

## Offene Punkte

- Responsive-Breakpoints (320/640/1024/1920px) und Upload-Obergrenzen
  (10/25/200 MB) sind Platzhalter-Werte – es gibt noch keine öffentliche
  Website-Ebene, die reale Zielgrößen vorgibt.
- Keine neuen Seiten-Designer-Blocktypen für PDF/Video (bewusst nicht
  umgesetzt – Rich-Text-Datei-Link deckt die Roadmap-Formulierung
  „auswählen und einbinden" ab, siehe Nutzer-Entscheidung).
- ~~Fokuspunkt hat aktuell keinen sichtbaren Effekt~~ – gelöst am
  2026-08-09, siehe [media-square-thumbnails-and-tiles-block.md](./media-square-thumbnails-and-tiles-block.md)
  (quadratisches Thumbnail als erster Verbraucher).
