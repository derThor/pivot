# Ordner in der Medienbibliothek

**Datum:** 2026-08-04
**Betroffene Bereiche:** apps/api (`src/media-folders`, `src/media`),
apps/web (`src/components/media-folder-browser.tsx`,
`folder-dialog.tsx`, `move-to-folder-dialog.tsx`, `image-picker-dialog.tsx`)

> **Update 2026-08-06 (Icon-Kachel-Redesign, Badges/Menü als Overlay):**
> Ordner-Kacheln in der Medienbibliothek (`media-folder-browser.tsx`)
> nach Referenzbild neu gestaltet: großes, farbiges Ordner-Icon
> (`Folder` aus lucide-react mit `fill="currentColor"` statt nur
> Outline, in einer `size-20`-Kachel mit
> `bg-gradient-to-br from-amber-400 to-orange-500`) statt der bisherigen
> kleinen Outline-Icon+Text-Zeile. Name steht jetzt zentriert **unter**
> dem Icon statt daneben. Die Anzahl-Badges
> (`folder.mediaCount`/`folder.childCount`) und das Kebab-Menü
> (`FolderTileMenu`) liegen jetzt **direkt auf dem Icon** statt in einer
> eigenen Zeile/Ecke der Kachel: Menü oben rechts
> (`absolute -top-2 -right-2`, Trigger auf eine kleine runde
> `bg-background/90`-Chip mit Ring/Schatten umgestylt, damit er auf dem
> farbigen Icon sichtbar bleibt), Medien-Anzahl unten links, Unterordner-
> Anzahl unten rechts (beide `absolute -bottom-2`, `border-2
> border-background` als "Ausstanz"-Effekt gegen das Icon). Die äußere
> Karte (`bg-card p-4 shadow-card`) wurde entfernt – die Kachel besteht
> jetzt nur noch aus Icon + Name, kein umschließender Kartenrahmen mehr
> (näher am Referenzbild, wirkt luftiger im Grid). Grid dadurch auf mehr,
> kleinere Spalten umgestellt (`grid-cols-3` bis `xl:grid-cols-8` statt
> `grid-cols-2` bis `xl:grid-cols-6`), da die Kacheln jetzt schmaler
> sind. Auf Nutzerwunsch ("überall diese ordner einfügen") identisch
> (kompakter skaliert: `size-14` statt `size-20`, kleinere Badges, ohne
> Options-Menü) auch in `image-picker-dialog.tsx` übernommen – das war
> die einzige weitere Stelle im Projekt, an der Ordner als Icon-Kacheln
> mit Anzahl-Badges dargestellt werden (per Grep nach
> `mediaCount`/`childCount`-Verwendung geprüft; `move-to-folder-dialog.tsx`
> zeigt Ordner nur als eingerücktes Dropdown ohne Icon-Kacheln und war
> daher nicht betroffen).

> **Update 2026-08-04 (kaskadierendes Löschen):** Löschen eines
> nicht-leeren Ordners ist jetzt erlaubt statt mit 400 abgelehnt zu
> werden – dabei werden alle enthaltenen Unterordner (rekursiv) und
> Medien (inkl. Datei von Disk) automatisch mitgelöscht. Das Dropdown-
> Item "Löschen" ist dafür nicht mehr `disabled`, stattdessen bekommt
> `ConfirmDeleteDialog` bei nicht-leeren Ordnern einen deutlich
> schärferen Warntext. Details siehe "Kaskadierendes Löschen" unten.

> **Update 2026-08-04:** Ordner-Kacheln (Medienbibliothek + Bild-Picker)
> zeigen jetzt Badges mit der Anzahl enthaltener Medien und – falls
> vorhanden – Unterordner (`folder.mediaCount`/`folder.childCount`,
> beide kamen bereits aus `GET /media-folders`, nur bisher ungenutzt im
> UI). Icon-only-Badges (kein Text-Label) in einer eigenen Zeile unter
> dem Ordnernamen, nebeneinander. In der Medienbibliothek sitzen
> Umbenennen/Löschen-Button dafür jetzt oben (`items-start` statt
> `items-center` auf der Kachel), auf Höhe des Namens statt vertikal
> zwischen Name und Badges zentriert. Die beiden Buttons wurden danach
> zu einem Dropdown-Menü hinter einem einzelnen "Weitere Optionen"-Icon
> (`MoreVertical`, Kebab-Menü statt Stift – ein Bearbeiten-Icon wäre
> irreführend gewesen, da das Menü auch Löschen enthält) zusammengefasst
> (neue Komponente `folder-tile-menu.tsx`) – Details siehe
> "Umbenennen/Löschen als Overlay" unten.

