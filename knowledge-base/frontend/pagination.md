# Pagination auf allen Listen-Seiten

**Datum:** 2026-08-04, Darstellung überarbeitet 2026-08-05
**Betroffene Bereiche:** apps/api (`src/{categories,tags,users,roles,settings}`),
apps/web (`src/components/pagination-controls.tsx`,
`src/components/settings-form.tsx`, `src/lib/api-server.ts`, alle
`src/app/dashboard/*/page.tsx`)

> **Update 2026-08-05 (nummerierte Seiten):** `PaginationControls` zeigt
> jetzt anklickbare Seitenzahlen statt nur Zurück/Weiter + Text (Vorgabe:
> Screenshot mit "‹ Previous 1 2 3 … Next ›"-Logik). Fenster aus
> aktueller Seite ± 1 Nachbar, plus immer Seite 1 und die letzte Seite,
> Lücken dazwischen als "…". Aktuelle Seite: `variant="default"` +
> `disabled` (kein Link, nur Hervorhebung) statt Link. Die vorherige
> "Seite X von Y (Z Einträge)"-Textzeile ist entfallen – die `total`-Prop
> wurde daher aus der Komponente **und** allen sieben Aufrufstellen
> entfernt, statt sie ungenutzt herumzureichen.

> **Update 2026-08-05 (Zahlen mittig, Pfeile rechts mit weißem
> Hintergrund):** Layout erneut angepasst: Seitenzahlen jetzt über
> `flex justify-center` in der vollen Breite des Containers zentriert,
> die Zurück/Weiter-Pillengruppe per `absolute right-0` unabhängig
> davon am rechten Rand fixiert (statt vorher alles gemeinsam
> rechtsbündig) – dafür der äußere Container `relative`. Pillengruppe
> bekommt zusätzlich `bg-card` + `shadow-card`, damit sie als klar
> abgesetzte "weiße" Fläche erkennbar ist (vorher transparent, verlor
> sich vor dem inzwischen grauen Seiten-Hintergrund). `mb-6` auf dem
> Wurzel-Element für mehr Abstand nach unten.

> **Update 2026-08-05 (Feinschliff nach Referenz-Screenshots):** Zwei
> weitere Anpassungen auf explizite Vorgabe: (1) zunächst zentriert
> (`justify-center`), (2) dann nach Vorlage eines Admin-Dashboard-
> Referenzdesigns ("Brinhildr"-Template-Screenshots, Orders-Tabelle)
> auf **rechtsbündig** (`justify-end`) umgestellt – die Referenz zeigt
> rechtsbündige Pagination, das überschreibt die vorherige Zentrierung.
> Seitenzahlen sind jetzt runde Pillen (`rounded-full`) statt eckiger
> Buttons, Zurück/Weiter sind reine Icon-Buttons (kein Text mehr,
> `aria-label` für Barrierefreiheit) in einer gemeinsamen, per Trenner
> geteilten Pillen-Gruppe am rechten Rand statt einzelner Buttons mit
> Text links/rechts der Zahlen. Nur die **Pagination-Komponente** wurde
> an das Referenzdesign angepasst – ein vollständiges Reskin (Sidebar-
> Farben, Header, Dashboard-Widgets/Charts, Badges) war nicht Teil
> dieser Änderung, da dafür keine visuelle Verifikation im Browser
> möglich war und das Referenzdesign fachlich nicht zum CMS-Datenmodell
> passt (Orders/Sellers/Clients aus einem E-Commerce-Template).

> **Update 2026-08-04 (konfigurierbare Seitengröße):** Die Default-
> `pageSize` (ursprünglich hartkodiert 20/24 je Ressource) ist jetzt eine
> Admin-Einstellung: `AppSettings.defaultPageSize` (Int, Default 10,
> 1-100), einstellbar über einen neuen Tab "Darstellung" auf
> `/dashboard/settings`. Alle sieben Listen-Seiten lesen den Wert über
> `getPublicSettings()` (nicht das geschützte `getSettings()` – der Wert
> muss für jede Rolle mit Dashboard-Zugriff lesbar sein, nicht nur für
> Admins mit `settings:manage`) und reichen ihn als `pageSize` an ihren
> jeweiligen Fetcher durch. Details siehe
> [settings-and-password-policy.md](../auth/settings-and-password-policy.md).

## Was wurde gebaut

- **Backend**: Content und Medien waren bereits vollständig paginiert
  (`page`/`pageSize`-Query-DTO, `{items, meta: {page, pageSize, total,
  pageCount}}`-Response). Kategorien, Tags, Benutzer und Rollen hatten
  bisher **keine** Pagination (`findAll()` lieferte ein ungefiltertes
  Array). Alle vier bekommen jetzt ein neues `dto/query-{resource}.dto.ts`
  (Default `page: 1`, `pageSize: 20`, `@Max(100)`) nach exaktem Vorbild
  von `apps/api/src/media/dto/query-media.dto.ts` –
  `{Resource}Service.findAll(query)` liefert jetzt `{items, meta}` statt
  eines flachen Arrays.
- **Frontend**: neue geteilte Komponente
  `apps/web/src/components/pagination-controls.tsx` – **keine**
  `"use client"`-Direktive nötig, da sie nur `next/link`-Links rendert
  (`page`, `pageCount`, `total`, `buildHref: (page) => string`). Rendert
  `null`, wenn `pageCount <= 1`. Alle sieben Listen-Seiten (Inhalte,
  Medien, Kategorien, Tags, Benutzer, Rollen, Versionshistorie eines
  Content-Eintrags) lesen jetzt `searchParams.page`, reichen ihn an den
  jeweiligen Fetcher durch und rendern die Komponente unter der
  Tabelle/dem Grid.
