# Content-Vorschau-Links (zeitlich begrenzt)

**Datum:** 2026-08-06
**Betroffene Bereiche:** apps/api (`src/content`), apps/web
(`src/components/preview-links-dialog.tsx`,
`src/components/preview-links-table.tsx`,
`src/components/edit-preview-link-dialog.tsx`,
`src/components/app-sidebar.tsx`,
`src/app/preview/[token]/page.tsx`,
`src/app/dashboard/content/preview-links/page.tsx`,
`src/app/dashboard/content/[id]/edit/page.tsx`)

## Was wurde gebaut

- Modell `ContentPreviewToken` (`token`, `contentId`, `expiresAt`,
  `createdById`). Ursprünglich (erste Version am 2026-08-06) wie
  `RefreshToken`/`EmailVerificationToken`/`PasswordResetToken` im
  Auth-Modul als gehashter Einweg-Token ausgelegt (`tokenHash`, Rohwert
  nur einmal bei der Erstellung zurückgegeben) – **noch am selben Tag
  auf Klartext-Speicherung umgestellt** (Spalte `token` statt
  `tokenHash`), siehe "Update 2026-08-06 (Nachmittag)" unten.
- `POST /v1/content/:id/preview-links` (`content:read`): erzeugt einen
  Link mit konfigurierbarer Gültigkeitsdauer (`expiresInHours`, Default
  168 = 7 Tage, Max 720 = 30 Tage).
- `GET /v1/content/:id/preview-links` (`content:read`): listet aktive
  (nicht abgelaufene) Links für einen Inhalt, inkl. Roh-Token (siehe
  Update unten).
- `PATCH /v1/content/:id/preview-links/:linkId` (`content:read`):
  verlängert/verkürzt die Gültigkeit eines bestehenden Links ab jetzt
  (`expiresInHours`), Token bleibt unverändert.
- `DELETE /v1/content/:id/preview-links/:linkId` (`content:read`):
  widerruft einen Link (echtes Löschen der DB-Zeile).
- `GET /v1/content/preview-links` (`content:read`, paginiert wie
  `/webhooks`): inhaltsübergreifende Liste aller aktiven Vorschau-Links
  inkl. `content.{id,title}` – Basis für die neue Übersichtsseite.
- `GET /v1/content/preview/:token` (`@Public()`, kein Login nötig):
  validiert den Token (Lookup + Ablauf-Check) und liefert den Inhalt
  **unabhängig vom Status** – funktioniert also explizit auch für
  `DRAFT`/`SCHEDULED`, das ist der ganze Sinn des Features.
- Neue öffentliche Seite `apps/web/src/app/preview/[token]/page.tsx`
  (liegt bewusst außerhalb von `/dashboard`, kein Sidebar/Header, keine
  Middleware-Auth – der `matcher` in `middleware.ts` deckt nur
  `/dashboard/:path*`, `/login`, `/register` ab, `/preview/*` läuft
  komplett daran vorbei): zeigt einen auffälligen "Dies ist eine
  Vorschau"-Hinweis, Status-Badge, Titel, Excerpt und alle String-Felder
  aus `data` gerendert über den bereits vorhandenen `RichTextEditor` im
  `editable={false}`-Modus (einheitliche, sichere Darstellung für
  Richtext- **und** einfache Textfelder gleichermaßen – Tiptap
  akzeptiert auch reinen Text problemlos als `content`).
- `PreviewLinksDialog` im Content-Editor (Button "Vorschau-Link" neben
  "Versionen anzeigen"): Dropdown für die Gültigkeitsdauer (1/7/30
  Tage), "Neuen Link erstellen" kopiert die URL automatisch in die
  Zwischenablage; jeder Eintrag in der Liste aktiver Links hat eigene
  Kopieren-/Bearbeiten-/Widerrufen-Aktionen (siehe Update unten).
