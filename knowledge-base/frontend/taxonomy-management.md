# Kategorien/Tags-Verwaltung

**Datum:** 2026-08-02, erweitert 2026-08-04
**Betroffene Bereiche:** apps/api (`src/categories`, `src/tags`), apps/web
(`src/app/dashboard/categories`, `src/app/dashboard/tags`,
`src/components/taxonomy-manager.tsx`, `taxonomy-item-dialog.tsx`)

> **Update 2026-08-04:** Bearbeiten (`PATCH`) ergänzt, `Category` bekommt
> ein `description`-Feld, und die bisher gemeinsame Seite
> `/dashboard/taxonomy` wurde in zwei eigene Menüpunkte/Routen
> aufgeteilt (`/dashboard/categories`, `/dashboard/tags`). Details unten.

> **Update 2026-08-05 (Kategorien-Zuordnung im Content-Editor):** Der
> zuvor offene Punkt "Content-Editor erlaubt noch keine Zuordnung von
> Kategorien" ist erledigt – Details siehe
> [content-categories.md](../content/content-categories.md). Tags sind
> bewusst **nicht** Teil dieses Batches (nur Kategorien angefragt).

## Was wurde gebaut

- Zwei parallele, bewusst nicht generalisierte Backend-Module
  `categories` und `tags`: `GET`/`POST`/`PATCH /:id`/`DELETE /:id`,
  gesichert über das granulare RBAC-System (`categories:read/create/
  update/delete`, analog für `tags`, siehe
  [rbac-rework.md](../auth/rbac-rework.md)). Beide prüfen vor dem
  Anlegen/Ändern per `findFirst` auf Name- oder Slug-Kollision (beim
  Update mit `id: { not: id }`, damit ein Eintrag nicht mit sich selbst
  kollidiert) und werfen `ConflictException` statt den rohen
  Prisma-Unique-Constraint-Fehler durchzureichen.
- `Category` hat jetzt ein optionales `description`-Feld (`Tag` bewusst
  nicht – nur für Kategorien angefordert).
- Frontend: zwei eigene Routen/Seiten `/dashboard/categories` und
  `/dashboard/tags` (vorher eine gemeinsame Seite `/dashboard/taxonomy`
  mit zwei nebeneinander gerenderten Karten) – dadurch auch zwei eigene
  Sidebar-Einträge statt einem kombinierten "Kategorien & Tags"-Link.
  Gemeinsame Client-Komponente `TaxonomyManager` (jetzt eine `Table`
  statt einer Badge-Wolke, damit eine Beschreibungs-Spalte und
  Bearbeiten/Löschen-Aktionen pro Zeile Platz haben) + neue
  `TaxonomyItemDialog` (Create+Edit-Dual-Mode-Dialog, gleiches Muster wie
  `RoleFormDialog`/`EditUserDialog`) ersetzt das alte Inline-Formular +
  Badge-Lösch-Button.
- `slugify()` aus dem Content-Editor-Formular nach `lib/utils.ts`
  extrahiert, da es jetzt an mehreren Stellen gebraucht wird.

## Warum diese Lösung

- **Zwei separate Module statt einer generischen "Taxonomy"-Abstraktion**:
  `Category` und `Tag` sind strukturell ähnlich, aber unterschiedliche
  Prisma-Modelle/Tabellen (seit dem `description`-Feld auch nicht mehr
  strukturgleich). Eine generische Lösung hätte an dieser Stelle nur
  Indirektion ohne echten Nutzen hinzugefügt – die Duplikation zwischen
  `categories.service.ts`/`tags.service.ts` ist bewusst in Kauf genommen
  (vgl. `TaxonomyManager` im Frontend, wo die gemeinsame UI-Logik dagegen
  sehr wohl in eine Komponente extrahiert wurde, mit einem
  `withDescription`-Flag für den einzigen strukturellen Unterschied).
- **Tabelle statt Badge-Wolke**: Eine Badge-Wolke hatte keinen Platz für
  eine Beschreibungs-Spalte oder einen Bearbeiten-Button pro Eintrag.
  `Table` ist außerdem das im restlichen Dashboard etablierte Muster für
  Listen mit Zeilen-Aktionen (Content, Medien, Benutzer, Rollen) – Konsistenz
  statt einer Sonderlösung nur für Taxonomie.