- `getCategories()`/`getTags()`/`getUsers()`/`getRoles()` in
  `lib/api-server.ts` bekommen optionale `{page?, pageSize?}`-Parameter
  und neue `*ListResponse`-Typen (`{items, meta}`) statt der bisherigen
  flachen Array-Rückgabe – exakt das Muster von `getMediaList()`/
  `getContentList()`.

## Warum diese Lösung

- **URL-getriebene Pagination statt Client-State**: Die Dashboard-Seiten
  sind bereits Server Components, die `searchParams` lesen (Muster aus
  der Medien-Ordner-Navigation, `?folder=<id>`, siehe
  [media-folders.md](../media/media-folders.md)). Ein neuer
  `?page=<n>`-Parameter fügt sich nahtlos ein – die Pagination-Buttons
  sind einfache `Link`s, kein `useState`, kein zusätzlicher
  Client-Roundtrip. Das hält `PaginationControls` bewusst als reine,
  serverseitig renderbare Komponente.
- **`buildHref` liegt bei der aufrufenden Seite statt in der
  Komponente**: `PaginationControls` selbst weiß nichts von anderen
  Query-Parametern. Nur so kann z.B. `dashboard/media/page.tsx` beim
  Blättern den `folder`-Parameter mit übernehmen
  (`` `?folder=${id}&page=${p}` ``), ohne dass die geteilte Komponente
  ordner-spezifische Logik bräuchte.
- **Bestehende "gib mir möglichst alles"-Aufrufstellen bleiben groß-
  `pageSize`, nicht echt paginiert**: `users/page.tsx` braucht die
  komplette Rollenliste für den Rollen-Dropdown in `CreateUserDialog`/
  `UsersTable` – dafür wird bewusst `getRoles({pageSize: 100})`
  aufgerufen (das erlaubte Maximum) statt einer echten zweiten
  Pagination innerhalb eines Dropdowns. Exakt dasselbe Muster wurde
  vorher schon für `content/page.tsx` (`pageSize: 50` als Notlösung)
  genutzt – hier nur konsequent fortgeführt, statt einen separaten
  "alle Einträge"-Endpoint zu bauen. Nur die eigentliche
  `/dashboard/roles`-Listen-Seite nutzt echte Pagination mit
  `pageSize: 20`.
- **Massenauswahl (`useSelection`) bleibt unangetastet**: Pagination
  lebt ausschließlich auf Seiten-Ebene (Server Component), nicht in den
  Client Components mit `useSelection` (`ContentTable`, `MediaGrid`,
  `UsersTable`, `RolesTable`, `TaxonomyManager`,
  `ContentVersionsList`, siehe
  [bulk-selection-and-delete.md](./bulk-selection-and-delete.md)). Ein
  Seitenwechsel ist ein neuer Server-Request, die Auswahl setzt sich
  dabei automatisch zurück – das ist korrektes, erwartetes Verhalten
  und brauchte keine Sonderbehandlung.
- **Dashboard-Statistik** (`dashboard/page.tsx`) nutzte bisher
  `getUsers()` und zählte `.length` – nach der Umstellung auf paginierte
  Rückgabe wäre das nur noch die Anzahl der aktuellen Seite gewesen.
  Fix: `getUsers({pageSize: 1})` + `meta.total`, exakt das Muster, das
  dort für Content/Medien schon lief.

## Stolpersteine / Besonderheiten

- Alle vier neuen Fetcher-Rückgabetypen sind **Breaking Changes** für
  ihre bisherigen Aufrufstellen (flaches Array → `{items, meta}`). Da
  `getCategories`/`getTags`/`getUsers`/`getRoles` projektweit nur an
  sechs Stellen aufgerufen werden (`api-server.ts` selbst plus fünf
  `page.tsx`-Dateien, vorab per Grep verifiziert), war eine
  vollständige, überschaubare Migration möglich statt einer
  Kompatibilitätsschicht.

## Relevante Dateien

- `apps/web/src/components/pagination-controls.tsx` (neu)
- `apps/api/src/{categories,tags,users,roles}/dto/query-*.dto.ts` (neu),
  zugehörige `*.service.ts`/`*.controller.ts`
- `apps/web/src/lib/api-server.ts` (`getCategories`, `getTags`,
  `getUsers`, `getRoles`, neue `*ListResponse`-Typen; `AppSettings`
  um `defaultPageSize` erweitert)
- `apps/api/src/settings/dto/update-settings.dto.ts`,
  `settings.service.ts` (`defaultPageSize`),
  `apps/web/src/components/settings-form.tsx` (Tab "Darstellung"),
  `packages/database/prisma/schema.prisma` (`AppSettings.defaultPageSize`)
- `apps/web/src/app/dashboard/{content,media,categories,tags,roles,users}/page.tsx`,
  `apps/web/src/app/dashboard/content/[id]/versions/page.tsx`,
  `apps/web/src/app/dashboard/page.tsx`
- `apps/api/test/taxonomy.e2e-spec.ts`,
  `apps/api/test/auth-security.e2e-spec.ts`

## Offene Punkte

- Rollen-/Kategorien-/Tag-Dropdowns bleiben bei `pageSize: 100` praktisch
  unpaginiert – falls diese Zahl je überschritten wird, bräuchte es
  einen echten "alle laden"-Mechanismus (z.B. Infinite Scroll im
  Dropdown) statt der festen Obergrenze.
- Keine Sprung-zu-Seite-N-Eingabe, nur Zurück/Weiter-Buttons + reiner
  "Seite X von Y"-Text.
- `getMediaFolders()` (Ordnerliste) bleibt bewusst unpaginiert – Ordner
  pro Ebene sind erfahrungsgemäß eine überschaubare Menge, siehe
  [media-folders.md](../media/media-folders.md).
