# Kategorien/Tags-Verwaltung

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/api (`src/categories`, `src/tags`), apps/web
(`src/app/dashboard/taxonomy`, `src/components/taxonomy-manager.tsx`)

## Was wurde gebaut

- Zwei parallele, bewusst nicht generalisierte Backend-Module
  `categories` und `tags`: `GET` (Liste, authentifiziert, keine
  Rollen-Einschränkung), `POST` und `DELETE /:id` (beide
  `@Roles(ADMIN, EDITOR)`). Beide prüfen vor dem Anlegen per `findFirst`
  auf Name- oder Slug-Kollision und werfen `ConflictException` statt den
  rohen Prisma-Unique-Constraint-Fehler durchzureichen.
- Frontend: `/dashboard/taxonomy` (Route existierte bereits als
  Sidebar-Link aus dem Grundgerüst, aber ohne Seite dahinter) rendert zwei
  Instanzen einer gemeinsamen Client-Komponente `TaxonomyManager`
  (Inline-Formular zum Anlegen inkl. Auto-Slug wie beim Content-Editor,
  Badges mit Lösch-Button für bestehende Einträge).
- `slugify()` aus dem Content-Editor-Formular nach `lib/utils.ts`
  extrahiert, da es jetzt an zwei Stellen gebraucht wird.

## Warum diese Lösung

- **Zwei separate Module statt einer generischen "Taxonomy"-Abstraktion**:
  `Category` und `Tag` sind zwar strukturell identisch (`name`, `slug`),
  aber unterschiedliche Prisma-Modelle/Tabellen. Eine generische Lösung
  hätte an dieser Stelle nur Indirektion ohne echten Nutzen hinzugefügt –
  die Duplikation zwischen `categories.service.ts`/`tags.service.ts` ist
  bewusst in Kauf genommen (vgl. `TaxonomyManager` im Frontend, wo die
  gemeinsame UI-Logik dagegen sehr wohl in eine Komponente extrahiert
  wurde, weil dort echte Wiederverwendung vorliegt).
- **Kein Wiring in den Content-Editor**: Der Roadmap-Punkt lautet
  "Kategorien/Tags-Verwaltung", nicht "Content-Zuordnung". Das
  `Content`-Modell verknüpft `Category`/`Tag` bereits über
  `ContentCategory`/`ContentTag` (siehe Prisma-Schema), aber weder
  `CreateContentDto` noch der Content-Editor nutzen das – bewusst nicht
  in diesem Schritt ergänzt, um den Scope nicht zu sprengen (siehe Offene
  Punkte).

## Stolpersteine / Besonderheiten

- Keine nennenswerten – deckungsgleiches BFF-Route-Handler-Muster wie bei
  Content/Media/Users.

## Relevante Dateien

- `apps/api/src/categories/*`
- `apps/api/src/tags/*`
- `apps/api/src/app.module.ts`
- `apps/web/src/app/dashboard/taxonomy/page.tsx`
- `apps/web/src/components/taxonomy-manager.tsx`
- `apps/web/src/app/api/categories/*`, `apps/web/src/app/api/tags/*`
- `apps/web/src/lib/utils.ts` (`slugify`)

## Offene Punkte

- Content-Editor erlaubt noch keine Zuordnung von Kategorien/Tags zu
  einem Content-Eintrag, obwohl das Datenmodell (`ContentCategory`,
  `ContentTag`) das bereits hergibt.
- Kein Umbenennen bestehender Kategorien/Tags (nur Anlegen/Löschen).
