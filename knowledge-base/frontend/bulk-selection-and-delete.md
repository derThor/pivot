# Massenauswahl + Sammel-Löschen (alle Listen-Ansichten)

**Datum:** 2026-08-04
**Betroffene Bereiche:** apps/api (`src/content`), apps/web
(`src/hooks/use-selection.ts`, `src/components/selection-toolbar.tsx`,
alle sechs Listen-Ansichten + Content-Versionshistorie)

## Was wurde gebaut

- **Backend**: neuer Endpoint `DELETE /content/:id/versions/:versionId`
  (`content:update`-Recht, gleiches Fremd-Version-404-Muster wie
  `rollback()`) – bisher gab es für einzelne `ContentVersion`s gar kein
  Löschen.
- **`useSelection(allIds: string[])`** (neuer Hook,
  `src/hooks/use-selection.ts`): generischer, ressourcenunabhängiger
  `Set<string>`-Auswahl-State (`toggle`, `toggleAll`, `clear`, plus
  abgeleitete `allSelected`/`someSelected`/`count`).
- **`SelectionToolbar`** (neue Komponente): rendert nichts ohne Auswahl;
  bei ≥1 ausgewähltem Element eine Leiste ("N ausgewählt" + "Auswahl
  aufheben" + Sammel-Löschen-Button). Der Löschen-Button nutzt die
  bestehende `ConfirmDeleteDialog` – keine neue Bestätigungs-UI.
- **Checkbox-Spalte/-Overlay + "Alle auswählen"** in allen sechs Listen-
  Ansichten und der Content-Versionshistorie: Tabellen (Content,
  Kategorien, Tags, Benutzer, Rollen) bekommen eine Checkbox-Spalte
  links, das Medien-Grid ein Checkbox-Overlay pro Karte, die
  Versionshistorie eine Checkbox pro Versions-Karte.
- **Vier Server-Component-Seiten in Client-Komponenten extrahiert**:
  `content/page.tsx`, `media/page.tsx`, `users/page.tsx`,
  `roles/page.tsx` hatten die Tabellen-/Grid-JSX bisher direkt inline
  (Server Component, kein Auswahl-State möglich). Jetzt: neue Client-
  Komponenten `content-table.tsx`, `media-grid.tsx`, `users-table.tsx`,
  `roles-table.tsx` übernehmen Rendering + Auswahl, die Page bleibt
  Server Component und lädt nur noch die Daten. `taxonomy-manager.tsx`
  (Kategorien/Tags) und `content-versions-list.tsx` waren bereits Client
  Components – dort wurde die Auswahl direkt ergänzt, keine Extraktion
  nötig.
- **Einschränkungen bei Lösch-Rechten übertragen sich auf die Auswahl**:
  `users-table.tsx` nimmt die eigene Zeile (`isSelf`) gar nicht in die
  auswählbaren IDs auf (kein Checkbox-Rendering dort), `roles-table.tsx`
  entsprechend nur Zeilen mit `!role.isSystem && role.userCount === 0`
  – exakt dieselben Bedingungen, unter denen die bestehenden
  Einzel-Löschen-Buttons in `UserRowActions`/`RoleRowActions` bereits
  ausgeblendet werden.
- **Bulk-Delete-Handler** ruft an allen sieben Stellen denselben
  bestehenden Einzel-`DELETE`-Endpoint der Ressource parallel auf
  (`Promise.all`), kein neuer Bulk-Endpoint nötig (außer dem neuen
  Versions-Lösch-Endpoint, der aber auch einzeln aufgerufen wird).

## Warum diese Lösung

- **Ein generischer Hook statt eigenem State pro Liste**: Die
  Auswahl-Logik (welche IDs sind selektiert, "alle"/"keine"/"einige") ist
  in allen sieben Fällen identisch – nur die Checkbox-Platzierung
  (Tabellenspalte vs. Grid-Overlay vs. Karten-Header) und der
  Löschen-Endpoint unterscheiden sich. `useSelection` kapselt das
  Gemeinsame, die Platzierung bleibt bewusst pro Ansicht individuell
  (kein universelles "SelectableList"-Wrapper-Component, das die
  strukturell unterschiedlichen Layouts über eine gemeinsame Abstraktion
  zwingen würde).
- **`Promise.all` über den bestehenden Einzel-Endpoint statt neuer
  Bulk-DELETE-Endpoints**: Jede Ressource hatte bereits einen
  funktionierenden Einzel-Lösch-Endpoint; ein neuer `POST /resource/
  bulk-delete`-Endpoint pro Ressource hätte nur Code-Duplikation ohne
  echten Zusatznutzen erzeugt (kein Transaktions- oder
  Performance-Vorteil bei den hier üblichen kleinen Mengen).
- **Server-Component-Seiten extrahieren statt komplett auf Client
  Components umstellen**: Die Seiten selbst (Datenladen, Permission-
  Fallback-Anzeige) bleiben Server Components – nur der interaktive Teil
  (Tabelle/Grid mit Auswahl-State) wird ausgelagert. Minimalinvasiv statt
  die ganze Seite client-seitig zu machen.
- **Keine Checkbox statt deaktivierter Checkbox bei nicht löschbaren
  Zeilen**: konsistent mit dem bereits etablierten Muster der
  Einzel-Löschen-Buttons (`UserRowActions`/`RoleRowActions`), die für
  diese Fälle ebenfalls komplett fehlen statt nur deaktiviert zu sein.

## Stolpersteine / Besonderheiten

- Keine nennenswerten – `Checkbox` (Base UI) unterstützt `indeterminate`
  als eigenständiges Prop (nicht Teil von `checked`), passt direkt für
  die "Alle auswählen"-Kopfzeile (`checked={allSelected}
  indeterminate={someSelected}`).

## Relevante Dateien

- `apps/api/src/content/content.service.ts` (`removeVersion`),
  `content.controller.ts`
- `apps/web/src/app/api/content/[id]/versions/[versionId]/route.ts`
  (`DELETE`, neu)
- `apps/web/src/hooks/use-selection.ts`
- `apps/web/src/components/selection-toolbar.tsx`
- `apps/web/src/components/content-table.tsx`, `media-grid.tsx`,
  `users-table.tsx`, `roles-table.tsx` (neu, aus den jeweiligen
  `page.tsx` extrahiert)
- `apps/web/src/components/taxonomy-manager.tsx`,
  `content-versions-list.tsx` (Auswahl direkt ergänzt)
- `apps/web/src/app/dashboard/{content,media,users,roles}/page.tsx`
  (verschlankt)
- `apps/api/test/content-versions.e2e-spec.ts` (drei neue Tests für
  `DELETE /content/:id/versions/:versionId`)

## Offene Punkte

- Auswahl bezieht sich nur auf die aktuell geladene Seite (alle Listen
  laden ohnehin nur eine Seite auf einmal, z.B. `pageSize: 50`) – kein
  "alle N Einträge über alle Seiten auswählen"-Hinweis bei serverseitiger
  Pagination.
- Kein partielles Fehler-Feedback, wenn beim Massenlöschen einzelne
  Requests innerhalb der Charge fehlschlagen – `Promise.all` plus
  abschließendes `router.refresh()`, wie bei den bestehenden
  Einzel-Löschen-Buttons auch (dort wird der Response-Status ebenfalls
  nicht geprüft).
- Die eigentliche Checkbox-/Auswahl-Interaktion im Browser konnte in
  dieser Session nicht visuell getestet werden (kein Browser-Tool
  verfügbar) – Live-Smoketests (curl) bestätigen nur, dass alle
  betroffenen Seiten fehlerfrei rendern und der neue Backend-Endpoint
  korrekt funktioniert.
