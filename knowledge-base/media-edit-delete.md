# Medien bearbeiten (Alt-Text) und löschen

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/api (`src/media`), apps/web
(`src/components/media-card-actions.tsx`, `src/app/api/media/[id]/route.ts`)

## Was wurde gebaut

- Backend: `PATCH /media/:id` (nur `alt` editierbar, `UpdateMediaDto`) und
  `DELETE /media/:id` – Letzteres löscht sowohl die DB-Zeile als auch die
  physische Datei unter `apps/api/uploads/` (`fs.unlink`, Dateiname aus dem
  gespeicherten `url`-Feld extrahiert). Beide Endpoints existierten vorher
  gar nicht (siehe [media-upload.md](./media-upload.md), "Offene Punkte").
- Frontend: `MediaCardActions` (pro Grid-Karte in `/dashboard/media`) mit
  zwei Aktionen – Stift öffnet einen kleinen Dialog zum Ändern des
  Alt-Texts, Papierkorb öffnet `ConfirmDeleteDialog` (siehe
  [ui-convention-crud-and-delete-confirmation.md](./ui-convention-crud-and-delete-confirmation.md)).
- Neuer Route Handler `PATCH`/`DELETE /api/media/[id]` (BFF-Proxy, gleiches
  Muster wie überall sonst).

## Warum diese Lösung

- **Nur `alt` editierbar, nicht `filename`/Datei selbst ersetzen**: Der
  Roadmap-Punkt lautet explizit "Alt-Text ändern" – ein Datei-Replace wäre
  ein eigenes, komplexeres Feature (neue Datei hochladen, alte
  aufräumen, evtl. hängende Referenzen in Content) und war nicht gefordert.
- **DB-Zeile vor der physischen Datei löschen**: Falls `unlink` aus
  irgendeinem Grund fehlschlägt (z.B. die Datei wurde bereits manuell
  entfernt), soll das nicht verhindern, dass der Medien-Eintrag aus der
  Bibliothek verschwindet – eine verwaiste Datei auf der Platte ist das
  kleinere Problem als ein Datenbank-Eintrag, der sich nicht löschen lässt.
  Der Fehlerfall wird bewusst verschluckt (`.catch(() => {})`), nicht an
  den Client durchgereicht.

## Stolpersteine / Besonderheiten

- Keine – deckungsgleiches Muster wie bei Content bearbeiten/löschen und
  der `ConfirmDeleteDialog`-Konvention.

## Relevante Dateien

- `apps/api/src/media/media.service.ts` (`update`, `remove`)
- `apps/api/src/media/media.controller.ts`
- `apps/api/src/media/dto/update-media.dto.ts`
- `apps/web/src/components/media-card-actions.tsx`
- `apps/web/src/app/api/media/[id]/route.ts`
- `apps/web/src/app/dashboard/media/page.tsx`

## Offene Punkte

- Benutzer vollständig bearbeiten/löschen ist der letzte verbleibende Punkt
  aus derselben Roadmap-Gruppe – siehe
  [`docs/ROADMAP.md`](../docs/ROADMAP.md) Phase 2.
