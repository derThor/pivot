# Tags-Neugestaltung + globale Zeilen-Aktionen: immer sichtbare Icon-Buttons statt Kebab-Menü

**Datum:** 2026-08-16
**Betroffene Bereiche:** apps/api (`src/tags`), apps/web (fast alle
Listen-Ansichten), packages/database (`Tag.createdAt`)

> **Update 2026-08-15 (Feinschliff "Alle Tags"-Pillen):** "einmal kein
> bg, hier weiss. bg nur bei counter anzahl" – die Pillen in der "Alle
> Tags"-Übersicht nutzten `bg-background` (fast, aber nicht ganz weiß –
> `--background` ist in Light-Mode minimal grauer als `--card`), dadurch
> minimal sichtbarer Farbunterschied zur weißen Karte dahinter. Fix:
> `bg-background` → `bg-card` (theme-fähiges "echtes Weiß" statt
> hartkodiertem `bg-white`, bleibt auch im Dark-Mode korrekt) – nur die
> kleine Zähler-Badge (`{tag.mediaCount}`) behält weiterhin `bg-muted`.
> Zusätzlich: Tabellenkopf (`TableHeader`) auf der Tags-Seite bekam
> `className="bg-background"` (Nutzervorgabe "unter tags den header mit
> hintergrundfarbe wie main") – bewusst nur lokal auf dieser Seite
> gesetzt, nicht in der geteilten `ui/table.tsx`, da das alle anderen
> Listen-Seiten mitverändert hätte.

## Was wurde gebaut

1. **Tags-Seite komplett neu** (`tags-manager.tsx`, ersetzt die generische
   `TaxonomyManager`-Tabelle nur für Tags, 1:1 nach Bildvorlage):
   - "Alle Tags"-Übersichtskarte: jeder Tag als farbige Pill (Punkt + Name
     + Verwendungs-Zahl-Badge), zeigt **alle** Tags unabhängig von der
     Tabellen-Pagination (neuer Endpoint `GET /tags/all`,
     `TagsService#findAllUnpaginated`).
   - Tabelle darunter: Spalten Tag (Punkt+Name)/Verwendet in (`N Medien`)/
     Erstellt (Datum)/Aktionen. Keine Checkbox-Spalte/Massenauswahl mehr
     (in der Vorlage nicht vorhanden – bewusste Abweichung von der
     generischen `TaxonomyManager`, die Massenauswahl behält).
   - Neue Backend-Felder: `Tag.createdAt` (Migration, vorher nicht
     vorhanden), `mediaCount` (`_count.media` in `TagsService#findAll`/
     `findAllUnpaginated`, nicht im Schema persistiert). `mediaCount`
     zählt **nur** `MediaTag`-Verknüpfungen, nicht `ContentTag` – die
     Bildvorlage beschriftet die Spalte explizit "Medien", nicht
     "Verwendungen" allgemein.
   - Farbige Punkte: kein `color`-Feld im `Tag`-Modell, rein dekorativ per
     Hash der Tag-ID aus einer festen 8er-Palette gewählt
     (`lib/tag-colors.ts#tagDotColor`) – bleibt dadurch über
     Pagination/Übersichtsleiste hinweg für denselben Tag stabil, ohne
     eine neue, nutzerseitig zu pflegende Einstellung einzuführen.
2. **Globale Umstellung der Zeilen-Aktionen** von einem ⋮-Kebab-Menü
   (`DropdownMenu` mit "Bearbeiten"/"Löschen"-Items) auf immer sichtbare,
   quadratische Icon-Buttons (`components/row-action-buttons.tsx`, neue
   geteilte Komponente: `Pencil` in `variant="outline"`, `Trash2` in
   `variant="destructive"` – beide bereits korrekt eingefärbt durch die
   globale Button-Varianten-Konvention, siehe
   [design-refresh.md](./design-refresh.md)). **Reversiert damit
   bewusst** die Kebab-Entscheidung vom 2026-08-05 (dort dokumentiert als
   "konsistentes Muster über alle Listen") – neue, explizite
   Nutzervorgabe. Umgestellt: `taxonomy-manager.tsx` (Kategorien),
   `role-row-actions.tsx`, `user-row-actions.tsx`, `webhooks-manager.tsx`
   (nur Löschen, kein Bearbeiten), `faq-groups-manager.tsx`
   (Gruppen-Kopfzeile, `size="icon-sm"` fürs kompakte Layout).
   Bei mehr als zwei Aktionen (Vorschau/Öffnen/Link-kopieren zusätzlich zu
   Bearbeiten/Löschen) als dritter, gleich gestalteter Icon-Button über
   den neuen `extra`-Prop von `RowActionButtons` ergänzt statt eines
   Dropdowns: `content-row-actions.tsx` (+Vorschau), `navigations-manager.tsx`
   (+Öffnen), `preview-links-table.tsx` (+Link kopieren, Icon wechselt
   Copy→Check).
3. **Bewusst NICHT umgestellt** (Kebab bleibt): `media-card-actions.tsx`
   (Karten-Ecke über einem Bild, bereits 6 `ghost`-Icon-Buttons in einer
   Reihe – kein Bearbeiten/Löschen-Paar, sondern viele gleichrangige
   Aktionen, quadratische Outline-Buttons hätten keinen Platz),
   `folder-tile-menu.tsx` (kompakter `size-6`-Kreis-Trigger über einer
   kleinen Ordner-Kachel, zu wenig Platz für zwei quadratische Buttons),
   `gallery-grid.tsx` (dunkel getönter Kreis-Trigger über einem
   Foto-Streifen für Kontrast – ein helles Outline-Quadrat wäre auf
   beliebigen Fotos oft unleserlich, nur eine Aktion ohnehin).

## Warum diese Lösung

- **`RowActionButtons` als einzige geteilte Komponente statt Kopieren des
  Markups** in jede Datei: `onEdit`/`onDelete` beide optional (Webhooks
  hat keine Bearbeiten-Aktion, Rollen/Benutzer blenden Löschen bedingt
  aus), `extra`-Slot für Sonderfälle statt einer starren Zwei-Button-API.
- **`rounded-lg` statt der `rounded-full`-Basis der `icon`/`icon-sm`-
  Button-Varianten**: bewusster visueller Unterschied zu echten runden
  Trigger-Icons (Glocke, Avatar, Kebab-Reste in `media-card-actions.tsx`)
  – quadratisch signalisiert "Zeilen-Aktions-Paar", rund "Menü-/Profil-
  Trigger".
- **`GET /tags/all` als eigener Endpoint statt großer `pageSize`**: die
  Übersichtsleiste soll unabhängig von der Tabellen-Pagination
  *garantiert* alle Tags zeigen, nicht nur zufällig alle, weil
  `pageSize` groß genug gewählt wurde.
- **Nur `media`-Verknüpfung gezählt, nicht `contents`**: 1:1 nach
  Bildvorlage ("X Medien"); eine kombinierte Zahl hätte die Beschriftung
  irreführend gemacht.

## Stolpersteine / Besonderheiten

- **Route-Reihenfolge bei `/tags/all`**: `@Get('all')` vor `@Get(':id/page')`
  im Controller definiert – hier unproblematisch, da unterschiedliche
  Segment-Anzahl (`all` = 1 Segment, `:id/page` = 2), aber als Konvention
  beibehalten (spezifischere/statische Routen vor Parameter-Routen).
- **Migration `add_tag_created_at` brauchte denselben Windows-Prisma-
  Client-Lock-Workaround** wie bereits in
  [toast-and-system-messages.md](./toast-and-system-messages.md)
  dokumentiert (API-Dev-Prozess killen, migrieren, `pnpm dev` neu
  starten).
- **`RowActionButtons`s `onDelete`/`onEdit` als reine `onClick`-Handler,
  kein `render`-Prop**: Bearbeiten ist in den meisten Dateien ein
  Dialog-Open (`setEditOpen(true)`), in `content-row-actions.tsx` aber
  eine echte Navigation (`router.push(...)`) – beides passt ohne
  Sonderfall in dieselbe `onClick`-Signatur, ein `Link`-Ziel für
  Bearbeiten kam daher nirgends vor; für den `extra`-Slot (z.B.
  "Vorschau öffnen" per `<Link target="_blank">`) wird stattdessen ein
  eigener, gleich gestalteter `Button` mit `render`-Prop übergeben statt
  die geteilte Komponente dafür zu erweitern.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`Tag.createdAt`), Migration
  `add_tag_created_at`
