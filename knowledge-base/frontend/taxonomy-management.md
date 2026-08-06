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

## Offene Punkte

- ~~Content-Editor erlaubt noch keine Zuordnung von Kategorien/Tags zu
  einem Content-Eintrag~~ – Kategorien seit 2026-08-05 erledigt, siehe
  [content-categories.md](../content/content-categories.md). Tags zu
  Content sind weiterhin nicht zugeordnet (Datenmodell `ContentTag`
  wäre analog vorhanden, aber nicht angefordert).
- ~~Kein Umbenennen bestehender Kategorien/Tags (nur Anlegen/Löschen)~~ –
  seit 2026-08-04 erledigt (`PATCH`-Endpoints + Edit-Dialog).
