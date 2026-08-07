# Kategorien-Zuordnung im Content-Editor

**Datum:** 2026-08-05
**Betroffene Bereiche:** apps/api (`src/content`), apps/web
(`src/components/content-editor-form.tsx`, `content-table.tsx`,
`src/app/dashboard/content/{new,[id]/edit}/page.tsx`)

> **Update 2026-08-06 (Ausgewählte Kategorien als Badges):** Unter dem
> Mehrfachauswahl-Dropdown erscheinen jetzt die ausgewählten Kategorien
> als entfernbare Badges (Name + "×"-Button, `categoryIds.filter(...)`
> bei Klick). Vorher zeigte der Dropdown nur eine Zusammenfassung
> ("3 Kategorien ausgewählt") ohne zu sehen, *welche* – auf
> Nutzerwunsch ergänzt. Abwählen über den Dropdown selbst entfernt die
> Badge automatisch wieder (beide Stellen greifen auf denselben
> `categoryIds`-State zu).

## Was wurde gebaut

- `CreateContentDto` bekommt ein neues optionales Feld
  `categoryIds?: string[]`. `UpdateContentDto` erbt es automatisch über
  `PartialType`.
- `ContentService.create()`: legt bei gesetzten `categoryIds` zusätzlich
  zum Content direkt die passenden `ContentCategory`-Join-Zeilen an
  (verschachtelter Prisma-`create`, eine Query).
- `ContentService.update()`: `categoryIds` wird aus dem DTO
  herausdestrukturiert (darf nicht ungefiltert in
  `prisma.content.update({data: ...dto})` gespreadet werden – kein
  echtes Spaltenfeld). Bei gesetztem `categoryIds` werden **alle**
  bestehenden Zuordnungen gelöscht und die neue Menge komplett neu
  angelegt (`categories: { deleteMany: {}, create: [...] }`) – vollständiger
  Ersatz, kein Merge. Weggelassenes `categoryIds` (PATCH ohne dieses
  Feld) lässt bestehende Zuordnungen unangetastet.
- Neue private `assertCategoriesExist()`: prüft vor dem Schreiben, ob
  alle übergebenen IDs existieren (`category.count({where:{id:{in:...}}})`
  vs. erwartete Länge), sonst `BadRequestException` statt eines rohen
  Prisma-FK-Fehlers.
- `findAll()`/`findOne()` laden jetzt zusätzlich
  `categories: { include: { category: {select:{id,name,slug}}} }` und
  flachen das Join-Tabellen-Ergebnis über eine neue Hilfsfunktion
  `mapContentCategories()` zu einem einfachen `categories: {id,name,slug}[]`
  ab, bevor die Response rausgeht – das Frontend soll die
  Join-Tabellen-Struktur nicht kennen müssen.
