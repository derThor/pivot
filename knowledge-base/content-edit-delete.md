# Content bearbeiten und löschen

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/web (`src/components/content-editor-form.tsx`,
`src/components/content-row-actions.tsx`,
`src/app/dashboard/content/[id]/edit`, `src/app/api/content/[id]/route.ts`)

## Was wurde gebaut

- `ContentEditorForm` (bisher nur "Anlegen") um einen optionalen `content`-
  Prop erweitert: ist er gesetzt, läuft das Formular im Edit-Modus –
  Felder vorausgefüllt, Submit sendet `PATCH` statt `POST`, Content-Type-
  Auswahl ist deaktiviert (Backend erlaubt Typwechsel ohnehin nicht, siehe
  `UpdateContentDto extends PartialType(OmitType(CreateContentDto,
  ['contentTypeId']))`).
- Neue Seite `/dashboard/content/[id]/edit` (Server Component), lädt den
  Eintrag über `getContent(id)`; existiert er nicht, `notFound()`.
- Neue Route Handler `PATCH`/`DELETE /api/content/[id]` (BFF-Proxy, gleiches
  Muster wie überall sonst).
- Content-Übersicht bekommt eine Aktionen-Spalte
  (`ContentRowActions`): Stift-Icon verlinkt auf die Edit-Seite,
  Papierkorb-Icon öffnet `ConfirmDeleteDialog` (siehe
  [ui-convention-crud-and-delete-confirmation.md](./ui-convention-crud-and-delete-confirmation.md))
  – kein Löschen ohne Bestätigung.
- Kein Backend-Code geändert – `GET/PATCH/DELETE /content/:id` existierten
  bereits vollständig, nur bisher ungenutzt vom Frontend.

## Warum diese Lösung

- **Ein Formular für Create+Edit statt zwei getrennte Komponenten**: Die
  Feldstruktur (Meta-Felder + dynamische `data`-Felder aus
  `ContentType.schema`) ist in beiden Fällen identisch, nur
  Vorbefüllung/HTTP-Methode/Ziel-URL unterscheiden sich. Ein `content?`-
  Prop hält die Verzweigung minimal, statt Logik zu duplizieren.
- **Slug wird im Edit-Modus nicht automatisch aus dem Titel neu
  abgeleitet** (`slugTouched` startet mit `true` statt `false`): Anders als
  beim Anlegen hat ein bestehender Eintrag bereits einen echten Slug, der
  z.B. extern verlinkt sein könnte – eine Titel-Änderung soll ihn nicht
  stillschweigend überschreiben. Der Slug bleibt exakt so, bis der User ihn
  selbst anfasst.
- **Content-Type-Select im Edit-Modus deaktiviert statt einfach nicht
  gesendet**: verhindert, dass der Nutzer den Eindruck bekommt, er könnte
  den Typ ändern, obwohl das Backend es zurückweisen würde (das DTO
  akzeptiert `contentTypeId` beim Update gar nicht erst).

## Stolpersteine / Besonderheiten

- Keine – deckungsgleiches Muster wie bei den bisherigen BFF-Route-Handlern
  und der `ConfirmDeleteDialog`-Konvention.

## Relevante Dateien

- `apps/web/src/components/content-editor-form.tsx`
- `apps/web/src/components/content-row-actions.tsx`
- `apps/web/src/app/dashboard/content/[id]/edit/page.tsx`
- `apps/web/src/app/api/content/[id]/route.ts`
- `apps/web/src/app/dashboard/content/page.tsx` (Aktionen-Spalte)
- `apps/web/src/lib/api-server.ts` (`getContent`, `ContentDetail`)

## Offene Punkte

- Medien und Benutzer haben noch keine entsprechende Bearbeiten/Löschen-UI
  – siehe [`docs/ROADMAP.md`](../docs/ROADMAP.md) Phase 2 (die beiden
  verbleibenden Punkte aus derselben Gruppe).
