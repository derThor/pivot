# Globale Suche (Postgres `tsvector` + bereichsübergreifend)

**Datum:** 2026-08-06
**Betroffene Bereiche:** apps/api (`src/search`, `src/content`), apps/web
(`src/components/{global-search,dashboard-header}.tsx`,
`src/app/api/{search,content}/route.ts`)

> **Update 2026-08-06 (auf alle Bereiche erweitert, Präfix-Suche,
> kein Dropdown ohne Eingabe):** Ursprünglich war die Suche auf
> `Content` beschränkt (`GET /v1/content/search`) und öffnete bei
> Fokus bereits ein Dropdown mit den zuletzt bearbeiteten Inhalten. Auf
> Nutzerwunsch grundlegend erweitert:
> - **Neues, eigenständiges `search`-Modul** (`GET /v1/search`) statt
>   des content-spezifischen Endpoints – bündelt die
>   Content-Volltextsuche mit einfachen Suchen über `Category`, `Tag`
>   und `Media`, jeder Treffer trägt ein `type`-Feld
>   (`content`/`category`/`tag`/`media`), das Frontend zeigt es als
>   Badge ("Inhalt"/"Kategorie"/"Tag"/"Medium") neben dem Titel.
> - **Präfix-Suche statt `websearch_to_tsquery`**: Da das Frontend schon
>   ab 3 eingegebenen Zeichen sucht ("live"), musste die `tsquery` auf
>   Präfix-Matching umgestellt werden (`begriff:*` statt eines ganzen
>   Wortstamms) – siehe Stolpersteine unten, war ein echter Bug, kein
>   nur-theoretisches Detail (per Live-Test gefunden: "Tes" fand "Test"
>   vorher nicht).
> - **Kein Dropdown mehr bei bloßem Fokus/Klick**: die "zuletzt
>   bearbeitet"-Vorschau bei leerer Eingabe wurde entfernt. Das Dropdown
>   öffnet jetzt ausschließlich, wenn mindestens 3 Zeichen eingegeben
>   wurden – reines Klicken ins Suchfeld hat keinen sichtbaren Effekt
>   mehr, exakt wie angefordert.

## Was wurde gebaut

- `GET /v1/search?q=&limit=` – kein `@RequirePermission`, jeder
  eingeloggte Dashboard-Nutzer darf grundsätzlich suchen. Innerhalb von
  `SearchService.search()` wird aber **pro Bereich** die passende
  `:read`-Permission des Nutzers geprüft (`content:read`,
  `categories:read`, `tags:read`, `media:read`) – ein Nutzer ohne
  `media:read` bekommt nie Medien-Treffer, auch über die globale Suche
  nicht. Die vier Teil-Suchen laufen parallel (`Promise.all`).
- **Content**: weiterhin Postgres-Volltextsuche
  (`ContentService.search()`, wiederverwendet über einen
  `ContentModule`-Export) über Titel + Excerpt + SEO-Felder + den
  kompletten dynamischen `data`-Body (`data::text`-Cast) – durchsucht
  wirklich den gesamten Inhalt, nicht nur den Titel.
- **Kategorien/Tags/Medien**: einfache case-insensitive
  `contains`-Filter über Prisma (Name/Beschreibung bzw. Dateiname/Alt-Text)
  – kein `tsvector` nötig, da die Textfelder kurz sind und `contains`
  ohnehin bereits jede Teilstring-Position matcht (Präfix-Problem wie
  bei Content tritt hier gar nicht erst auf).
- Frontend: `GlobalSearch`-Client-Komponente im Dashboard-Header.
  Verhalten:
  - Eingabefeld allein (Fokus/Klick) → **kein** Dropdown, keine Anfrage.
  - Ab 3 eingegebenen Zeichen → 300ms debounced `GET
    /api/search?q=…&limit=5`, Dropdown öffnet sich mit Treffern aus
    allen vier Bereichen, je Treffer Icon (Datei/Ordner/Tag/Bild) +
    Titel + Bereichs-Badge.
  - Klick auf einen Treffer navigiert bereichsabhängig:
    `content` → `/dashboard/content/:id/edit`, `category` →
    `/dashboard/categories`, `tag` → `/dashboard/tags`, `media` →
    `/dashboard/media` (die drei letzteren ohne Deep-Link auf den
    genauen Eintrag, siehe Offene Punkte).
  - Schließen per Klick außerhalb oder Escape.

## Warum diese Lösung