- Frontend: `ContentEditorForm` bekommt eine neue Pflicht-Prop
  `categories: CategoryRef[]` (von der aufrufenden Seite geladen über
  `getCategories({pageSize: 100})` – bewusst groß-`pageSize` statt echter
  Pagination, exakt das bereits etablierte Muster für Dropdown-artige
  "gib mir praktisch alles"-Datenquellen, siehe
  [pagination.md](../frontend/pagination.md)). Auswahl-UI: das
  bestehende `Select` (`@base-ui/react/select`) mit dessen nativer
  `multiple`-Prop statt einer selbstgebauten Checkbox-Liste (auf
  Nutzerwunsch nachträglich von einer ursprünglich gebauten
  Checkbox-Liste umgestellt) – `value`/`onValueChange` sind dann
  `string[]` statt `string`, `Select.Value` bekommt eine Render-Funktion
  (`(value: string[]) => ...`) für einen zusammenfassenden Text ("N
  Kategorien ausgewählt") statt einzelner Labels. Eigener lokaler State
  `categoryIds` (nicht Teil des `react-hook-form`-Metadaten-Schemas,
  gleiches Muster wie die dynamischen `ContentType.schema`-Felder, die
  auch außerhalb von RHF in `dataValues` gehalten werden). Beim
  Speichern wird `categoryIds` im Request-Body sowohl beim Anlegen als
  auch beim Bearbeiten mitgeschickt.
- `content-table.tsx` bekommt eine neue Spalte "Kategorien" (Badges,
  `–` bei keiner Zuordnung).

## Warum diese Lösung

- **`deleteMany` + `create` statt Diff/Merge**: Die Checkbox-Liste im
  Editor sendet immer die vollständige, aktuell angehakte Menge – ein
  Merge wäre komplexer (müsste Hinzufügungen und Entfernungen einzeln
  berechnen) für keinen Zusatznutzen, da der Client ohnehin den
  vollständigen Zielzustand kennt. Gleiches "vollständig ersetzen"-Muster
  wie `RolesService.update()` bei Rollen-Permissions.
- **`categoryIds` explizit destrukturiert statt im Update-Spread
  mitgeschleift**: `ContentService.update()` baute die Update-Daten
  bisher über `{...dto, ...}` – ein rohes `categoryIds`-Array wäre als
  unbekanntes Prisma-Argument zur Laufzeit gecrasht, da es kein Feld auf
  `Content` selbst ist (sondern über die Relation `categories` läuft).
- **Validierung vor dem Schreiben (`assertCategoriesExist`)** statt den
  Prisma-Foreign-Key-Fehler durchzureichen: eine falsche/gelöschte
  Kategorie-ID hätte sonst zu einem unspezifischen 500 statt einer
  klaren 400-Fehlermeldung geführt – gleiches Muster wie
  `RolesService.resolvePermissionIds()`.
- **Bestehendes `Select` mit `multiple` statt neuer Komponente**: Base
  UI (`@base-ui/react/select`, worauf `ui/select.tsx` bereits aufbaut)
  unterstützt Mehrfachauswahl nativ über eine `multiple`-Prop auf
  `Select.Root` (Wert wird dann `Value[]`) – kein neuer
  Command-/Popover-Baustein nötig, volle Wiederverwendung des bereits
  im Projekt etablierten Select-Bausteins statt einer eigenen
  Checkbox-Liste oder einer neuen Multi-Select-Komponente.
- **Nur Kategorien, keine Tags**: explizit so angefragt. Das
  Datenmodell (`ContentTag`) wäre strukturell identisch vorhanden und
  ließe sich nach demselben Muster ergänzen, war aber nicht Teil dieses
  Batches.

## Stolpersteine / Besonderheiten

- Keine nennenswerten – die BFF-Route-Handler für `/api/content` und
  `/api/content/[id]` leiten den Request-Body bereits generisch durch,
  keine Änderung dort nötig.

## Relevante Dateien

- `apps/api/src/content/content.service.ts` (`create`, `update`,
  `findAll`, `findOne`, `assertCategoriesExist`, `mapContentCategories`)
- `apps/api/src/content/dto/create-content.dto.ts` (`categoryIds`)
- `apps/web/src/lib/api-server.ts` (`CategoryRef`,
  `ContentListItem.categories`)
- `apps/web/src/components/content-editor-form.tsx`,
  `content-table.tsx`
- `apps/web/src/app/dashboard/content/new/page.tsx`,
  `apps/web/src/app/dashboard/content/[id]/edit/page.tsx`
- `apps/api/test/content.e2e-spec.ts`

## Offene Punkte

- Keine Tag-Zuordnung zu Content (nur Kategorien, siehe oben).
- Keine Filterung der Content-Liste nach Kategorie (nur Anzeige).
- Checkbox-Liste ist bei sehr vielen Kategorien (>100, über die
  `pageSize`-Grenze der Ladeanfrage hinaus) unvollständig – siehe
  bereits dokumentierte Einschränkung in
  [pagination.md](../frontend/pagination.md).
