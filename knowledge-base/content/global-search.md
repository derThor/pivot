# Globale Suche (Postgres `tsvector` + bereichsübergreifend)

**Datum:** 2026-08-06
**Betroffene Bereiche:** apps/api (`src/search`, `src/content`), apps/web
(`src/components/{global-search,dashboard-header}.tsx`,
`src/app/api/{search,content}/route.ts`)

> **Update 2026-08-06 (Vorschau-Links ergänzt):** Auf Nutzerwunsch
> ("vorschaulink in der suche berücksichtigen, merken: alles neue in der
> suche berücksichtigen und entsprechend farblich flaggen" – siehe auch
> die Standing-Rule dazu) um den Bereich `previewLink` erweitert, gegated
> auf `content:read` (dieselbe Permission wie das Anlegen/Auflisten der
> Links selbst). Gesucht wird über den **Titel des verknüpften Inhalts**
> (`content.title`), nicht über den Token selbst (ein zufälliger
> Hex-String, für Volltextsuche bedeutungslos) – nur nicht abgelaufene
> Links (`expiresAt > now`) tauchen auf. Badge-Farbe: Cyan (neu, bisher
> unbenutzt), Icon `Link2` (dasselbe wie im `PreviewLinksDialog`/der
> Sidebar), Klick navigiert zur inhaltsübergreifenden Liste
> `/dashboard/content/preview-links`. Damit deckt die Suche jetzt
> **sieben** Bereiche ab.

