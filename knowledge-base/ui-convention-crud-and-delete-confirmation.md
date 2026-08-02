# UI-Konvention: Jede anlegbare Ressource braucht Bearbeiten + Löschen mit Bestätigung

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/web (übergreifende Konvention, nicht auf ein
Feature beschränkt)

## Was wurde gebaut

- Verbindliche Regel für das gesamte Admin-Dashboard: **jede Ressource, die
  über die UI angelegt werden kann, muss auch bearbeitet und gelöscht
  werden können.** Löschen darf nie direkt aus einer Aktion (Klick,
  Swipe) heraus passieren, sondern immer über ein Bestätigungs-Popup mit
  klar getrennten "Bestätigen"/"Abbrechen"-Optionen.
- Dafür neue, geteilte Komponente `ConfirmDeleteDialog`
  (`src/components/confirm-delete-dialog.tsx`): kapselt `AlertDialog` +
  `AlertDialogAction`(destructive)/`AlertDialogCancel`, nimmt `trigger`
  (das auslösende Element), `title`, `description` und eine
  `onConfirm`-Callback entgegen, verwaltet den `isDeleting`-State selbst.
- `alert-dialog.tsx` per shadcn-CLI (`pnpm exec shadcn add alert-dialog`)
  ergänzt – vorher gab es im Projekt nur `Dialog` (nicht speziell für
  destruktive Bestätigungen gedacht).
- Erste Anwendung: `TaxonomyManager` (Kategorien/Tags-Löschen) nutzt jetzt
  `ConfirmDeleteDialog` statt direktem `onClick`-Delete.

## Warum diese Lösung

- Ausdrückliche Vorgabe, nachdem beim Bau der Kategorien/Tags-Verwaltung
  auffiel, dass der Lösch-Button dort ohne jede Rückfrage sofort löschte –
  genau das Muster, das diese Regel verhindern soll.
- Eine geteilte Komponente statt Copy-Paste des AlertDialog-Boilerplates
  an jeder Stelle: das Bestätigungs-Verhalten (Loading-State während des
  Löschens, Button-Varianten, Wording-Konsistenz "Löschen"/"Abbrechen")
  soll überall identisch sein, nicht pro Feature neu erfunden werden.

## Stolpersteine / Besonderheiten

- `AlertDialogTrigger` (Base UI) erwartet über die `render`-Prop ein
  fertiges `React.ReactElement` als Trigger – das eigentliche
  Trigger-Element (z.B. der kleine X-Button im Badge) wird komplett
  durchgereicht, nicht als `children` von `AlertDialogTrigger` verschachtelt
  (gleiches `render`-statt-`asChild`-Pattern wie in
  [frontend-shadcn-base-ui.md](./frontend-shadcn-base-ui.md) beschrieben).

## Relevante Dateien

- `apps/web/src/components/confirm-delete-dialog.tsx`
- `apps/web/src/components/ui/alert-dialog.tsx`
- `apps/web/src/components/taxonomy-manager.tsx` (erste Anwendung)

## Offene Punkte

- **Diese Konvention ist noch nicht überall angewendet, weil die
  Lösch-UI für Content, Medien und Benutzer schlicht noch nicht existiert**
  (siehe [`docs/ROADMAP.md`](../docs/ROADMAP.md) Phase 2: "Content
  bearbeiten … und löschen", "Medien bearbeiten … und löschen"). Sobald
  diese UIs gebaut werden, müssen sie `ConfirmDeleteDialog` verwenden –
  das ist Teil der Definition-of-Done für diese Roadmap-Punkte, nicht
  optional.
- Benutzerverwaltung hat aktuell noch **gar keine** Lösch-Funktion (auch
  nicht ohne Bestätigung) – wenn sie ergänzt wird, gilt dieselbe Regel.
