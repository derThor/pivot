# Content-Editor: dynamisches Formular aus ContentType.schema

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/api (`src/content-types`,
`src/content/content.service.ts`), apps/web (`src/app/dashboard/content/new`,
`src/components/content-editor-form.tsx`, `src/app/api/content/route.ts`)

> **Update 2026-08-06 (Zweispaltiges Layout im "Inhalt"-Tab):** Der
> "Inhalt"-Tab von `ContentEditorForm` ist jetzt zweispaltig
> (`grid-cols-[360px_1fr]`, untereinander gestapelt unterhalb von `lg`):
> **links** eine schmale "Einstellungen"-Karte (Content-Type, Titel,
> Slug, Status, Kategorien, alle dynamischen Felder **außer**
> Richtext), **rechts** eine große Editor-Karte mit ausschließlich den
> Richtext-Feldern (i.d.R. `body`). `selectedType.schema.fields` wird
> dafür per `field.type === "richtext"` in `editorFields`/
> `settingsFields` aufgeteilt. Die SEO-Tab-Struktur ist davon nicht
> betroffen (weiterhin einspaltig, eigener Tab). Kein Layout-Wechsel bei
> Content-Types ohne Richtext-Feld – dann zeigt die rechte Spalte einen
> Platzhaltertext ("kein Editor-Feld") statt leer zu bleiben.
>
> **Zweites Update 2026-08-06 (Editor immer volle Höhe):** Die rechte
> Editor-Spalte war zwar zweispaltig, aber nicht so hoch wie die linke
> Einstellungen-Spalte (Grid stand auf `items-start`, jede Spalte nur so
> hoch wie ihr eigener Inhalt). Jetzt: `items-start` entfernt (Grid-
> Default "stretch" sorgt dafür, dass beide Spalten gleich hoch werden),
> und die Flex-Kette `Card -> CardContent -> Feld-Wrapper ->
> RichTextEditor -> EditorContent -> .tiptap` durchgängig mit
> `flex-1`/`min-h-0` versehen, damit der eigentliche Editor-Bereich
> (inkl. HTML-Quellcode-Modus) diese Höhe auch tatsächlich ausfüllt
> statt nur eine leere Box mit `min-h-24` oben zu zeigen. Kein
> Scroll-Cap gesetzt – wächst bei viel Inhalt einfach über die
> Einstellungen-Spalte hinaus, füllt bei wenig Inhalt aber immer
> mindestens deren Höhe.

## Was wurde gebaut

- Neues Backend-Modul `content-types`: `GET /content-types` (Liste) und
  `GET /content-types/:id` (Detail inkl. `schema`). Authentifiziert, aber
  ohne Rollen-Einschränkung – jeder eingeloggte User braucht das Schema,
  um den Editor zu rendern.
- Content-Editor (`/dashboard/content/new`): Auswahl des Content-Types per
  Select, danach werden Formularfelder dynamisch aus
  `ContentType.schema.fields` erzeugt. Feldtyp-Mapping:
  `string` → `Input`, `richtext`/`text` → `Textarea`, `number` →
  `Input[type=number]`, unbekannte Typen fallen auf Text-Input zurück.
- Slug wird per `slugify()` automatisch aus dem Titel abgeleitet, bis der
  User das Slug-Feld manuell anfasst (danach kein Auto-Update mehr).
- Neuer Route Handler `POST /api/content` (BFF-Proxy): liest den
  `access_token` aus dem httpOnly-Cookie und hängt ihn als
  `Authorization`-Header an den Request gegen die NestJS-API – nötig, weil
  Client-JS den httpOnly-Cookie nicht selbst lesen/senden kann (siehe
  [frontend-auth-flow.md](../auth/frontend-auth-flow.md)).

## Warum diese Lösung

- Meta-Felder (Titel/Slug/Status/ContentType) laufen über react-hook-form +
  zod (Konsistenz mit dem Login-Formular). Die dynamischen `data`-Felder
  sind bewusst **nicht** im selben zod-Schema, weil sich dessen Form bei
  jedem ContentType-Wechsel ändern müsste – stattdessen einfacher
  `useState`+ manuelle Required-Prüfung vor dem Submit. Weniger Komplexität
  als ein zur Laufzeit neu aufgebautes zod-Schema pro Content-Type.
- ~~Rich-Text-Felder werden aktuell als reine `Textarea` gerendert~~ –
  inzwischen erledigt, siehe
  [rich-text-and-versioning.md](./rich-text-and-versioning.md).

## Stolpersteine / Besonderheiten

- `ContentService.findAll()`/`findOne()` luden die `contentType`-Relation
  ursprünglich nicht mit (`include` hatte nur `author`). Die
  Content-Übersicht im Frontend griff aber auf `entry.contentType.name` zu
  → `TypeError: Cannot read properties of undefined (reading 'name')`,
  sobald ein Content-Eintrag existierte (bei leerer Liste fiel der Fehler
  nicht auf, weil die `.map()`-Schleife nie lief). Fix: `contentType:
  { select: { id, name, slug } }` zum `include` in beiden Methoden
  ergänzt.
- Vor diesem Feature gab es **gar keinen** Endpoint, um `ContentType`s zu
  lesen – nur das Prisma-Modell existierte, befüllt einzig über
  `packages/database/prisma/seed.ts`. Ohne den neuen Endpoint hätte das
  Frontend nicht wissen können, welche Content-Types es gibt oder wie ihr
  Schema aussieht.

## Relevante Dateien

- `apps/api/src/content-types/*`
- `apps/api/src/content/content.service.ts`
- `apps/api/src/app.module.ts`
- `apps/web/src/components/content-editor-form.tsx`
- `apps/web/src/app/dashboard/content/new/page.tsx`
- `apps/web/src/app/api/content/route.ts`
- `apps/web/src/lib/api-server.ts`

## Offene Punkte

- ~~Bearbeiten bestehender Content-Einträge fehlt~~ – inzwischen erledigt,
  siehe [content-edit-delete.md](./content-edit-delete.md).
- Keine UI zum Anlegen/Bearbeiten von `ContentType`s selbst – aktuell nur
  per Seed-Skript oder Prisma Studio möglich.
