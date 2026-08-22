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

## Update 2026-08-20: Name im Dialog-Titel kürzen + Papierkorb-vs.-endgültig-Wording

Nutzer-Bugreport per Screenshot: ein langer Dateiname
(„Merkzettel_Vorstellungsgespraech_KDO_Wessels_2.docx") brach im
Dialog-Titel auf zwei Zeilen um – zuvor mit `break-words` "gelöst"
(sprengte nicht mehr die Dialogbreite, sah aber weiterhin unschön aus).
Nutzervorgabe, nachdem der eigentliche Ort geklärt war: "kürze bei zu
langen namen mit ... ab", danach "mach das global bei allen popups".

- Neue Utility `truncateMiddle(text, maxLength = 40)`
  (`src/lib/utils.ts`) – kürzt in der Mitte mit `…`, damit bei
  Dateinamen die Endung (`.docx` etc.) erhalten bleibt. An **allen** 18
  Fundstellen ergänzt, die einen Namen/Dateinamen/Titel in einen
  `ConfirmDeleteDialog`-`title` interpolieren (Content, Medien,
  Kategorien, Tags, Galerien, FAQ-Gruppen, globale Module, Rollen,
  Navigationen/-punkte, Firmenstandorte, Webhooks, Vorschau-Links,
  Ordner, Benutzer (deaktivieren/löschen), DSR-Einträge).
- `break-words` in `alert-dialog.tsx` bleibt als Sicherheitsnetz
  bestehen (falls irgendwo mal ein Titel ohne `truncateMiddle`
  gebaut wird), ist aber nicht mehr die primäre Lösung – Kommentar
  entsprechend aktualisiert.
- **Direkt im Anschluss, gleicher Bugreport-Kontext**: Nutzer meldete,
  der Erfolgs-Toast beim Medien-Löschen suggeriere "endgültig gelöscht",
  obwohl Medien immer erst in den Papierkorb wandern ("korrigieren...
  wenn nötig, überall korrigieren, wo es falsch ist"). Vollständiger
  Audit aller `ConfirmDeleteDialog`-`description`-Texte gegen das
  Schema (`deletedAt`-Feld = Papierkorb-fähig): **Content, Media,
  Category, Tag sowie `GlobalModule`** (das gemeinsame Modell hinter
  Galerien/FAQ-Gruppen/echten globalen Modulen, siehe
  `schema.prisma`-Kommentar bei `GlobalModule.deletedAt`) haben
  `deletedAt` und mussten "wird in den Papierkorb verschoben..." statt
  "kann nicht rückgängig gemacht werden" sagen – war zu diesem
  Zeitpunkt bereits überall korrekt umgesetzt. Alle anderen Ressourcen
  (Rollen, Webhooks, Navigationen/-punkte, Firmenstandorte,
  Vorschau-Links, Content-Versionen, Benutzer-Anonymisierung,
  DSR-Log-Einträge, einzelne FAQ-Fragen [liegen als JSON in
  `GlobalModule.values`, kein eigenes Papierkorb-fähiges Modell]) haben
  **kein** `deletedAt` und löschen tatsächlich sofort endgültig – deren
  "kann nicht rückgängig gemacht werden"-Wording ist korrekt und bleibt
  unverändert. Faustregel für künftige Lösch-Dialoge: Text richtet sich
  danach, ob das Prisma-Modell ein `deletedAt`-Feld hat, nicht danach,
  wie "wichtig" die Ressource wirkt.

## Relevante Dateien

- `apps/web/src/components/confirm-delete-dialog.tsx`
- `apps/web/src/components/ui/alert-dialog.tsx`
- `apps/web/src/components/taxonomy-manager.tsx` (erste Anwendung)
- `apps/web/src/components/selection-toolbar.tsx`,
  `src/hooks/use-selection.ts` (Massenauswahl, siehe oben)
- `apps/web/src/lib/utils.ts` (`truncateMiddle`, siehe Update 2026-08-20)

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