> **Update 2026-08-06 (Systemordner):** Neues Feld
> `MediaFolder.isSystem` (Boolean, Default `false`). Systemordner sind
> vor Löschen geschützt (`MediaFoldersService.remove()` wirft 400,
> unabhängig davon ob leer oder nicht – anders als der normale
> "leer/nicht leer"-Unterschied bei regulären Ordnern, siehe unten).
> Genutzt für einen per Seed automatisch angelegten Root-Ordner "Logo"
> (`packages/database/prisma/seed.ts`), in den die Sidebar-Logo-Uploads
> aus den Einstellungen automatisch einsortiert werden – Details siehe
> [settings-and-password-policy.md](../auth/settings-and-password-policy.md).
> Frontend: `FolderTileMenu` deaktiviert den "Löschen"-Eintrag für
> Systemordner (`folder.isSystem`), exakt dasselbe Schutzmuster wie
> `RoleRowActions` für `role.isSystem`.

## Was wurde gebaut

- Neues Backend-Modul `media-folders`: `GET /media-folders` (liefert
  **alle** Ordner flach mit `parentId` + `_count` für Medien/
  Unterordner – der Client baut Baum/Breadcrumb selbst daraus auf,
  gleiches "alles laden, Frontend strukturiert"-Muster wie bei Rollen),
  `POST`/`PATCH`/`DELETE /media-folders/:id`. Verschachtelte Ordner über
  `parentId` (selbstreferenzierende `MediaFolder`-Relation).
  Rechte: keine neue Permission – nutzt die bestehenden
  `media:create`/`update`/`delete`, da Ordner Teil der Medienverwaltung
  sind.
- `Media` bekommt `folderId String?` (nullable = Root-Ebene). `GET
  /media` bekommt einen neuen optionalen `folderId`-Filter: weggelassen
  = unverändert alle Medien (wichtig für die Dashboard-Statistik, die
  weiterhin die Gesamtzahl über alle Ordner braucht), `"root"` = nur
  Medien ohne Ordner, sonst = genau dieser Ordner. "Verschieben" läuft
  über den bereits bestehenden `PATCH /media/:id`-Endpoint
  (`UpdateMediaDto` um `folderId?: string | null` erweitert) – kein
  neuer Endpoint nötig.
- Frontend-Navigation: Breadcrumb + Drill-down (Ordner-Kachel anklicken
  → man ist "in" diesem Ordner) statt permanenter Baum-Sidebar –
  einfacher, deckt Verschachtelung trotzdem vollständig ab. Neue
  Komponente `media-folder-browser.tsx` (ersetzt die bisherige direkte
  `MediaGrid`-Einbindung in `/dashboard/media`): Breadcrumb, Ordner-
  Kacheln der direkten Unterordner (mit Umbenennen/Löschen), "Neuer
  Ordner"-Button, darunter `MediaGrid` für die Dateien direkt in diesem
  Ordner (keine rekursive Anzeige verschachtelter Inhalte). Aktueller
  Ordner steckt im URL-Query-Param `?folder=<id>`.
- **Verschieben** (einzeln + Massenauswahl): neue, wiederverwendete
  Komponente `move-to-folder-dialog.tsx` (Ordner-`<Select>`, PATCH pro
  Medium). `MediaCardActions` bekommt eine dritte Aktion dafür,
  `SelectionToolbar` bekommt einen neuen optionalen `children`-Slot
  (bewusst generisch – der Slot weiß nichts von "Ordnern", nur
  `MediaGrid` füllt ihn mit dem Verschieben-Button).
- **`ImagePickerDialog`** (Bild-Picker im Rich-Text-Editor) bekommt
  dieselbe Breadcrumb+Kacheln-Navigation im Tab "Aus Medienbibliothek"
  (eigener lokaler `currentFolderId`-State, lädt `GET /media-folders`
  zusätzlich zur Medienliste beim Öffnen, filtert client-seitig) sowie
  denselben Ordner-`<Select>` im Tab "Neu hochladen" (vorbelegt mit dem
  gerade aktiven Ordner aus dem anderen Tab).
- `lib/media-folders.ts` (neu, framework-unabhängige reine Funktionen):
  `getFolderChildren()`, `getFolderBreadcrumb()`,
  `getIndentedFolderOptions()` – von `media-folder-browser.tsx`,
  `image-picker-dialog.tsx`, `media-upload-dialog.tsx` und
  `move-to-folder-dialog.tsx` gemeinsam genutzt statt viermal
  dupliziert.

## Warum diese Lösung

- **Kein DB-`@@unique([parentId, name])`**: Postgres behandelt `NULL`
  in Unique-Constraints als paarweise verschieden – das würde doppelte
  Root-Ordner-Namen nicht verhindern. Stattdessen Namenskollisions-
  Prüfung auf Anwendungsebene (`findFirst` + `ConflictException`),
  exakt das bereits etablierte Muster aus
  `CategoriesService`/`TagsService`.