- **Eigene Menüpunkte statt einer kombinierten Seite**: Auf Nutzerwunsch
  gegliedert – Kategorien und Tags sind inhaltlich verschiedene Konzepte
  (Kategorien jetzt sogar mit eigenem Feld), eine gemeinsame Seite
  suggerierte fälschlich, dass es sich um dasselbe handelt.
- **Kein Wiring in den Content-Editor**: weiterhin nicht Teil dieses
  Schritts (siehe Offene Punkte).

## Stolpersteine / Besonderheiten

- Keine nennenswerten – deckungsgleiches BFF-Route-Handler-Muster wie bei
  Content/Media/Users, `PATCH`-Handler folgen demselben Muster wie
  `PATCH /api/media/[id]`.

## Relevante Dateien

- `apps/api/src/categories/*` (inkl. `dto/update-category.dto.ts`)
- `apps/api/src/tags/*` (inkl. `dto/update-tag.dto.ts`)
- `apps/api/src/roles/permissions.catalog.ts`,
  `packages/database/prisma/seed.ts` (`categories:update`, `tags:update`)
- `packages/database/prisma/schema.prisma` (`Category.description`)
- `apps/web/src/app/dashboard/categories/page.tsx`,
  `apps/web/src/app/dashboard/tags/page.tsx`
- `apps/web/src/components/taxonomy-manager.tsx`,
  `taxonomy-item-dialog.tsx`
- `apps/web/src/components/app-sidebar.tsx` (zwei eigene Nav-Einträge)
- `apps/web/src/app/api/categories/*`, `apps/web/src/app/api/tags/*`
  (`PATCH` ergänzt)
- `apps/web/src/lib/utils.ts` (`slugify`)
- `apps/api/test/taxonomy.e2e-spec.ts`
- `apps/web/src/components/category-explorer.tsx` (neu, 2026-08-31)
- `apps/web/src/app/api/content/[id]/featured/route.ts` (neu)
- `apps/web/src/lib/tag-colors.ts` (`categoryColor`)
- `packages/database/prisma/schema.prisma` (`Content.isFeatured`)

## Offene Punkte

- ~~Content-Editor erlaubt noch keine Zuordnung von Kategorien/Tags zu
  einem Content-Eintrag~~ – Kategorien seit 2026-08-05 erledigt, siehe
  [content-categories.md](../content/content-categories.md). ~~Tags zu
  Content sind weiterhin nicht zugeordnet (Datenmodell `ContentTag`
  wäre analog vorhanden, aber nicht angefordert)~~ – seit dem
  Kategorien-Redesign (2026-08-31, siehe unten) über die
  Kategorien-Seite selbst zugeordnet (nicht im Content-Editor).
- ~~Kein Umbenennen bestehender Kategorien/Tags (nur Anlegen/Löschen)~~ –
  seit 2026-08-04 erledigt (`PATCH`-Endpoints + Edit-Dialog).
- ~~Tags haben weiterhin kein Editor-UI zur Zuordnung – nur der
  "+Tag"-Schnellzuweiser auf der Kategorien-Seite~~ – seit dem
  Update vom 2026-08-31 (Folgetag) hat der Content-Editor einen
  vollständigen Tags-Mehrfachauswahl-Picker (mit Chip-Entfernen). Der
  "+Tag"-Schnellzuweiser auf der Kategorien-Seite bleibt zusätzlich
  bestehen und erlaubt dort weiterhin kein Entfernen (kein "x" auf
  dem Chip, 1:1 nach Bildvorlage) – falls das gebraucht wird, noch
  offen.

## Update 2026-08-31: Kategorien-Seite als Liste+Detail-Explorer, Tags landen in Content

Nutzervorgabe: "baue Kategorie genauso um [wie im Bild] ... fasse vor
Umsetzung zusammen und hole Freigabe ein." Ersetzt die bisherige flache
`TaxonomyManager`-Tabelle unter `/dashboard/categories` durch eine neue
`category-explorer.tsx` (Liste+Detail, gleiches Muster wie
`content-versions-explorer.tsx`/die Einstellungen-Sidebar: eine Kachel,
`divide-y`-Trennlinien, `border-l-4`-Aktiv-Akzent). `/dashboard/tags`
bleibt unverändert auf `TaxonomyManager`/`TaxonomyItemDialog` – beide
Komponenten wurden NICHT angefasst, nur eine neue Konsumentenseite
daneben gebaut.

