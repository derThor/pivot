# Papierkorb (vereinheitlichter Soft-Delete-Bereich)

**Stand: 2026-08-18**

## Was wurde gebaut

Eine echte, browsebare Papierkorb-Seite unter `/dashboard/trash`
(kein eigener Sidebar-Eintrag – erreichbar über ein neues Papierkorb-
Icon in den Listen, siehe unten). Löschen bedeutet seitdem app-weit
immer "in den Papierkorb verschieben" (Soft-Delete), nie sofortiges
Entfernen; endgültig weg ist ein Eintrag erst über die Papierkorb-
Seite selbst (einzeln, Massenauswahl oder "Papierkorb leeren").

Sechs echte Typen (nicht acht, siehe unten): Content (Seiten), Medien,
Kategorien, Tags, Galerien, FAQs. "Formulare" existieren in dieser App
nicht (kein Formular-Modul) und "Bausteine" (`ModuleType`) sind
Vorlagen-Definitionen, keine löschbaren Instanzen – beide bewusst
nicht gebaut (Nutzervorgabe, 2026-08-18: "Formulare ignorieren,
Bausteine ignorieren").

Galerien und FAQs teilen sich technisch dieselbe Tabelle
(`GlobalModule`, unterschieden nur über `moduleType.slug`), siehe auch
[faq-and-gallery-dedicated-pages.md](./faq-and-gallery-dedicated-pages.md).

## Datenmodell

Neu: `deletedById String?` + Relation zu `User` (benannt, z.B.
`"ContentDeletedBy"`, `"MediaDeletedBy"`) auf `Content`, `Media`,
`Category`, `Tag` (dort war nur `deletedAt` bereits vorhanden) und neu
komplett auf `GlobalModule` (vorher: `remove()` hat dort hart
gelöscht). Da `User` jetzt mehrere Relationen zu `Media` hat
(`uploadedBy`/`deletedBy`), musste auch die bisher unbenannte
`uploadedBy`-Relation nachträglich benannt werden (`"MediaUploadedBy"`)
– Prisma verlangt bei mehrdeutigen Relationen explizite Namen auf
beiden Seiten.

## Backend

- **Vier bestehende Services** (`ContentService`, `MediaService`,
  `CategoriesService`, `TagsService`): `remove(id, actingUserId)` setzt
  jetzt zusätzlich `deletedById`; alle vier bekamen außerdem eine
  neue ungepaginierte `findAllTrashed()` (zusätzlich zur bereits
  bestehenden paginierten `findTrashed(query)`-Route und der
  ebenfalls bereits bestehenden `findTrashedOlderThan(cutoff)`, die
  weiterhin unverändert von der Datenschutz-Aufbewahrung-Review-Liste
  genutzt wird, siehe [privacy-page.md](../auth/privacy-page.md)).
- **`GlobalModulesService`**: komplett auf Soft-Delete umgebaut
  (`findAll`/`findOne`/`findPage` filtern jetzt `deletedAt: null`,
  `remove()` setzt `deletedAt`+`deletedById` statt zu löschen, neu
  `restore()`/`permanentDelete()`/`findTrashed()` analog zu den vier
  bestehenden Services). `GlobalModulesController` bekam neue Routen
  `POST :id/restore`/`DELETE :id/permanent`, beide mit derselben
  dynamischen Rechteprüfung wie `remove()` (siehe
  `resolveResourceForModule()`).
- **Neues `TrashModule`** (`apps/api/src/trash/`): `TrashService`
  aggregiert alle sechs Typen (`collect()`) zu einer gemeinsamen Form
  (`{id, type, title, subtitle, deletedAt, deletedBy, sizeBytes}`) und
  reichert sie um Ablauf-Metadaten an (`withExpiryMeta()`, berechnet
  `expiresAt`/`daysLeft`/`expired` aus `AppSettings.retentionTrashDays`).
  `TrashController` (`GET /trash` mit `?type=`/`?q=`, `POST
  /trash/:type/:id/restore`, `DELETE /trash/:type/:id`, `DELETE
  /trash` = alles leeren, `POST /trash/restore-expiring` = nur die in
  den nächsten 7 Tagen ablaufenden wiederherstellen) prüft
  Berechtigungen **dynamisch pro Typ** (`${type}:read`/`${type}:delete`,
  passend zum bestehenden Permission-Katalog `content`/`media`/
  `categories`/`tags`/`gallery`/`faq`) statt eines einzelnen
  `@RequirePermission`-Decorators, da eine Route mehrere Ressourcen
  abdeckt (Muster identisch zu `GlobalModulesController`). `GET /trash`
  zeigt jedem Nutzer nur die Typen, für die er `:read` hat – sonst
  könnte z.B. ein Nutzer mit nur `tags:read` auch fremde gelöschte
  Seiten/Medien sehen. Statistiken (Kacheln) beziehen sich immer auf
  ALLES, was der Nutzer sehen darf, unabhängig vom aktuellen
  Typ-Filter/der Suche in der Tabelle darunter.
- Keine automatische Hintergrund-Löschung nach Ablauf der
  Aufbewahrungsfrist (Rückfrage an den Nutzer, 2026-08-18, Antwort:
  "Punkt 1 [nur Wiederherstellung sperren], aber immer einen
  Hinweistext dazu geben" – widerspräche sonst der früheren Vorgabe
  "keine automatische Hintergrund-Löschung"). Abgelaufene Einträge
  bleiben im Papierkorb liegen, `expired: true`, Wiederherstellung ist
  gesperrt (Frontend deaktiviert den "Zurück"-Button), aber sie
  müssen weiterhin bewusst (einzeln oder "Papierkorb leeren")
  endgültig gelöscht werden.

## Frontend

- `/dashboard/trash` (`page.tsx` + `trash-view.tsx`): Header mit
  "Aufbewahrung ändern" (Link zu `/dashboard/privacy`) und "Papierkorb
  leeren" (`ConfirmDeleteDialog`), 4 Stat-Kacheln (`StatCard`,
  gemeinsame Komponente, siehe
  [content-list-and-editor-redesign.md](./content-list-and-editor-redesign.md)),
  Warnbanner (eigenes weißes Karten-Design mit Icon-Kreis +
  "Alle wiederherstellen"-Button, **nicht** die generische
  `SystemMessage`-Komponente – 1:1 nach zweiter, detaillierterer
  Bildvorlage), Filter-Pillen im Tabs-Leisten-Look
  (grauer Balken, aktive Pille weiß, Zähler pro Typ aus
  `stats.countsByType`) + Suche, Tabelle mit Massenauswahl
  (`useSelection`/`SelectionToolbar`), farbiger Icon-Box + farbigem
  Typ-Badge pro Zeile (`TYPE_STYLES`, eigene Palette: Seite=blau,
  Medium=grau, Kategorie=türkis, Tag=lila, Galerie=grün, FAQ=amber),
  reichhaltige Detail-Zeile (Pfad/Größe/Status/Nutzung, backend-seitig
  in `TrashService.collect()` pro Typ zusammengebaut, z.B.
  `/medien/logo · 242 KB` oder `– · war an 3 Seiten` für Tags/
  Kategorien via `_count.contents`), "Zurück"-Button mit Text-Label
  (deaktiviert bei `expired`), "Verfällt"-Spalte rechtsbündig
  (`in X T.` + Fortschrittsbalken). Tabelle sitzt in eigener weißer
  Karte mit Schatten + grauem Tabellenkopf (`bg-background`), wie
  überall sonst in der App.