- **Kaskadierendes Löschen statt Blockieren bei nicht-leerem Ordner**
  (Entscheidung 2026-08-04, ersetzt die ursprüngliche 400-Ablehnung):
  explizit gewünschtes Verhalten – ein Ordner mit Inhalt soll löschbar
  sein, dafür aber unmissverständlich vorher gewarnt werden. Anders als
  bei `RolesService.remove()` (System-Rolle/zugewiesene User bleiben
  hart blockiert, weil sie andere Datensätze referenzieren, die nicht
  einfach mitgelöscht werden dürfen) sind Ordnerinhalte hier reine
  Eigentümer-Beziehung – der Ordner "besitzt" seine Medien/Unterordner,
  es gibt keinen fremden Verweis, der dabei verwaist. Details siehe
  "Kaskadierendes Löschen" unten.
- **Zyklus-Schutz beim Verschieben**: ohne Prüfung könnte ein Ordner in
  einen eigenen Nachfahren verschoben werden, was einen unerreichbaren/
  inkonsistenten Teilbaum erzeugen würde (Elternkette, die nie zur
  Root-Ebene zurückfindet). Ahnenkette des neuen Elternordners
  hochlaufen und auf die eigene ID prüfen.
- **Keine neue Permission für Ordner**: Ordner sind untrennbar Teil der
  Medienverwaltung – eine eigene `media-folders:manage`-Berechtigung
  hätte nur zusätzliche Rechte-Katalog-Komplexität ohne echten
  Trennungsbedarf erzeugt (wer Medien anlegen/bearbeiten/löschen darf,
  soll auch Ordner dafür verwalten dürfen).
- **`folderId`-Filter opt-in statt Default-Root**: `GET /media` ohne
  `folderId` bleibt absichtlich unverändert (alle Medien), damit die
  bestehende Dashboard-Statistik (`getMediaList({pageSize:1})`) nicht
  bricht – sie erwartet weiterhin die Gesamtzahl über alle Ordner.

## Umbenennen/Löschen als Overlay (2026-08-04)

- Statt zwei permanent sichtbaren Icon-Buttons (Umbenennen/Löschen) auf
  jeder Ordner-Kachel gibt es jetzt **einen** Icon-Button mit
  Kebab-Icon (`MoreVertical` aus `lucide-react`), der ein Dropdown-Menü
  öffnet (`DropdownMenu`, gleiche Base-UI-Komponente wie im
  Sidebar-Footer-Benutzermenü) mit den Einträgen "Umbenennen" (eigenes
  `Pencil`-Icon im Menüeintrag) und "Löschen" (`variant="destructive"`).
  Ursprünglich war "Löschen" bei nicht-leeren Ordnern deaktiviert – seit
  dem kaskadierenden Löschen (siehe unten) ist der Eintrag immer aktiv,
  stattdessen warnt der Bestätigungsdialog.
- Neue Komponente `folder-tile-menu.tsx` verbindet das Dropdown mit den
  eigentlichen Dialogen. **Dropdown-Items lösen selbst keine Dialoge
  aus** – sie setzen nur lokalen State (`renameOpen`/`deleteOpen`), der
  `FolderDialog`/`ConfirmDeleteDialog` separat (als Geschwister-
  Elemente, nicht innerhalb des Dropdowns) steuert. Ein Dialog-Trigger
  direkt in einem `DropdownMenuItem` zu verschachteln wäre fragiler
  gewesen (zwei sich überlappende Portal-Layer, Fokus-/Schließ-
  Reihenfolge zwischen Dropdown und Dialog nicht garantiert) – die
  Entkopplung über simplen State ist das robustere, in React allgemein
  übliche Muster für "Dropdown-Aktion öffnet einen Dialog".
- Dafür wurden zwei bereits bestehende, gemeinsam genutzte Komponenten
  um einen **optional kontrollierten Modus** erweitert (rückwärts-
  kompatibel, alle bisherigen Aufrufstellen unverändert):
  - `ConfirmDeleteDialog`: `trigger` ist jetzt optional; `open`/
    `onOpenChange` können von außen übergeben werden (fällt ohne diese
    Props weiterhin auf internen State zurück).
  - `FolderDialog`: neues `hideTrigger`-Prop (blendet den eingebauten
    Trigger-Button aus) + dieselbe optionale `open`/`onOpenChange`-
    Steuerung.
- Die alte, jetzt überflüssige `media-folder-delete-button.tsx` (reiner
  Löschen-Button mit eigenem Trigger) wurde entfernt statt als toten
  Code stehen zu lassen.

## Kaskadierendes Löschen (2026-08-04)