**Neu in der Sidebar:** farbiger Balken pro Rubrik (dekorative
Hash-Farbe, `categoryColor()` in `tag-colors.ts` – neuer, benannter
Alias auf dieselbe Funktion wie `tagDotColor()`, da auch `Category`
kein eigenes `color`-Feld hat), echter Beitragszähler/"leer"-Badge
(`_count.contents`, vorher fehlte das in `findAll()`), und eine
zweite Kachel "Tags in dieser Rubrik" – neue Abfrage
`TagsService.findByCategory()`/`GET /tags/by-category/:categoryId`,
da es vorher keine Möglichkeit gab, Tags nach Kategorie-Zugehörigkeit
ihrer Beiträge zu filtern.

**Zwei bewusst nicht gebaute Mockup-Elemente** (per Rückfrage vorab
geklärt statt stillschweigend erfunden):
- **"RSS aktiv"-Badge** – komplett weggelassen. Es gibt in der
  gesamten App kein RSS-Feature (kein Feed-Endpunkt, kein Feld) und
  auch keine öffentliche Seite, die einen Feed ausliefern könnte
  (Pivot ist headless).
- **"AUFRUFE 30 T."** (Kennzahl + Tabellenspalte) – komplett
  weggelassen. Es gibt nirgends im System ein Seitenaufruf-/
  Analytics-Tracking, das je eine echte Zahl liefern könnte.

**Neu, echt gebaut statt erfunden:**
- `Content.isFeatured` (neues Schema-Feld) – Stern-Symbol in der
  Aktionen-Spalte schaltet es um (`POST /content/:id/featured`,
  gleiches Muster wie `lock`/`unlock`), Badge "Aufmacher" erscheint
  dann neben dem Titel. Ersetzt das im Bild ebenfalls fiktive
  Stern-"Favorit" (es gibt keine Favoriten-Funktion/-Tabelle in der
  App) durch eine einzige echte Funktion statt zwei erfundener.
- `ContentTag` (existierte im Schema, wurde aber nirgends im Backend
  gelesen/geschrieben) ist jetzt vollständig angebunden: `tags` im
  `include` von `findAll()`/`findOne()`/`findTrashed()` (neuer
  gemeinsamer Mapper `mapContentRelations()`, ersetzt das vorherige
  `mapContentCategories()`), `tagIds` in `CreateContentDto`/
  `UpdateContentDto` (identisches Muster wie `categoryIds`:
  `deleteMany({}) + create(...)` bei Update). Der "+Tag"-Button in
  der Beitragstabelle ruft dafür einfach `PATCH /content/:id` mit der
  erweiterten `tagIds`-Liste auf – kein neuer Endpoint nötig.
- `QueryContentDto` bekam `categoryId`/`search` (Titel-Substring,
  case-insensitive) – die "Beiträge"-Tabelle der Kategorien-Seite
  filtert/sucht/paginiert dadurch vollständig serverseitig über
  URL-Parameter (`?category=&status=&search=&postsPage=`), nicht nur
  clientseitig auf der aktuell geladenen Seite.
- `CategoriesService.findOne()` (neu, gab es vorher gar nicht als
  Einzelabruf) liefert `contentCount`/`liveCount` – zwei echte
  `content.count()`-Abfragen, keine erfundenen Kennzahlen.

