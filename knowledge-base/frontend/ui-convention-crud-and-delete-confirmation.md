# UI-Konvention: Jede anlegbare Ressource braucht Bearbeiten + Löschen mit Bestätigung

**Datum:** 2026-08-02, erweitert 2026-08-04
**Betroffene Bereiche:** apps/web (übergreifende Konvention, nicht auf ein
Feature beschränkt)

> **Update 2026-08-16 (Abbrechen-Button überall, einheitlicher Border):**
> "überall bei popup abbrechen hinzufügen. border so nehmen, wie die
> border von aktionen." – app-weiter Sweep über alle ~29
> `DialogContent`-Komponenten in `apps/web/src/components`:
> - **Fehlende Abbrechen-Buttons ergänzt** (14 Dialoge hatten in ihrem
>   `DialogFooter` nur den Submit-Button, keinen Abbrechen daneben):
>   `create-preview-link-dialog`, `navigation-item-dialog`,
>   `media-upload-dialog`, `webhook-dialog` (hatte gar kein
>   `DialogFooter`, nur einen einzelnen Button), `taxonomy-item-dialog`,
>   `role-form-dialog`, `navigation-dialog`, `move-to-folder-dialog`,
>   `media-tags-dialog`, `media-focal-point-dialog`, `media-crop-dialog`,
>   `folder-dialog`, `edit-user-dialog`, `create-user-dialog`. Bei
>   Komponenten mit `onOpenChange`-Prop (kein eigenes `open`/`setOpen`)
>   ruft der Abbrechen-Button `onOpenChange(false)` auf, sonst `setOpen(false)`.
>   Zusätzlich in den Upload-/Link-Tabs von `file-picker-dialog`,
>   `video-picker-dialog`, `image-picker-dialog` (Bibliothek-Tab bleibt
>   unangetastet – reines Durchsuchen ohne Formular, kein Abbrechen
>   nötig).
> - **Border korrigiert**: bereits vorhandene Abbrechen-Buttons nutzten
>   `variant="outline"` mit dem Standard-`--border`-Token
>   (`oklch(0.967 0 0)`, sehr hell/kaum sichtbar) – auf
>   `border-[#D4D4D4]` umgestellt (dieselbe Farbe wie der Bearbeiten-
>   Button in `RowActionButtons`), betroffen: `media-edit-dialog`,
>   `gallery-editor` (Bildunterschrift-Popup), `gallery-dialog`,
>   `faq-question-dialog`, `faq-group-dialog`, `edit-preview-link-dialog`.
> - **Bewusst ausgenommen**: `insert-shared-block-dialog`s "Zurück"-Button
>   (Schritt-zurück in einem 2-Stufen-Formular, kein echtes Abbrechen –
>   ein zusätzlicher dritter Button wäre redundant, Dialog bleibt über
>   X/Backdrop schließbar) und die beiden "Fertig"-Popups in
>   `block-editor-field.tsx` (Baustein-Feld-Bearbeiten, Innen-/
>   Außenabstand) – Änderungen dort wirken sofort live über `onChange`,
>   es gibt keinen separaten Entwurfszustand zum Verwerfen, "Fertig"
>   deckt Speichern+Schließen in einem ab.

> **Update 2026-08-04:** Konvention um Massenauswahl + Sammel-Löschen
> erweitert – gilt jetzt für **jede** Listen-Ansicht (Tabelle oder Grid),
> nicht nur Einzel-Löschen. Details im neuen Abschnitt
> "Massenauswahl-Konvention" unten sowie in
> [bulk-selection-and-delete.md](./bulk-selection-and-delete.md).

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

## Massenauswahl-Konvention (2026-08-04)

Ergänzend zur Einzel-Löschen-Regel gilt jetzt: **jede Listen-Ansicht
(Tabelle oder Grid) bekommt eine Checkbox-Spalte/-Overlay pro Zeile/
Karte plus eine "Alle auswählen"-Checkbox.** Sobald mindestens ein
Element ausgewählt ist, erscheint eine `SelectionToolbar`
(`src/components/selection-toolbar.tsx`) mit Anzahl + Sammel-Löschen-
Button (ebenfalls über `ConfirmDeleteDialog` bestätigt) + "Auswahl
aufheben". Umgesetzt für Inhalte, Medien, Kategorien, Tags, Benutzer,
Rollen und die Content-Versionshistorie – gilt ab sofort auch für jede
**neue** Listen-Ansicht, nicht optional. Ressourcen mit Lösch-
Einschränkungen (Benutzer: nicht die eigene Zeile; Rollen: keine
System-Rollen/keine mit zugewiesenen Usern) bekommen für diese Zeilen
gar keine Checkbox, statt eine deaktivierte anzuzeigen – konsistent
damit, dass der bestehende Einzel-Löschen-Button dort ebenfalls
komplett fehlt statt nur deaktiviert zu sein. Details:
[bulk-selection-and-delete.md](./bulk-selection-and-delete.md).

## Relevante Dateien

- `apps/web/src/components/confirm-delete-dialog.tsx`
- `apps/web/src/components/ui/alert-dialog.tsx`
- `apps/web/src/components/taxonomy-manager.tsx` (erste Anwendung)
- `apps/web/src/components/selection-toolbar.tsx`,
  `src/hooks/use-selection.ts` (Massenauswahl, siehe oben)

## Offene Punkte

- ~~Diese Konvention ist noch nicht überall angewendet, weil die
  Lösch-UI für Content, Medien und Benutzer schlicht noch nicht
  existiert~~ – inzwischen erledigt, alle drei nutzen
  `ConfirmDeleteDialog` (siehe
  [content-edit-delete.md](../content/content-edit-delete.md),
  [media-edit-delete.md](../media/media-edit-delete.md),
  [user-edit-delete.md](./user-edit-delete.md)). Für jede neue Ressource
  mit Lösch-Funktion (z.B. Rollen, siehe
  [rbac-rework.md](../auth/rbac-rework.md)) gilt dieselbe Regel weiterhin
  – das ist Teil der Definition-of-Done, nicht optional.
- ~~Benutzerverwaltung hat aktuell noch gar keine Lösch-Funktion~~ –
  inzwischen erledigt, siehe [user-edit-delete.md](./user-edit-delete.md).
