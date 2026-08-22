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
  [ui-convention-crud-and-delete-confirmation.md](../frontend/ui-convention-crud-and-delete-confirmation.md)).
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

## Nachtrag 2026-08-20: Papierkorb-Dateien blieben unter alter URL herunterladbar

Nutzer-Bugreport (über die Drittlandtransfer-SCC-Vorlage in der
Datenschutz-Seite): eine in den Medien-Papierkorb verschobene Datei war
über ihre alte `/uploads/...`-URL weiterhin unauthentifiziert abrufbar,
weil `remove()` bisher nur `deletedAt` setzte, die physische Datei aber
unverändert in `UPLOAD_DIR` liegen ließ (per `useStaticAssets` komplett
ungeschützt servierbar). Fix: neues Geschwister-Verzeichnis `TRASH_DIR`
(`apps/api/uploads-trash/`, außerhalb des Static-Serving-Prefixes) –
`remove()` verschiebt Hauptdatei+Varianten+Thumbnail dorthin,
`restore()` zurück, `permanentDelete()` löscht von dort. Zusätzlich
filtert `SettingsService.getPublic()` die SCC-Vorlagen-Referenz jetzt
nach `deletedAt: null`, damit der Download-Button bei einer Papierkorb-
Datei sauber verschwindet statt auf einen toten Link zu zeigen. Details:
[ui-convention-crud-and-delete-confirmation.md](../frontend/ui-convention-crud-and-delete-confirmation.md)
(Namenskürzung im selben Bugreport-Kontext).

## Stolpersteine / Besonderheiten

- Keine – deckungsgleiches Muster wie bei Content bearbeiten/löschen und
  der `ConfirmDeleteDialog`-Konvention.

## Relevante Dateien

- `apps/api/src/media/media.service.ts` (`update`, `remove`)
- `apps/api/src/media/media.config.ts` (`TRASH_DIR`, siehe Nachtrag 2026-08-20)
- `apps/api/src/settings/settings.service.ts` (`getPublic()`, SCC-Vorlagen-Filter)
- `apps/api/src/media/media.controller.ts`
- `apps/api/src/media/dto/update-media.dto.ts`
- `apps/web/src/components/media-card-actions.tsx`
- `apps/web/src/app/api/media/[id]/route.ts`
- `apps/web/src/app/dashboard/media/page.tsx`

## Offene Punkte

- ~~Benutzer vollständig bearbeiten/löschen ist der letzte verbleibende
  Punkt aus derselben Roadmap-Gruppe~~ – inzwischen erledigt, siehe
  [user-edit-delete.md](../frontend/user-edit-delete.md).