> **Update 2026-08-06 (Deep-Link + Wort-Markierung + Pagination-Sprung):**
> Auf Nutzerwunsch ("wenn man in der suche das gewünschte anklickt, soll
> direkt dahingesprungen werden und das suchwort markiert" /
> "wo es eine detailseite gibt, sofort zur detailseite springen, ohne
> markieren" / "bedenke beim hinspringen das pagination, immer auf die
> richtige seite springen"): Klick auf einen Treffer springt jetzt
> gezielt zum Eintrag, nicht mehr nur auf die generische Listen-Seite:
> - **Content** hat eine echte Detailseite (der Editor) – dahin wird wie
>   bisher direkt verlinkt, ohne Markierung (macht dort keinen Sinn).
> - **Kategorie/Tag/Medium/Benutzer/Rolle/Vorschau-Link** werden nur per
>   Dialog auf ihrer Listen-Seite bearbeitet, keine eigene Detailroute.
>   Für sie: (1) neuer Backend-Endpoint `GET /v1/<ressource>/:id/page`
>   pro betroffenem Modul (`categories`, `tags`, `roles`, `users`,
>   `media`, `content/preview-links`) ermittelt anhand der **exakt
>   gleichen Sortierung wie die jeweilige Listen-Seite** (nicht die
>   Sortierung der Suche selbst – die weicht z.B. bei `users` ab, siehe
>   Stolpersteine), auf welcher Seite der Eintrag bei gegebener
>   `pageSize` liegt (`rank = count(… vor diesem Eintrag …)`,
>   `page = floor(rank / pageSize) + 1`). Für `media` zusätzlich
>   `folderId`, weil die Medien-Übersicht ordnergefiltert ist – ein
>   Treffer aus einem Unterordner taucht auf der Root-Seite nie auf,
>   ohne Ordnerwechsel würde man ins Leere springen. (2) Frontend ruft
>   vor der Navigation eine neue, generische BFF-Route
>   `GET /api/search/locate?type=&id=&pageSize=` auf (mappt `type` auf
>   den richtigen Backend-Pfad, ein einziges File statt sechs
>   Fast-Duplikaten), hängt `?page=&folder=&highlight=<id>&q=<begriff>`
>   an die Ziel-URL an.
> - Neuer Hook `useHighlightParam(prefix)` (`apps/web/src/hooks/`): liest
>   `highlight`/`q` aus der URL, scrollt das Element mit
>   `id={`${prefix}-${id}`}` ins Blickfeld (`scrollIntoView`), liefert
>   die aktive ID zurück. **Markierung bleibt bestehen, bis irgendwo auf
>   der Seite geklickt wird** (expliziter Nutzerwunsch, kein Auto-Timeout)
>   – ein `document`-Click-Listener in der Capture-Phase, `{ once: true }`.
> - Neue Komponente `HighlightText` (`apps/web/src/components/`): hebt
>   das erste Vorkommen von `q` im angezeigten Text farblich hervor
>   (`<mark>`, Orange, `transition-colors` für sanftes Verblassen) – **im
>   Text selbst, nicht als Zeilen-Hintergrund** (erste Version hatte
>   testweise den ganzen Zeilen-Hintergrund eingefärbt, das war
>   ausdrücklich nicht gewollt: "das wort soll gehilightet werden, nicht
>   die spalte vom background her").
> - Bekannte Grenze: die Rangberechnung ist ein einfacher `count(…)`
>   über dasselbe Sortierfeld – bei sehr vielen exakt gleichen Werten
>   (z.B. viele Kategorien mit identischem Namen, was durch die
>   Unique-Constraint ohnehin ausgeschlossen ist) wäre das Ranking nicht
>   exakt, praktisch kein Problem in diesem Projekt.

> **Update 2026-08-06 (Benutzer + Rollen ergänzt, farbige Bereichs-Badges):**
> Auf Nutzerwunsch um zwei weitere Bereiche erweitert: `User`
> (Vorname/Nachname/E-Mail) und `Role` (Name/Beschreibung), gegated über
> die jeweils schon vorhandene `users:manage`/`roles:manage`-Permission
> (dieselbe, die auch `GET /users`/`GET /roles` schützt – es gibt dort
> anders als bei Content/Kategorien/Tags/Medien keine separate
> `:read`-Permission). Damit deckt die Suche jetzt **sechs** Bereiche ab.
> Frontend: jede Bereichs-Badge hat jetzt eine eigene Farbe statt
> einheitlichem Grau (Inhalt=Blau, Kategorie=Violett, Tag=Amber,
> Medium=Grün, Benutzer=Rosa, Rolle=Indigo) – gleiches Farbmuster wie die
> Status-Badges in `content-table.tsx`, damit auf einen Blick erkennbar
> ist, aus welchem Bereich ein Treffer stammt.

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
  Permission des Nutzers geprüft (`content:read`, `categories:read`,
  `tags:read`, `media:read`, `users:manage`, `roles:manage`) – ein
  Nutzer ohne `media:read` bekommt nie Medien-Treffer, ein Nutzer ohne
  `users:manage` nie Benutzer-Treffer, auch über die globale Suche
  nicht. Alle Teil-Suchen laufen parallel (`Promise.all`).
- **Content**: weiterhin Postgres-Volltextsuche
  (`ContentService.search()`, wiederverwendet über einen
  `ContentModule`-Export) über Titel + Excerpt + SEO-Felder + den
  kompletten dynamischen `data`-Body (`data::text`-Cast) – durchsucht
  wirklich den gesamten Inhalt, nicht nur den Titel.
- **Kategorien/Tags/Medien/Benutzer/Rollen**: einfache case-insensitive
  `contains`-Filter über Prisma (Name/Beschreibung, Dateiname/Alt-Text,
  Vorname/Nachname/E-Mail, Name/Beschreibung) – kein `tsvector` nötig,
  da die Textfelder kurz sind und `contains` ohnehin bereits jede
  Teilstring-Position matcht (Präfix-Problem wie bei Content tritt hier
  gar nicht erst auf).
- Frontend: `GlobalSearch`-Client-Komponente im Dashboard-Header.
  Verhalten:
  - Eingabefeld allein (Fokus/Klick) → **kein** Dropdown, keine Anfrage.
  - Ab 3 eingegebenen Zeichen → 300ms debounced `GET
    /api/search?q=…&limit=5`, Dropdown öffnet sich mit Treffern aus
    allen sechs Bereichen, je Treffer Icon + **farbige** Bereichs-Badge
    (Inhalt=Blau, Kategorie=Violett, Tag=Amber, Medium=Grün,
    Benutzer=Rosa, Rolle=Indigo) + Titel.
  - Klick auf einen Treffer navigiert bereichsabhängig:
    `content` → `/dashboard/content/:id/edit`, `category` →
    `/dashboard/categories`, `tag` → `/dashboard/tags`, `media` →
    `/dashboard/media`, `user` → `/dashboard/users`, `role` →
    `/dashboard/roles` (alle außer `content` ohne Deep-Link auf den
    genauen Eintrag, siehe Offene Punkte).
  - Schließen per Klick außerhalb oder Escape.

## Warum diese Lösung

- **Eigenes `SearchModule` statt Erweiterung von `ContentController`**:
  die Suche spannt jetzt sechs verschiedene Ressourcen-Typen auf – ein
  bereichsübergreifender Endpoint gehört konzeptionell nicht unter
  `/content`. `ContentService` bleibt Single Source of Truth für die
  Content-Suche (`SearchService` injiziert sie, keine Code-Duplikation).
- **Permission-Filterung pro Bereich statt einer einzelnen Permission
  fürs ganze Such-Endpoint**: ein Nutzer mit nur `content:read` (z.B.
  eine reine Autoren-Rolle ohne Medienrechte) soll über die Suche nicht
  querlesen können, was ihm die normale Medien-/Kategorien-/Tags-/
  Benutzer-/Rollen-Liste verwehrt. Für Benutzer/Rollen gibt es (anders
  als bei Content/Kategorien/Tags/Medien) keine separate
  `:read`-Permission – dort wird `users:manage`/`roles:manage` geprüft,
  dieselbe Permission, die auch die normalen `GET
  /users`/`GET /roles`-Endpoints schützt. Die Alternative (eine
  einzelne `search`-Permission) hätte entweder alles-oder-nichts
  freigegeben oder eine zusätzliche, redundante Permission gebraucht.
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
- **Sortierung der Suche ≠ Sortierung der Listen-Seite**: `searchUsers()`
  in `SearchService` sortiert nach `lastName asc` (sinnvoll für eine
  Ergebnisliste), aber `UsersService.findAll()` (die echte
  Benutzer-Übersicht) sortiert nach `createdAt desc`. Der
  `:id/page`-Endpoint für den Pagination-Sprung **muss** die Sortierung
  der Listen-Seite verwenden, nicht die der Suche – sonst würde die
  berechnete Seitenzahl nicht zu dem passen, was die Zielseite
  tatsächlich anzeigt. Beim Bauen des Features zunächst übersehen, beim
  Nachschauen der `findAll()`-Methoden aufgefallen, bevor es zum Bug
  wurde.
- **`figure`/`<mark>` statt Zeilen-Hintergrund**: eine erste Version
  färbte die ganze `TableRow`/Media-Karte ein (`bg-orange-100/70` bzw.
  `ring-2`) – auf expliziten Nutzerwunsch durch eine reine
  Text-Markierung im jeweiligen Titel-/Namensfeld ersetzt.

## Relevante Dateien

- `apps/api/src/search/{search.module,search.controller,search.service}.ts`
  (`searchPreviewLinks()`), `dto/global-search.dto.ts`
- `apps/api/src/common/dto/find-page.dto.ts` (geteiltes `pageSize`-DTO
  für alle `:id/page`-Endpoints)
- `apps/api/src/{categories,tags,roles,users,media}/*.service.ts`
  (`findPage()`), `*.controller.ts` (`GET :id/page`)
- `apps/api/src/content/content.service.ts` (`search()` mit
  Präfix-`tsquery`, `findPreviewLinkPage()`), `content.controller.ts`
  (`GET preview-links/:linkId/page`), `content.module.ts` (Export)
- `apps/web/src/components/{global-search,dashboard-header}.tsx`
- `apps/web/src/hooks/use-highlight-param.ts`,
  `src/components/highlight-text.tsx`
- `apps/web/src/components/{taxonomy-manager,users-table,roles-table,media-grid,preview-links-table}.tsx`
  (alle nutzen `useHighlightParam` + `HighlightText`)
- `apps/web/src/app/api/search/{route.ts,locate/route.ts}` (neue
  generische BFF-Route für den Pagination-Sprung)
- `apps/web/src/app/dashboard/layout.tsx` (reicht `defaultPageSize` bis
  zu `GlobalSearch` durch)
- `apps/api/test/global-search.e2e-spec.ts` (401/400, Treffer über alle
  sieben Bereiche inkl. Permission-Scoping für Benutzer/Rollen,
  Präfix-Suche mit 3 Zeichen), `apps/api/test/content.e2e-spec.ts`
  (Content-Suche im dynamischen Body)

## Offene Punkte

- Kein GIN-Index / materialisierte `tsvector`-Spalte – bei sehr vielen
  Content-Einträgen würde die Live-Berechnung pro Query langsamer.
- Kein e2e-Test für die neuen `:id/page`-Endpoints und die
  `/api/search/locate`-BFF-Route (nur manuell per `curl` gegen die
  laufenden Dev-Server verifiziert).