- **Route hat einen echten Sidebar-Eintrag** ("Papierkorb", unterste
  Position unter "Webseite", `Trash2`-Icon) – Nutzer-Nachtrag,
  2026-08-18: der ursprüngliche Plan (kein Sidebar-Eintrag, Zugriff nur
  über Icons in den Listen) wurde revidiert. Damit auch der
  `ROUTE_ALIASES`/`STANDALONE_ROUTES`-Workaround in
  `app-sidebar.tsx`/`dashboard-breadcrumbs.tsx` wieder entfernt
  (führte sonst zu einem doppelten "Papierkorb"-Breadcrumb-Segment).
- **Kein Papierkorb-Icon/Overlay mehr in den Listen** – der ursprünglich
  gebaute `RowActionButtons`-Prop `trashHref` (zusätzliches Trash-Icon
  mit Dropdown "Papierkorb öffnen"/"Löschen") wurde noch am selben Tag
  wieder vollständig entfernt (Nutzer-Nachtrag: "mach wieder überall
  löschen rot ohne Overlay. Papierkorb ist über die Sidebar
  erreichbar."). `RowActionButtons` ist wieder im Ursprungszustand
  (nur `onEdit`/`onDelete`, Löschen immer als letztes/rechtes Icon,
  rot). Ebenso in `media-detail-panel.tsx`/`gallery-grid.tsx`: das
  zusätzliche "Papierkorb öffnen"-Dropdown-Item wieder entfernt.
- `privacy-view.tsx`: alle drei Aufbewahrungsfrist-Eingaben
  (Zugriffsprotokoll/Deaktivierte Konten/Papierkorb) sind jetzt
  `SegmentedPicker`-Auswahlen (wie "Formular-Einsendungen") statt
  freier Zahlenfelder, mit erklärendem Hinweistext darunter ("...
  gesperrt ... kann nicht mehr wiederhergestellt werden – keine
  automatische Löschung").

## Judgment Calls

- **"Belegter Speicher"** zeigt nur die Summe der Medien-Dateigrößen
  (inkl. Varianten) im Papierkorb – andere Typen haben keine
  sinnvolle Byte-Größe, eine erfundene Gesamtgröße über alle Typen
  wäre irreführend gewesen.
- Bulk-Aktionen ("Papierkorb leeren", "Alle wiederherstellen")
  wirken nur auf die Typen, für die der Nutzer `:delete` hat (nicht
  alles-oder-nichts) – ein Nutzer mit z.B. nur Tag-Rechten leert damit
  nur die Tags aus dem Papierkorb, fremde Seiten/Medien bleiben
  unangetastet.
- Galerien/FAQ-"Bilder"/"Fragen"-Anzahl in der Detail-Zeile ist eine
  Heuristik (`countRepeaterItems()` in `trash.service.ts`: erstes
  Array-Feld in `GlobalModule.values`), kein echtes Schema-Matching –
  spart das zusätzliche Laden von `ModuleType.schema` für die reine
  Anzeige, analog zu `sectionsCount` bei Content (siehe
  [content-list-and-editor-redesign.md](./content-list-and-editor-redesign.md)).
