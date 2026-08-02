# Medien-Upload: lokale Speicherung + Medien-Bibliothek

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/api (`src/media`, `src/main.ts`), apps/web
(`src/app/dashboard/media`, `src/components/media-upload-dialog.tsx`,
`src/app/api/media/route.ts`)

## Was wurde gebaut

- Neues Backend-Modul `media`: `POST /media` (multipart/form-data, Feld
  `file` + optionales `alt`) und `GET /media` (paginierte Liste, wie
  `ContentService.findAll`).
- Dateien landen lokal unter `apps/api/uploads/` (nicht Teil des Git-Repos,
  siehe `.gitignore`), mit zufällig generiertem Dateinamen
  (`randomUUID() + Original-Extension`) – der Original-Dateiname wird nur
  als `filename`-Feld in der DB gespeichert, nicht für den Pfad verwendet.
- `fileFilter` erlaubt nur eine Whitelist an Bild-MIME-Types (jpeg, png,
  gif, webp, svg), `limits.fileSize` deckelt auf 10 MB.
- Statisches Ausliefern über `app.useStaticAssets(UPLOAD_DIR, { prefix:
  '/uploads' })` in `main.ts` – **vor** `app.use(helmet())` registriert
  (siehe Stolpersteine).
- Frontend: `/dashboard/media` als Grid (Server Component,
  `getMediaList()`), Upload-Dialog mit nativem `<input type="file">` +
  Alt-Text-Feld, Submit als `FormData` über neuen Route Handler
  `POST /api/media`. Dashboard-Statistik "Medien" nutzt jetzt ebenfalls
  echte Zahlen (`getMediaList({ pageSize: 1 }).meta.total`) statt der
  bisherigen festen "0".
- `mediaUrl()`-Helper in `lib/api-server.ts` baut aus dem relativ
  gespeicherten `url`-Feld (`/uploads/<datei>`) die absolute Browser-URL
  (API-Origin + Pfad), da Bilder direkt vom Backend-Origin (Port 3001)
  geladen werden, nicht über den Next.js-Server geproxyt.

## Warum diese Lösung

- **Lokale Disk-Speicherung statt S3** für den MVP: Roadmap erlaubt explizit
  "lokal oder S3-kompatibel", lokal ist ohne zusätzliche Infrastruktur
  sofort nutzbar. S3-Kompatibilität ist ein reiner Austausch der
  `multer`-Storage-Engine, kein Breaking Change am Rest des Moduls.
- **Zufälliger Dateiname statt Original-Dateiname auf Disk**: verhindert
  Kollisionen und Path-Traversal-Angriffe über manipulierte Dateinamen
  (z.B. `../../etc/passwd`); der Original-Name bleibt für die Anzeige in
  der DB erhalten.
- **`useStaticAssets` statt eigenem Download-Controller**: Bilder werden
  sehr häufig geladen (jede Grid-Ansicht), ein Express-Static-Handler ist
  dafür effizienter (Streaming, Caching-Header) als ein Controller, der pro
  Request die Datei manuell liest.
- **Bild-Direktzugriff vom Frontend statt Next.js-Proxy**: einfacher, kein
  zusätzlicher Route Handler pro Bild nötig; funktioniert für `<img>`-Tags
  ohne CORS-Probleme (CORS gilt nur für Script-lesbare Cross-Origin-Zugriffe
  wie `fetch`/`XHR`/Canvas-Pixel-Zugriff, nicht für einfaches Laden von
  `<img src>`).

## Stolpersteine / Besonderheiten

- **Registrierungsreihenfolge in `main.ts` ist sicherheitsrelevant**:
  `app.useStaticAssets(...)` muss **vor** `app.use(helmet())` aufgerufen
  werden. Helmets Default für `Cross-Origin-Resource-Policy` ist
  `same-origin` – würde dieser Header auf `/uploads`-Responses landen,
  blockiert der Browser das Einbetten der Bilder vom Frontend-Origin
  (Port 3000) per `<img>`, selbst ohne CORS-Fehler im Netzwerk-Tab (stiller
  Fehlschlag, Bild bleibt einfach leer). Da Express-Middleware in
  Registrierungsreihenfolge läuft und `express.static` bei einem Treffer
  die Response direkt sendet (kein `next()`), erreicht der Request bei
  dieser Reihenfolge `helmet()` gar nicht erst.
- **`@types/multer` fehlte** im Projekt (nur die Laufzeit-Bibliothek war
  transitiv über `@nestjs/platform-express` vorhanden) – ohne das Paket
  gibt es keinen `Express.Multer.File`-Typ für `@UploadedFile()`. Als
  Dev-Dependency in `apps/api` ergänzt.
- Unter Windows/Git-Bash bricht `curl -F "file=@/tmp/datei"` mit Fehler 26
  ab (MSYS-Pfadübersetzung kommt mit dem `@pfad;type=...`-Format nicht
  klar) – manuelles Testen braucht einen Windows-Pfad
  (`cygpath -w /tmp/datei`). Reine Testumgebungs-Notiz, betrifft die
  Anwendung selbst nicht.
- Bild-Dimensionen (`Media.width`/`height` im Prisma-Schema) werden aktuell
  **nicht** befüllt (bleiben `null`) – dafür bräuchte es eine
  Bildverarbeitungs-Bibliothek (z.B. `image-size`), die bewusst nicht
  ergänzt wurde, um keine Abhängigkeit für ein Nice-to-have einzuführen.

## Relevante Dateien

- `apps/api/src/media/*`
- `apps/api/src/main.ts`
- `apps/api/.gitignore` bzw. Root-`.gitignore` (`apps/api/uploads/`)
- `apps/web/src/app/dashboard/media/page.tsx`
- `apps/web/src/components/media-upload-dialog.tsx`
- `apps/web/src/app/api/media/route.ts`
- `apps/web/src/lib/api-server.ts` (`getMediaList`, `mediaUrl`)

## Offene Punkte

- Bearbeiten (Alt-Text) und Löschen sind inzwischen umgesetzt, siehe
  [media-edit-delete.md](./media-edit-delete.md).
- Keine Bild-Dimensionen (`width`/`height` bleiben `null`).
- S3-kompatible Storage-Engine ist vorbereitet (austauschbare
  `multer.diskStorage`), aber nicht implementiert.
