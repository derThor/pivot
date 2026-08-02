# Content-Modell und automatische Versionierung

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/api (`src/content`), packages/database

## Was wurde gebaut

- `ContentType` (flexibles JSON-Schema für Feld-Definitionen) und `Content`
  (Status-Enum `DRAFT`/`SCHEDULED`/`PUBLISHED`/`ARCHIVED`, JSON-Daten gemäß
  Schema, SEO-Felder, `locale`).
- `POST /content`, `GET /content` (paginiert, filterbar nach `status` und
  `contentTypeId`), `GET /content/:id`, `PATCH /content/:id`,
  `DELETE /content/:id`.
- Bei jedem `PATCH` wird **vor** dem Überschreiben der bisherige `data`-Stand
  automatisch als `ContentVersion`-Eintrag gesichert (kein manueller
  "Version speichern"-Schritt nötig).
- Beim Übergang in `PUBLISHED` (egal aus welchem Status) wird `publishedAt`
  automatisch gesetzt, sofern es der erste Übergang in diesen Status ist.
- Rollenbeschränkung: Erstellen/Bearbeiten für `ADMIN`/`EDITOR`/`AUTHOR`,
  Löschen nur für `ADMIN`/`EDITOR`. Lesen ist für alle authentifizierten
  Rollen offen.

## Warum diese Lösung

- **Versionierung "automatisch bei jedem Update" statt opt-in**: verhindert,
  dass Redakteur:innen vergessen, eine Version zu sichern, bevor sie etwas
  überschreiben – Historie ist dadurch lückenlos.
- **JSON-Schema pro `ContentType` statt starrer Spalten**: erlaubt beliebige
  Content-Modelle (Seite, Blogartikel, Produkt, …) ohne Schema-Migration pro
  neuem Typ. Preis dafür: Validierung der `data`-Struktur gegen das Schema
  ist noch nicht implementiert (siehe unten).
- **`publishedAt` nur beim ersten Übergang setzen**: spätere Updates an
  bereits veröffentlichten Inhalten sollen das ursprüngliche
  Veröffentlichungsdatum nicht verändern.

## Stolpersteine / Besonderheiten

- Prisma erzwingt für JSON-Felder den Typ `Prisma.InputJsonValue` statt
  eines generischen `Record<string, unknown>` – an drei Stellen in
  `content.service.ts` entsprechend gecastet (create, version-snapshot,
  update).
- Es gibt aktuell **keine Laufzeit-Validierung** von `Content.data` gegen das
  `ContentType.schema` – das DTO prüft nur, dass `data` ein Objekt ist, nicht
  dass es zum jeweiligen Content-Typ passt. Das ist ein bewusster Kompromiss
  für den ersten Wurf, siehe "Offene Punkte".

## Relevante Dateien

- `apps/api/src/content/*`
- `packages/database/prisma/schema.prisma` (`ContentType`, `Content`,
  `ContentVersion`, `Category`, `Tag`, `ContentCategory`, `ContentTag`)

## Offene Punkte

- Validierung von `Content.data` gegen `ContentType.schema` zur Laufzeit
  (z.B. via zod-Schema-Generierung aus dem gespeicherten JSON-Schema).
- Versions-Diff & Rollback-Endpoint/UI (Daten sind vorhanden, es gibt aber
  noch keinen `POST /content/:id/rollback/:versionId`).
- Kategorien/Tags haben zwar ein Datenmodell, aber noch keine eigenen
  Endpoints/DTOs.
- Scheduler für `SCHEDULED` → `PUBLISHED` fehlt (siehe
  [`docs/ROADMAP.md`](../docs/ROADMAP.md) Phase 2).