- **Eigenes `SearchModule` statt Erweiterung von `ContentController`**:
  die Suche spannt jetzt vier verschiedene Ressourcen-Typen auf – ein
  bereichsübergreifender Endpoint gehört konzeptionell nicht unter
  `/content`. `ContentService` bleibt Single Source of Truth für die
  Content-Suche (`SearchService` injiziert sie, keine Code-Duplikation).
- **Permission-Filterung pro Bereich statt einer einzelnen Permission
  fürs ganze Such-Endpoint**: ein Nutzer mit nur `content:read` (z.B.
  eine reine Autoren-Rolle ohne Medienrechte) soll über die Suche nicht
  querlesen können, was ihm die normale Medien-/Kategorien-/Tags-Liste
  verwehrt. Die Alternative (eine einzelne `search`-Permission) hätte
  entweder alles-oder-nichts freigegeben oder eine zusätzliche,
  redundante Permission gebraucht.
- **Präfix-`tsquery` (`begriff:*`) statt `websearch_to_tsquery`**:
  `websearch_to_tsquery` matcht nur vollständige (gestemmte) Wörter –
  für Such-als-du-tippst-UX mit 3-Zeichen-Minimum ist Präfix-Matching
  zwingend. Der `tsQuery`-String wird serverseitig aus dem Roheingabe-Text
  gebaut: pro Leerzeichen-getrenntem Wort werden alle
  Nicht-Buchstaben/Zahlen entfernt (verhindert kaputte `tsquery`-Syntax
  bei Sonderzeichen) und `:*` angehängt, leere Wörter werden verworfen;
  ist das Ergebnis leer, wird direkt `[]` zurückgegeben statt Postgres
  mit einer leeren `tsquery` zu befragen.
- **Kein Dropdown bei bloßem Fokus**: explizite Nutzeranforderung ("wenn
  man die suche anklickt, soll erstmal nichts passieren"), ersetzt die
  vorherige "zuletzt bearbeitet"-Vorschau ersatzlos.

## Stolpersteine / Besonderheiten

- **`websearch_to_tsquery` matcht keine Wort-Präfixe** – beim ersten
  Live-Test fand die Eingabe "Tes" den Content-Eintrag "Test" nicht
  (erst nach Eingabe des vollständigen Worts). Kein Rand-/Theoriefall,
  sondern per `curl` reproduzierter, echter Bug, noch bevor Nutzer ihn
  gemeldet hätten. Fix: eigene Präfix-`tsquery` statt
  `websearch_to_tsquery` (siehe oben).
- **Routen-Reihenfolge im Controller**: `@Get('search')` (jetzt auf
  `SearchController`, vorher auf `ContentController`) muss vor jeder
  `@Get(':id')`-Route eines Controllers stehen, sonst matcht NestJS die
  ID-Route fälschlich zuerst.
- **`ContentModule` musste `ContentService` explizit exportieren**
  (`exports: [ContentService]`), damit `SearchModule` sie importieren
  kann – war vorher nicht exportiert, da `ContentService` bis dahin nur
  innerhalb des eigenen Moduls gebraucht wurde.

## Relevante Dateien

- `apps/api/src/search/{search.module,search.controller,search.service}.ts`,
  `dto/global-search.dto.ts`
- `apps/api/src/content/content.service.ts` (`search()`, jetzt mit
  Präfix-`tsquery`), `content.module.ts` (Export)
- `apps/web/src/components/global-search.tsx`,
  `src/components/dashboard-header.tsx`
- `apps/web/src/app/api/search/route.ts` (neuer BFF-Endpoint)
- `apps/api/test/global-search.e2e-spec.ts` (401/400, Treffer über alle
  vier Bereiche, Permission-Scoping, Präfix-Suche mit 3 Zeichen),
  `apps/api/test/content.e2e-spec.ts` (Content-Suche im dynamischen
  Body)

## Offene Punkte

- Kein GIN-Index / materialisierte `tsvector`-Spalte – bei sehr vielen
  Content-Einträgen würde die Live-Berechnung pro Query langsamer.
- Kategorie-/Tag-/Medien-Treffer verlinken nur auf die jeweilige
  Listen-Seite, nicht direkt auf den konkreten Eintrag (kein
  Deep-Link/Highlight-Mechanismus für einzelne Zeilen vorhanden).
- Kein signierter Vorschau-Link aus den Suchergebnissen (siehe separater
  Roadmap-Punkt "Content-Vorschau-Links", noch offen).
- Benutzer/Rollen werden nicht durchsucht (bewusst auf Content-nahe
  Bereiche begrenzt, wie angefragt).
