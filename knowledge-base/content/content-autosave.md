# Autosave & Entwurfs-Wiederherstellung im Content-Editor

**Datum:** 2026-08-06
**Betroffene Bereiche:** apps/api (`src/settings`), apps/web
(`src/components/content-editor-form.tsx`, `src/components/settings-form.tsx`,
`src/app/dashboard/content/{new,[id]/edit}/page.tsx`)

## Was wurde gebaut

- Neues Feld `AppSettings.autosaveEnabled` (`Boolean @default(true)`),
  Teil von `GET /settings/public` (jede Rolle mit Dashboard-Zugriff
  braucht den Wert, nicht nur Admins), umschaltbar über einen neuen
  Switch "Autosave im Content-Editor" im Tab "Zugriff & Funktionen" der
  Einstellungen.
- `ContentEditorForm` speichert den aktuellen Bearbeitungsstand (Titel,
  Slug, Status, Kategorien, dynamische Feldwerte, alle SEO-Werte) 1.5s
  nach der letzten Änderung automatisch in `localStorage`, Key
  `strasev:content-draft:<contentId>` (bzw. `new-<contentTypeId>` für
  noch nicht angelegte Inhalte). Leere/inhaltslose Entwürfe werden nicht
  gespeichert (kein Titel und keine gefüllten dynamischen Felder).
- Beim Öffnen eines Inhalts (neu oder bestehend) wird geprüft, ob unter
  diesem Key bereits ein Entwurf im Browser liegt, und falls ja ein
  Banner mit "Wiederherstellen"/"Verwerfen" angezeigt – keine
  automatische, unangekündigte Übernahme.
- Der lokale Entwurf wird nach erfolgreichem explizitem Speichern
  (Submit) automatisch gelöscht, da der Server-Stand dann aktuell ist.

## Warum diese Lösung

- **Rein clientseitig (`localStorage`) statt Server-Autosave**: strasev
  hat aktuell weder Content Locking noch Echtzeit-Kollaboration
  (beide noch offen, Phase 2b.9) – ein Server-Autosave würde entweder
  bei jedem Tick eine `ContentVersion` erzeugen (Versionshistorie würde
  von Autosave-Rauschen zugemüllt statt bedeutsamer Speicherpunkte,
  siehe `ContentService.update()`) oder eine zusätzliche
  "Autosave-Snapshot"-Tabelle/-Route bräuchte, ohne dass es aktuell
  einen echten Mehrwert gegenüber dem einfacheren, robusten
  Browser-lokalen Ansatz gibt (löst exakt das eigentliche Problem:
  Datenverlust durch Tab-Schließen/Browser-Crash/versehentliches
  Navigieren). Guter, naheliegender nächster Ausbauschritt, sobald
  Content Locking existiert: dann könnte Autosave zusätzlich
  serverseitig synchronisieren, um auch geräteübergreifende
  Wiederherstellung zu ermöglichen.
- **Debounce statt Intervall**: schreibt nur, wenn sich tatsächlich etwas
  geändert hat, nicht alle N Sekunden unabhängig vom Zustand – vermeidet
  unnötige `localStorage`-Schreibvorgänge bei einem Editor, den jemand
  einfach offen liegen lässt.
- **Admin-abschaltbar über `Einstellungen`**: auf expliziten Nutzerwunsch
  ("schau, was du logischerweise als einstellung unter einstellung im
  zuge der roadmap optional machen kannst") – neue, global wirksame
  Redaktionsfunktionen sollen künftig grundsätzlich daraufhin geprüft
  werden, ob sie sich als Admin-Schalter eignen, analog zu
  `allowRegistration`/`allowPasswordReset` usw. Als Standing-Rule für
  künftige Roadmap-Arbeit in der Memory hinterlegt.
- **Banner statt automatischem Überschreiben**: ein Entwurf könnte älter
  oder unerwünscht sein (z.B. jemand hat den Tab absichtlich verworfen)
  – der Nutzer entscheidet explizit, nie eine stille Datenübernahme.

## Stolpersteine / Besonderheiten

- **Kein `localStorage`-Schreiben beim ersten Render**: der erste
  `useEffect`-Durchlauf nach dem Mount würde sonst sofort den
  unveränderten Server-Stand als "Entwurf" speichern – dadurch hätte
  jedes bloße Öffnen/Schließen eines Inhalts ohne echte Bearbeitung beim
  nächsten Öffnen ein Wiederherstellungs-Banner ausgelöst (falscher
  Alarm). Fix: `isFirstAutosaveRun`-Ref überspringt den allerersten
  Effekt-Durchlauf.
- **`localStorage` kann fehlschlagen** (privater Modus in manchen
  Browsern, Kontingent voll) – alle Zugriffe in `try/catch`, Autosave ist
  bewusst best-effort ohne eigenes Fehler-UI dafür.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`AppSettings.autosaveEnabled`),
  Migration `add-autosave-enabled-setting`
- `apps/api/src/settings/dto/update-settings.dto.ts`,
  `settings.service.ts` (`getPublic()`)
- `apps/web/src/lib/api-server.ts` (`AppSettings.autosaveEnabled`)
- `apps/web/src/components/settings-form.tsx` (neuer Switch)
- `apps/web/src/components/content-editor-form.tsx` (Autosave-Logik,
  Wiederherstellungs-Banner)
- `apps/web/src/app/dashboard/content/new/page.tsx`,
  `content/[id]/edit/page.tsx` (reichen `autosaveEnabled` durch)
- `apps/api/test/auth-security.e2e-spec.ts` (Default `true`, Umschalten
  über `PATCH /settings`, sichtbar in `GET /settings/public`)

## Offene Punkte

- Kein serverseitiger Draft-Sync – Wiederherstellung funktioniert nur im
  selben Browser/Gerät.
- Kein UI-Test mit echtem Browser durchgeführt (kein Browser-Tool in
  dieser Session verfügbar) – Verifikation über Type-Check, e2e-Tests
  für den Settings-Teil und Code-Review; die reine Client-Interaktion
  (Debounce-Timing, Banner-Klick) ist ungetestet im echten Browser.