- `MediaFoldersService.remove()` löscht rekursiv statt bei Inhalt mit
  400 abzulehnen: erst alle direkten Unterordner (rekursiver Aufruf von
  `removeRecursive()`, damit auch mehrstufig verschachtelte Bäume
  komplett geräumt werden), dann alle Medien direkt im jeweiligen
  Ordner, zuletzt der Ordner selbst.
- Medien werden dabei **nicht** per `deleteMany` in der DB entfernt,
  sondern einzeln über das bereits bestehende `MediaService.remove(id)`
  aufgerufen – dieselbe Methode, die auch beim manuellen Einzel-Löschen
  eines Mediums läuft. Dadurch läuft automatisch auch die Datei-Löschung
  von Disk (`unlink`) mit, ohne diese Logik zu duplizieren. Dafür
  importiert `MediaFoldersModule` jetzt `MediaModule` (welches
  `MediaService` exportiert).
- Es gibt bewusst **keinen** Force-Flag/Query-Parameter am Endpoint
  (`DELETE /media-folders/:id` verhält sich für leere und nicht-leere
  Ordner identisch) – die vorherige Sicherheitsschwelle wandert
  komplett ins Frontend: `ConfirmDeleteDialog` zeigt bei nicht-leeren
  Ordnern (`mediaCount > 0 || childCount > 0`) einen deutlich
  schärferen Warntext statt des generischen "kann nicht rückgängig
  gemacht werden". Das reicht, weil das Löschen ohnehin schon hinter
  der Berechtigung `media:delete` steht und Löschen über die REST-API
  nie ohne vorherige UI-Bestätigung passiert.
- Kein DB-Cascade (`onDelete: Cascade`) im Prisma-Schema für
  `MediaFolder.parent`/`Media.folder` genutzt, obwohl das die Löschung
  vereinfachen würde – bewusst, weil die Datei-Löschung von Disk so
  oder so nicht über die DB laufen kann und die App-seitige Rekursion
  ohnehin gebraucht wird, um jedes `Media` einzeln durch
  `MediaService.remove()` zu schleusen.

## Stolpersteine / Besonderheiten

- E2E-Test-Cleanup-Falle: Ein Test verschiebt das hochgeladene Bild
  wieder aus dem Test-Ordner heraus (`folderId: null`), bevor er den
  Ordner löscht. Ein Cleanup, das Medien nur über `folderId: {in:
  testFolderIds}` sucht, findet das Bild danach nicht mehr – die
  anschließende User-Löschung scheitert an
  `media_uploadedById_fkey`. Fix: Cleanup löscht Medien direkt über die
  `uploadedBy`-Relation (E-Mail des Test-Users), unabhängig vom
  aktuellen Ordner.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`MediaFolder`,
  `Media.folderId`)
- `apps/api/src/media-folders/*` (`remove()`/`removeRecursive()` für
  kaskadierendes Löschen, injiziert `MediaService`)
- `apps/api/src/media-folders/media-folders.module.ts` (importiert
  `MediaModule`), `apps/api/src/media/media.module.ts` (exportiert
  `MediaService`)
- `apps/api/src/media/media.service.ts`, `media.controller.ts`,
  `dto/query-media.dto.ts`, `dto/update-media.dto.ts`
- `apps/web/src/lib/media-folders.ts`, `lib/api-server.ts`
  (`MediaFolder`, `getMediaFolders`, `MediaItem.folderId`)
- `apps/web/src/app/api/media-folders/route.ts`,
  `media-folders/[id]/route.ts`
- `apps/web/src/components/media-folder-browser.tsx`,
  `folder-dialog.tsx`, `folder-tile-menu.tsx`,
  `move-to-folder-dialog.tsx`
- `apps/web/src/components/confirm-delete-dialog.tsx` (optional
  kontrollierter `open`/`onOpenChange`-Modus, `trigger` jetzt optional)
- `apps/web/src/components/media-upload-dialog.tsx`,
  `media-card-actions.tsx`, `media-grid.tsx`, `selection-toolbar.tsx`
  (alle um Ordner-Bezug erweitert)
- `apps/web/src/components/image-picker-dialog.tsx`
- `apps/web/src/app/dashboard/media/page.tsx`
- `apps/api/test/media-folders.e2e-spec.ts`

## Offene Punkte

- Kein Drag & Drop zum Verschieben (nur explizite "Verschieben"-Aktion
  per Dialog).
- Keine Mehrfachauswahl von Ordnern selbst (nur von Medien).
- Kein ordnerübergreifendes Suchen/Filtern (z.B. "finde Bild X egal in
  welchem Ordner") – nur die jeweils ordner-lokale Ansicht.
- Keine Baum-Sidebar mit permanenter Übersicht – bewusst Breadcrumb +
  Drill-down gewählt (einfacher, deckt Verschachtelung trotzdem ab).
