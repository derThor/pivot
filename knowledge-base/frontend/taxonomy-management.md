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
- Tags haben weiterhin kein Editor-UI zur Zuordnung – nur der "+Tag"-
  Schnellzuweiser auf der Kategorien-Seite (siehe Update unten). Ein
  Tag lässt sich dort nicht wieder entfernen (kein "x" auf dem Chip,
  1:1 nach Bildvorlage) – falls das gebraucht wird, noch offen.

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