**Nebenbei, gleicher Tag:** "Tags" aus der Sidebar-Untergruppe von
"Medien" herausgelöst und zu einem eigenen, gleichrangigen Menüpunkt
neben "Kategorien" gemacht (Nutzervorgabe: "nimm tags aus medien raus
und mache es zu einem eigenen menüpunkt").

Live gegen die laufende API verifiziert: Kategorie+Tag einem echten
Beitrag zugewiesen → Sidebar-Zähler, Tags-in-Rubrik-Zähler,
Beiträge/Live-Kennzahlen und die Tabellenzeile (Status-Badge,
Aufmacher-Badge, Tag-Chip) aktualisieren sich korrekt; Status-Filter
und Suche liefern über echte URL-Parameter die richtigen Treffer;
Testzuordnungen danach wieder entfernt.

## Update 2026-08-31 (Folgetag): Rubrik→Kategorie-Umbenennung, Bugfix, Tags im Editor, echte Farbe

Nutzervorgabe (Bildvorlage "Rubrik-Einstellungen"): "nenne Rubrik
Einstellungen in Kategorie Einstellungen umbenennen und stelle es wie
auf dem Bild dar. alles was Rubrik ist, auf Kategorie umbenenne. Wenn
ich die Kategorie ändere, wird die Einstellung nicht korrekt
angezeigt. Tags in dieser Kategorie sind Tags, die in enthaltenen
Seiten gesetzt wurden. Das ist aktuell noch nicht möglich, Seiten mit
Tags zu versehen. Das nachholen."

- Sämtliche "Rubrik"-Bezeichner in `category-explorer.tsx` und
  Backend-Kommentaren auf "Kategorie" umbenannt (nur Wortwahl, keine
  Funktionsänderung).
- **Bugfix, stale Einstellungen-Tab beim Kategoriewechsel:**
  `CategorySettingsForm`s `useState(category.name)` etc. wurde nur
  beim Mount initialisiert; beim Wechsel der Kategorie im aktiven
  "Kategorie-Einstellungen"-Tab blieb dieselbe Komponenteninstanz
  bestehen und zeigte weiter die alten Werte. Fix: `key={selectedCategory.id}`
  am `CategorySettingsForm`-Aufruf erzwingt einen Remount bei
  Kategoriewechsel (gleiches Muster wie schon vorher bei
  `content-versions-explorer.tsx`s `key={page}`).
- **Tags im Content-Editor:** `content-editor-form.tsx` bekam einen
  vollständigen Tags-Mehrfachauswahl-Picker, 1:1 nach dem Muster des
  bestehenden Kategorien-Pickers (Chip-Entfernen, Autosave-Draft-
  Unterstützung inklusive). Vorher konnten Tags nur nachträglich über
  den "+Tag"-Schnellzuweiser auf der Kategorien-Seite selbst gesetzt
  werden (siehe Update oben) – jetzt auch direkt beim Bearbeiten eines
  Beitrags.
- **Echte Kategorie-Farbe:** `Category.color` (neues, echtes,
  optionales Hex-Feld) ersetzt für Kategorien, die eine Farbe gewählt
  haben, die bisherige rein dekorative Hash-Farbe aus `tag-colors.ts`
  (die bleibt als Fallback für Kategorien ohne gewählte Farbe).
  Farbwähler in den Kategorie-Einstellungen ist 1:1 das gleiche Muster
  wie `ACCENT_PRESETS` in `settings-form.tsx` (Einstellungen →
  Darstellung): feste Presets + `<input type="color">`-Overlay auf
  einem Paletten-Icon. Eigene Preset-Palette `CATEGORY_COLOR_PRESETS`
  (Blau/Lila/Orange/Grün/Rot/Grau), da es eine andere Farbwahl als die
  App-Akzentfarbe ist.

## Update 2026-08-31 (2. Folgetag): RSS-Feed, Archiv-Einstellungen und die Frontend/Backend-Begriffsklärung

**Wichtige Begriffsklärung durch den Nutzer, gilt ab jetzt für die
gesamte App:** "Es gibt immer eine Webseite. Für Master und für
Clients. Ich nenne das Frontend. Nicht zu verwechseln mit dem
Frontend, das du für die UI hast. Ich unterscheide zwischen Frontend
(Webseite öffentlich) und Backend (UI Administration, was du aktuell
Frontend nennst)." Ab sofort: **"Frontend"** = die für jede
Master-/Mandanten-Installation geplante, aber noch **nicht gebaute**
öffentliche Website. **"Backend"** = das bestehende Next.js-Admin-UI
(`apps/web`, was in dieser Knowledge-Base bisher als "Frontend" im
React/Next.js-Sinne bezeichnet wurde – weiterhin technisch korrekt,
aber im Nutzer-Sprachgebrauch jetzt "Backend"). Die Bildvorlage
"Rubrik-Einstellungen" (Archiv & Feed: RSS-Feed, Archivseite,
Aufmacher groß, Sortierung, Beiträge pro Seite) impliziert genau
diese künftige öffentliche Website. Nutzervorgabe: "setze Feed um und
plane Frontend wie beschrieben" / "baue Feed und Aufmacher usw" – die
Planung der öffentlichen Website selbst ist ein separater, noch nicht
begonnener Auftrag; dieses Update deckt nur den "bauen"-Teil ab.

**Echt gebaut, auch ohne aktuellen Konsumenten (bewusste Ausnahme von
"keine spekulativen Features", per expliziter Nutzervorgabe, da die
öffentliche Website real geplant ist):**
- `Category`: `rssEnabled`, `archivePublished`, `showFeaturedLarge`
  (alle `Boolean @default(false)`), `sortOrder` (neues Enum
  `CategorySortOrder`: `NEWEST`/`OLDEST`/`MANUAL`), `postsPerPage`
  (`Int?`).
- **RSS-Feed, wirklich real:** `CategoriesService.generateFeed(id)`
  baut echtes RSS-2.0-XML aus den tatsächlich veröffentlichten
  Beiträgen der Kategorie (`status: PUBLISHED`, `publishedAt desc`,
  gedeckelt auf 20 Einträge), `null` bei unbekannter/gelöschter
  Kategorie oder deaktiviertem `rssEnabled` → Controller antwortet
  dann 404. Öffentlich erreichbar unter `@Public() GET
  /categories/:id/feed.xml`. **Bekannte, bewusste Lücke:** `<link>`
  fehlt bei Beiträgen ohne `canonicalUrl`, da es noch keine echte
  Basis-URL für eine öffentlich ausgelieferte Seite gibt (die
  öffentliche Website selbst existiert noch nicht) – es wurde
  **keine erfundene Domain** eingesetzt, `<guid isPermaLink="false">`
  bleibt als stabiler Bezug immer vorhanden.
- **Sortierung wirkt auf die Beiträge-Tabelle im Backend
  (Nutzerentscheidung, "Ja, für die Beiträge-Tabelle übernehmen"):**
  `QueryContentDto.sortOrder` steuert `ContentService.findAll()`s
  `orderBy` (`OLDEST` → `asc`, sonst `desc`). **Bekannte, dokumentierte
  Lücke:** `MANUAL` hat noch kein echtes Datenfeld für eine manuelle
  Reihenfolge (`ContentCategory` hat kein Sortierfeld) und fällt
  deshalb im Code wie in der UI (Hinweistext unter dem
  Sortierung-Picker) explizit auf `NEWEST` zurück, statt eine nicht
  funktionierende Sortierung stillschweigend vorzugaukeln.
  `apps/web/src/app/dashboard/categories/page.tsx` reicht
  `selectedCategory.sortOrder` in `getContentList()` durch.
  ~~"Beiträge pro Seite" (`postsPerPage`) steuerte anfangs ebenfalls
  diese Tabelle~~ – seit dem Update vom 2026-08-31 (Folgetag, siehe
  unten) korrigiert: die Admin-Tabelle folgt IMMER der globalen
  Seitengröße aus Einstellungen → Darstellung wie jede andere
  Listenseite; `postsPerPage` bleibt ein echtes, gespeichertes Feld,
  ist aber ausschließlich für die künftige öffentliche Archivseite
  gedacht (noch ohne Konsumenten).
- **Feed-Adresse in der UI:** zeigt bei aktiviertem RSS-Schalter ein
  Read-only-Feld mit der echten, tatsächlich erreichbaren API-Route
  (`getCategoryFeedUrl()` in `api-server.ts`, baut aus dem
  server-seitigen `API_URL` die volle Feed-URL) – keine erfundene
  Domain, gleiches Prinzip wie beim `<link>`-Feld oben.
- UI-Komponenten wiederverwendet statt neu gebaut: `SwitchRow` (drei
  Schalter) und `SegmentedPicker` (Sortierung, Beiträge-pro-Seite:
  6/8/10/12/20) aus den bestehenden, dafür extrahierten
  Komponenten – keine neuen Ad-hoc-Toggle-/Auswahl-Implementierungen.
- "Kategorie-Einstellungen"-Formular ist jetzt zweispaltig
  (`grid lg:grid-cols-2`, `items-start`): links die bestehende
  "Kategorie"-Karte (Name/Pfad/Beschreibung/Farbe), rechts neu
  "Archiv & Feed" – 1:1 nach der zweispaltigen Bildvorlage.

Live gegen die laufende API verifiziert: RSS-Feed liefert bei
deaktiviertem `rssEnabled` 404, bei aktivierter Kategorie mit
mindestens einem echten veröffentlichten Beitrag valides RSS-2.0-XML
mit echtem Titel/GUID/pubDate; `sortOrder=OLDEST`/`MANUAL` als
Query-Parameter akzeptiert; neue Felder erscheinen korrekt in
`GET /categories`/`GET /categories/:id`. Nach dem Test wieder in den
ursprünglichen Zustand zurückversetzt (Testkategorie war zuvor
gelöscht, `rssEnabled` wieder auf `false`).

## Update 2026-08-31 (Folgetag): UI-Feinschliff Kategorien-Seite

Mehrere kleine, gezielte Korrekturen auf `category-explorer.tsx` nach direktem
Nutzer-Feedback am laufenden Screenshot:

- **Tabs statt SegmentedPicker/hand-rolled Buttons:** Sowohl die Status-Filter-Leiste
  ("Alle/Live/Entwurf/Geplant") als auch der "Beiträge/Kategorie-Einstellungen"-
  Umschalter nutzen jetzt `ui/tabs.tsx` (`Tabs`/`TabsList`/`TabsTrigger`) statt
  hand-gebauter `<button>`-Reihen bzw. `SegmentedPicker`. `SegmentedPicker` bleibt für
  echte Werte-Presets (Sortierung, Beiträge pro Seite) korrekt, ist aber NICHT der
  Standard für Tabs/Filter-Leisten, die zwischen Ansichten umschalten – siehe
  [[feedback_use_existing_standard_components]] für die jetzt geschärfte Abgrenzung
  zwischen beiden Komponenten (ausgelöst durch eine deutliche Nutzerkorrektur, da ich
  zunächst die falsche Tab-Leiste geändert hatte).
- **Sidebar-Pagination:** Die Kategorien-Liste lud vorher bis zu 100 Einträge ohne
  Blätter-Möglichkeit (`getCategories({ page: 1, pageSize: 100 })`). Jetzt echt
  paginiert (`categoryPage`-URL-Parameter, globale `defaultPageSize`), `PaginationControls`
  unterhalb der Kategorien-Kachel als Sibling (nicht in die Kachel gepolstert, siehe
  [[feedback_pagination_outside_card]]), "Kategorien · N" zeigt die echte
  Gesamtzahl (`categoriesMeta.total`) statt nur der aktuell geladenen Seite. Die
  404-Prüfung bei einer per Link ausgewählten Kategorie läuft jetzt über
  `getCategory()` selbst statt über die Mitgliedschaft in der (jetzt paginierten)
  Sidebar-Liste.
- **Beiträge-Tabelle folgt der globalen Seitengröße:** siehe Korrektur oben bei
  "Sortierung wirkt auf die Beiträge-Tabelle" – `postsPerPage` steuert diese Tabelle
  NICHT mehr.
- **Such-Feld-Muster korrigiert:** die "Beitrag suchen"-Box nutzte eine selbst gebaute
  Icon-über-Input-Variante (`Input` mit eigenem `border`/`rounded-lg`, Icon absolut
  positioniert). Auf Nutzerhinweis durch das tatsächliche App-Standardmuster ersetzt
  (`forms-view.tsx`: äußerer `rounded-xl border border-border bg-card`-Wrapper, Icon
  als Sibling, `Input` selbst randlos/`bg-transparent` innen) – dieses Wrapper-Muster
  ist der Standard für Listen-Suchfelder, nicht `SearchIcon` absolut über einem vollen
  `Input`.
- **Speichern-Button der Kategorie-Einstellungen:** wandert bei aktivem
  "Kategorie-Einstellungen"-Tab neben die Tabs (rechts daneben, Höhe exakt `h-10`
  passend zur `TabsList`, sonst springt die Zeilenhöhe). Technisch über das
  Standard-HTML-`form="category-settings-form"`-Attribut auf einem Button AUSSERHALB
  des `<form>`-Elements gelöst, Submit-Status (`isSubmitting`) dafür per
  `onSubmittingChange`-Callback von `CategorySettingsForm` zum Elternteil
  `CategoryExplorer` hochgereicht.
- **"RSS aktiv"-Badge-Farbe:** von `badge--lime` (das ist für "Aufmacher" reserviert)
  auf `badge--green` (dieselbe Farbe wie der "Live"-Status) korrigiert – "aktiv/an"
  bekommt app-weit dasselbe Grün, nicht die Akzent-Lime-Farbe.

Nebenbei, gleicher Tag: ein durch eigenes Testen verursachter Produktionsvorfall
(wiederholte Spam-Mails "Rechtstext veraltet"/"Passwort muss geändert werden") wurde
gefunden und behoben – siehe [[feedback_no_narrow_tokens_for_real_user]] für die
Ursache (Berechtigungs-abhängige Fakten-Prüfung in `NotificationsService.sync()`) und
den Fix in `apps/api/src/notifications/notifications.service.ts`. Kein
Kategorien-Feature im engeren Sinne, aber während dieser Arbeit an derselben Seite
entdeckt.