- Neue Seite `/dashboard/content/preview-links` (`PreviewLinksTable`,
  eigener Menüpunkt "Vorschau-Links" in der Sidebar unter "Inhalte"):
  Tabelle über alle aktiven Vorschau-Links, spaltenweise Inhalt (Link
  zum Editor) / Läuft ab / Erstellt von / Aktionen (Kopieren/
  Bearbeiten/Widerrufen, Widerrufen mit `ConfirmDeleteDialog` gemäß
  [ui-convention-crud-and-delete-confirmation.md](../frontend/ui-convention-crud-and-delete-confirmation.md)),
  URL-getriebene Pagination wie die übrigen Listen-Ansichten, Checkbox-
  Massenauswahl + Sammel-Widerrufen (`useSelection`/`SelectionToolbar`,
  gleiche Konvention wie Inhalte/Medien/Kategorien/Tags/Benutzer/Rollen).
  "Bearbeiten" (Gültigkeitsdauer ändern) öffnet einen eigenen
  `EditPreviewLinkDialog`-Popup statt einer inline aufklappenden
  Tabellenzeile (frühere Version, auf Nutzerwunsch "bearbeiten in einem
  Pop-Fenster wie bei Inhalte" ersetzt).

## Update 2026-08-06 (Nachmittag): Klartext-Tokens, erneutes Kopieren, Verlängern, Gesamtübersicht

Nutzer-Feedback: Links ließen sich nach der Erstellung nicht erneut
kopieren (Rohwert war nur im Hash gespeichert) und nicht in ihrer
Gültigkeit verlängern. Beides wurde nachgerüstet:

- **Design-Änderung**: `ContentPreviewToken.tokenHash` (SHA-256-Hash)
  wurde durch `ContentPreviewToken.token` (Klartext, weiterhin
  `@unique`) ersetzt. Migration `rename_preview_token_hash_to_token`
  löscht bestehende Zeilen vor der Spaltenumbenennung (der Rohwert war
  aus dem alten Hash nie rekonstruierbar, bereits erstellte Links waren
  also ohnehin nicht mehr kopierbar).
- Bewusste Abweichung von der sonst in diesem Projekt etablierten
  "Hash-only"-Konvention für Einweg-Tokens (Refresh/E-Mail-Verifikation/
  Passwort-Reset): dort ist ein DB-Leak-Schutz sicherheitskritisch
  (Session-/Account-Übernahme), hier stehen wiederholtes Kopieren und
  Verlängern im Vordergrund, und der Zugriff auf den Klartext-Token ist
  ohnehin bereits durch `content:read` geschützt (wer den Token lesen
  kann, könnte über dieselbe Berechtigung auch jederzeit einen neuen
  gültigen Link erzeugen – kein zusätzliches Sicherheitsniveau durch
  Hashing in diesem speziellen Fall).
- `updatePreviewLink()`/`PATCH .../preview-links/:linkId`: setzt
  `expiresAt` neu relativ zu "jetzt" (`expiresInHours`), Token und ID
  bleiben unverändert.
- `findAllPreviewLinks()`/`GET /v1/content/preview-links`: neue,
  inhaltsübergreifende, paginierte Auflistung (exakt gleiches Pagination-
  Schema wie `WebhooksService.findAll()`) – Basis für die neue
  Dashboard-Seite `/dashboard/content/preview-links`.
- Sidebar (`app-sidebar.tsx`) auf ausklappbare Gruppen umgestellt: jede
  `SidebarGroupLabel` ist jetzt ein Button mit Chevron-Icon
  (`ChevronRight`, rotiert bei offenem Zustand), Zustand pro Gruppe in
  `openGroups` (`Set<string>`). Beim Navigieren wird die Gruppe der
  aktivsten Route zusätzlich geöffnet (bereits offene Gruppen bleiben
  offen) – als Render-Zeit-Anpassung (`if (pathname !== syncedPathname)
  { ...; setState(...) }`) statt `useEffect`, um das
  `react-hooks/set-state-in-effect`-Lint (React Compiler) zu vermeiden.
  Im eingeklappten (icon-only) Sidebar-Zustand wird der Auf-/Zu-Klapp-
  Zustand ignoriert und Items bleiben immer sichtbar. Neue leere Gruppe
  "Erweiterungen" (Platzhalter für künftige Menüpunkte, zeigt "Bald
  verfügbar" wenn aufgeklappt) – die Filterung, die Gruppen ohne
  sichtbare Items sonst komplett ausblendet (z.B. "Verwaltung" für
  Nutzer ohne Admin-Rechte), berücksichtigt bewusst leer *gestartete*
  Gruppen separat (`originalItemCount === 0`), damit dieser Platzhalter
  nicht durch dieselbe Logik verschwindet.
- **Wichtig für die aktive-Gruppen-Erkennung**: `pathname.startsWith(url)`
  reicht nicht – "/dashboard" (Dashboard-Link) ist Präfix jeder anderen
  Route, würde also über `Array.find()` (erster Treffer) immer zuerst
  matchen. `findActiveGroupLabel()` wählt stattdessen den Treffer mit
  der **längsten** übereinstimmenden Item-URL.

## Warum diese Lösung

## Warum diese Lösung

- **DB-persistierte, gehashte Tokens statt stateless JWT**: obwohl
  `@nestjs/jwt` im Projekt bereits verfügbar wäre, folgt dieses Feature
  bewusst der bereits etablierten Konvention für "zeitlich begrenzte,
  einmalig ausgegebene Tokens" in diesem Projekt (Refresh-/E-Mail-
  Verifikations-/Passwort-Reset-Tokens sind alle DB-persistiert, nicht
  JWT). Vorteil gegenüber einem stateless JWT: Links lassen sich
  einzeln **widerrufen** und **auflisten** ("welche aktiven Vorschau-
  Links gibt es gerade für diesen Inhalt") – mit einem reinen JWT wäre
  beides ohne zusätzliche Sperrliste nicht möglich.
- **Eigene öffentliche Vorschau-Seite statt Wiederverwendung des
  Dashboard-Editors**: der Editor selbst braucht Login + zeigt
  Bearbeitungs-UI, beides ungeeignet für "mit einer Person ohne
  Dashboard-Zugang teilen". Eine eigenständige, absichtlich simple
  Read-Only-Seite ist der richtige Scope.
- **`content:read` statt einer neuen `content:preview`-Permission**:
  wer einen Inhalt lesen darf, darf auch Vorschau-Links dafür anlegen –
  konsistent mit dem in diesem Projekt wiederholt angewandten Prinzip,
  keine neue Permission zu erfinden, wenn eine bestehende die
  Anforderung sauber abdeckt.
- **Kein `usedAt`/Einmal-Verwendung** (anders als Passwort-Reset-Tokens):
  ein Vorschau-Link soll innerhalb seiner Gültigkeit beliebig oft
  aufrufbar sein (z.B. mehrere Stakeholder, mehrfaches erneutes
  Ansehen), nicht nur einmal.

## Stolpersteine / Besonderheiten

- Route-Reihenfolge im Controller: `@Get('preview/:token')` steht vor
  `@Get(':id')`. Anders als beim `search`-Endpoint (siehe
  [global-search.md](./global-search.md)) ist das hier für die
  Korrektheit nicht zwingend nötig (zwei Pfad-Segmente kollidieren
  strukturell nicht mit dem einsegmentigen `:id`), aber aus Konsistenz-
  und Lesbarkeitsgründen trotzdem so einsortiert.
- `findByPreviewToken()` inkludiert nur `contentType` (Name für die
  Badge-Anzeige), nicht `author`/`categories`/`versions`/`lockedBy` wie
  `findOne()` – die öffentliche Vorschau braucht diese internen
  Metadaten nicht, und sie unnötig über einen ungeschützten Endpoint
  auszuliefern wäre unnötige Angriffsfläche.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`ContentPreviewToken`),
  Migrationen `add-content-preview-tokens`,
  `rename_preview_token_hash_to_token`
- `apps/api/src/content/dto/{create,update,query}-preview-link(s).dto.ts`,
  `content.service.ts` (`createPreviewLink()`, `findPreviewLinks()`,
  `findAllPreviewLinks()`, `updatePreviewLink()`, `revokePreviewLink()`,
  `findByPreviewToken()`), `content.controller.ts`
- `apps/web/src/app/api/content/[id]/preview-links/{route.ts,[linkId]/route.ts}`
  (GET/POST, PATCH/DELETE)
- `apps/web/src/components/preview-links-dialog.tsx` (pro Inhalt, im
  Editor), `preview-links-table.tsx` (inhaltsübergreifend, neue Seite)
- `apps/web/src/app/dashboard/content/preview-links/page.tsx`
- `apps/web/src/components/app-sidebar.tsx` (ausklappbare Gruppen,
  neuer Menüpunkt, Platzhalter-Gruppe "Erweiterungen")
- `apps/web/src/app/preview/[token]/page.tsx`
- `apps/web/src/app/dashboard/content/[id]/edit/page.tsx` (Button)
- `apps/api/test/content-preview-links.e2e-spec.ts` (401/403/404,
  Erstellen/Auflisten inkl. Token/Abruf ohne Login unabhängig vom
  Status/Verlängern/Ablauf/Widerruf) – 11 Tests

## Offene Punkte

- Keine Rate-Begrenzung speziell für den öffentlichen Preview-Endpoint
  über die globale Throttler-Konfiguration hinaus.
- Kein Passwortschutz/zusätzliche Zugriffsbeschränkung pro Link (jeder
  mit der URL kann sie aufrufen, solange sie gültig ist – "zeitlich
  begrenzt", nicht "zugangsbeschränkt").
- Vorschau-Seite rendert dynamische Felder generisch (alle String-Werte
  aus `data`), ohne das `ContentType.schema` zu kennen (öffentlicher
  Endpoint liefert es bewusst nicht mit) – Feldnamen/-Reihenfolge exakt
  wie im Editor sind daher nicht garantiert.
- Vorschau-Links werden jetzt im Klartext gespeichert (siehe Update
  oben) – ein DB-Leak macht damit alle aktuell gültigen Vorschau-Links
  nutzbar (nicht aber Passwörter/Sessions, die weiterhin gehasht sind).
  Als Kompromiss bewusst akzeptiert, siehe Begründung im Update-Block.
