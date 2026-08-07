# Navigationsverwaltung (Menüs)

**Datum:** 2026-08-06
**Betroffene Bereiche:** apps/api (`src/navigation`), apps/web
(`src/components/{navigation-dialog,navigations-manager,
navigation-item-dialog,navigation-items-editor}.tsx`,
`src/app/dashboard/navigation/`)

## Was wurde gebaut

- Neue Modelle `Navigation` (Name/Slug) und `NavigationItem` (Label,
  genau eines von `contentId`/`externalUrl`, `parentId` für **beliebig
  tiefe Verschachtelung**, `sortOrder`), eigenes Modul `src/navigation/`.
- CRUD unter `/v1/navigations`, gegated über `settings:manage`
  (site-weite Struktur-Konfiguration, analog Webhooks – siehe
  [publishing-automation.md](./publishing-automation.md)).
- `POST/PATCH .../items` validiert **genau ein** Ziel (Seite/Inhalt ODER
  externe URL, nie beides/keins), `PATCH .../items/reorder` mit
  Batch-weitem Zyklen-Schutz (siehe Stolpersteine).
- Neue Seiten `/dashboard/navigation` (Liste aller Menüs) und
  `/dashboard/navigation/[id]` (Detail: Name/Slug bearbeiten, Einträge
  hinzufügen/verschachteln/umsortieren/löschen, Ziel-Auswahl aus einer
  flachen Inhalte-Liste). Menüpunkt "Navigation" in der Sidebar unter
  "Inhalte".

## Warum diese Lösung

- **Mehrere benannte Menüs statt eines einzigen globalen Baums**:
  explizite Nutzerentscheidung bei Rückfrage – man legt z.B.
  "Hauptmenü" und "Footer" als eigenständige Bäume an, Einträge
  innerhalb eines Menüs lassen sich beliebig tief verschachteln.
- **`content:read`/eigenständige Content-Zuweisung statt eigener
  Seitenbaum-Hierarchie**: ein früherer Versuch dieses Features hatte
  zusätzlich eine eigene Parent-/Child-Struktur direkt am `Content`-
  Modell (`parentId`/`sortOrder`/`path`, verschachtelte URLs wie
  `/eltern/kind`) eingeführt – auf ausdrücklichen Nutzerwunsch wieder
  entfernt ("das jetzige macht keinen Sinn ... ändere es so, das man
  menüs erstellen kann und die endlos verschachteln kann"). Die
  Organisation läuft jetzt **ausschließlich** über die Menü-Struktur;
  `Content` selbst hat keine eigene Hierarchie oder verschachtelte URL
  mehr (zurück zur ursprünglichen, flachen `@@unique([slug, locale])`).
  Siehe "Verworfener Ansatz" unten.

## Verworfener Ansatz (2026-08-06, noch am selben Tag zurückgebaut)

Erste Umsetzung von Roadmap-Punkt 2b.8 baute zwei parallele Systeme:
einen "Seitenbaum" (`Content.parentId`/`sortOrder`/`path`,
`GET /content/tree`, `PATCH /content/reorder`, eigene Baum-UI unter
`/dashboard/content/tree`, `AppSettings.homepageContentId` für eine
Startseiten-Markierung) **und** die hier beschriebene
Navigationsverwaltung nebeneinander. Nutzer-Feedback: diese Trennung
war nicht nachvollziehbar ("ich verstehe das mit der navigation und
seitenbaum nicht. das macht für mich keinen sinn"). Der Seitenbaum
wurde komplett zurückgebaut (Migration
`20260806210000_remove_content_hierarchy`, Rückkehr zu
`@@unique([slug, locale])`), die Navigationsverwaltung blieb als
alleinige Organisationsstruktur bestehen. Der zugehörige alte
Wissenseintrag (`content-hierarchy-and-navigation.md`) wurde in diese
Datei überführt.

**Lehre für künftige Roadmap-Punkte mit mehreren Teilaspekten**: wenn
ein Roadmap-Punkt wie "Seitenbaum mit Navigation" mehrere, für den
Nutzer möglicherweise redundant wirkende Konzepte bündelt, lohnt sich
eine Rückfrage zum genauen Scope **vor** der Implementierung (wurde bei
diesem Feature verpasst – die Klärung kam erst nach dem ersten,
kompletten Durchgang).

## Stolpersteine / Besonderheiten

- **Batch-Zyklenschutz bei Drag&Drop**: eine einzelne Verschiebung kann
  isoliert betrachtet gültig aussehen, aber in Kombination mit anderen
  Verschiebungen im selben Reorder-Batch einen Zyklus bilden (A wird
  Kind von B, B wird im selben Aufruf Kind von A).
  `NavigationService.reorderItems()` baut deshalb zuerst eine
  "Override-Map" aus dem gesamten Batch und läuft jede Eltern-Kette
  **inklusive dieser Overrides** ab, bevor irgendetwas geschrieben wird.
- **Lösch-Verhalten der Verschachtelung**: `NavigationItem.parent` nutzt
  `onDelete: SetNull` – löscht man einen Eintrag mit Untereinträgen,
  werden die Kinder nicht mitgelöscht, sondern rücken auf die oberste
  Ebene der Navigation.
- **Content-Auswahl im Dialog ist eine flache, auf 100 Einträge
  begrenzte Liste** (`getContentList({ pageSize: 100 })`), kein
  dedizierter Suchendpoint – bei mehr als 100 Inhalten müsste hier
  nachgerüstet werden (bewusst pragmatisch für den aktuellen
  Projektumfang).

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`Navigation`,
  `NavigationItem`), Migration
  `20260806190000_add_content_hierarchy_and_navigation` (Navigation-Teil
  weiterhin gültig; der Content-Hierarchie-Teil wurde durch die
  Rollback-Migration `20260806210000_remove_content_hierarchy` wieder
  entfernt)
- `apps/api/src/navigation/` (komplettes Modul: `navigation.module.ts`,
  `navigation.controller.ts`, `navigation.service.ts`, `dto/`)
- `apps/web/src/lib/api-server.ts` (`NavigationSummary`,
  `NavigationDetail`, `NavigationItemNode`)
- `apps/web/src/app/api/navigations/**` (BFF-Routen)
- `apps/web/src/components/navigation-dialog.tsx`,
  `navigations-manager.tsx`, `navigation-item-dialog.tsx`,
  `navigation-items-editor.tsx`
- `apps/web/src/app/dashboard/navigation/{page.tsx,[id]/page.tsx}`
- `apps/web/src/components/app-sidebar.tsx` (Menüpunkt "Navigation"
  unter "Inhalte")
- `apps/api/test/navigation.e2e-spec.ts` (15 Tests: CRUD,
  Permission-Gating, Ziel-Validierung, Verschachtelung, Zyklen-Schutz,
  Cascade-Löschen)

## Offene Punkte

- Kein Deep-Link/Highlight für Menü-Einträge aus der globalen Suche
  (Navigation ist aktuell kein eigener Suchbereich).
- Content-Picker im "Eintrag hinzufügen"-Dialog ist eine flache Liste
  ohne Live-Suche/Filterung – bei vielen Inhalten unhandlich, siehe
  Stolpersteine.