- `apps/api/src/tags/{tags.service,tags.controller}.ts`
- `apps/web/src/lib/api-server.ts` (`Tag`/`TagListResponse`, `getAllTags`)
- `apps/web/src/lib/tag-colors.ts` (neu)
- `apps/web/src/components/tags-manager.tsx` (neu),
  `apps/web/src/app/dashboard/tags/page.tsx`
- `apps/web/src/components/row-action-buttons.tsx` (neu)
- `apps/web/src/components/taxonomy-manager.tsx`, `role-row-actions.tsx`,
  `user-row-actions.tsx`, `webhooks-manager.tsx`, `faq-groups-manager.tsx`,
  `content-row-actions.tsx`, `navigations-manager.tsx`,
  `preview-links-table.tsx`

## Offene Punkte

- `media-card-actions.tsx`s Lösch-Icon nutzt weiterhin `variant="ghost"`
  statt `variant="destructive"` (kosmetische Inkonsistenz, bewusst nicht
  angefasst – siehe "bewusst nicht umgestellt" oben).
- Kategorien-Tabelle (`taxonomy-manager.tsx`) behält Checkbox-
  Massenauswahl, die neue Tags-Ansicht nicht – zwei Listen mit
  unterschiedlichem Funktionsumfang für dasselbe zugrunde liegende
  Taxonomie-Konzept, bewusst so belassen (1:1 nach Bildvorlage für Tags).
