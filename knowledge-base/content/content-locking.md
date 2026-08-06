# Content Locking (weiche Bearbeitungssperre)

**Datum:** 2026-08-06
**Betroffene Bereiche:** apps/api (`src/content`), apps/web
(`src/components/content-editor-form.tsx`,
`src/app/api/content/[id]/{lock,unlock}/route.ts`,
`src/app/dashboard/content/[id]/edit/page.tsx`)

## Was wurde gebaut

- Zwei neue `Content`-Felder: `lockedById String?` (Relation `User`,
  `lockedBy`) und `lockedAt DateTime?`.
- `POST /v1/content/:id/lock` (`content:update`): versucht, die Sperre
  für den aktuellen Nutzer zu setzen/zu verlängern.
  - Ist der Inhalt frei, von niemandem, vom selben Nutzer, oder ist die
    bestehende Sperre älter als `CONTENT_LOCK_TTL_MS` (2 Minuten)
    abgelaufen → Sperre wird (neu) gesetzt, `200`.
  - Hält jemand anderes eine noch aktive Sperre → `409 Conflict` mit
    `{ lockedBy, lockedAt }` im Body, damit das Frontend anzeigen kann,
    wer gerade bearbeitet.
- `POST /v1/content/:id/unlock` (`content:update`): gibt die Sperre frei.
  Erlaubt für die sperrende Person selbst, für jeden mit `content:delete`
  (Admin-Override) oder wenn ohnehin gerade niemand sperrt. Sonst `403`.
- Frontend (`ContentEditorForm`, nur wenn `content` gesetzt ist, d.h. beim
  Bearbeiten eines bestehenden Inhalts – bei "Neuer Inhalt" gibt es noch
  keine ID, also keine Sperre nötig):
  - Beim Mounten wird sofort `POST .../lock` aufgerufen.
  - Solange die Sperre gehalten wird, läuft alle 60s ein
    Heartbeat-`POST .../lock`, um sie zu verlängern.
  - Beim Verlassen der Seite (Client-Navigation: `fetch` im
    Effect-Cleanup; Tab schließen: `navigator.sendBeacon` im
    `beforeunload`-Handler) wird die Sperre freigegeben.
  - Hält jemand anderes die Sperre (`409`): rotes Banner
    "Wird gerade bearbeitet von X seit HH:MM", das gesamte Formular wird
    über ein natives `<fieldset disabled>` (plus `editable={false}` am
    `RichTextEditor`, der kein natives Form-Element ist und daher nicht
    automatisch vom Fieldset erfasst wird) schreibgeschützt. Nutzer mit
    `content:delete` sehen zusätzlich einen "Sperre aufheben"-Button.

## Warum diese Lösung

- **Weiche Sperre mit TTL statt harter serverseitiger Durchsetzung**:
  `PATCH /content/:id` prüft die Sperre selbst **nicht** – wer direkt
  gegen die API schreibt, kann sie umgehen. Bewusste Entscheidung: das
  Ziel ist, zwei Redakteure in der **UI** vor gegenseitigem Überschreiben
  zu warnen, nicht ein hartes Zugriffskontroll-System zu bauen. Eine
  serverseitige Durchsetzung hätte zusätzliche Fragen aufgeworfen (was
  passiert bei abgelaufener Sperre genau beim Speichern? Race Conditions
  zwischen Ablauf-Check und Schreiben?) – das ist bewusst der separate,
  noch offene Roadmap-Punkt "Konfliktauflösung bei paralleler
  Bearbeitung", nicht Teil dieses Batches.
- **TTL statt explizitem Nur-Inhaber-Unlock ohne Ablauf**: ohne
  Ablaufzeit würde ein abgestürzter Tab / Netzwerkfehler beim
  `beforeunload`-Unlock den Inhalt dauerhaft sperren, bis ein Admin
  manuell eingreift. 2 Minuten (etwas mehr als das 60s-Heartbeat-
  Intervall) ist ein pragmatischer Kompromiss: kurz genug, dass eine
  vergessene Sperre nicht lange stört, lang genug, dass ein normaler
  Heartbeat-Zyklus sie nicht versehentlich ablaufen lässt.
- **`content:delete` als Override-Permission statt einer neuen
  `content:force-unlock`-Permission**: konsistent mit der Suche
  ([global-search.md](./global-search.md)) und den SEO-Feldern – wo eine bereits
  existierende, sinnvoll passende Permission die Anforderung abdeckt,
  wird keine neue erfunden. `content:delete` steht typischerweise nur
  Admin-artigen Rollen zur Verfügung (in den Standard-Rollen: Admin,
  Editor – nicht Autor), passt als "elevated content action"-Signal.
- **`<fieldset disabled>` statt manuellem `disabled`-Prop auf jedem
  einzelnen Feld**: natives HTML – ein `<fieldset disabled>` deaktiviert
  automatisch alle nativen Form-Controls (`input`, `select`, `textarea`,
  `button`) in seinem Baum, unabhängig von der Verschachtelungstiefe.
  Spart, jedes der ca. 15 Formularfelder einzeln zu verdrahten.
  `className="contents"` (Tailwind `display: contents`) nimmt dem
  `fieldset` seine Default-Browser-Box (Rahmen/Padding), ohne die
  Disabled-Kaskadierung zu beeinträchtigen. Einzige Ausnahme:
  `RichTextEditor` (Tiptap/ProseMirror) ist kein natives Form-Element,
  bekommt deshalb explizit `editable={!lockBlocksEditing}` übergeben.

## Stolpersteine / Besonderheiten

- Für "Neuer Inhalt" (`content` ist `undefined`) läuft keine der
  Lock-Effects – `isEditing` gate am Anfang jedes Effects.
- `navigator.sendBeacon` für den `beforeunload`-Fall sendet Cookies bei
  Same-Origin-Requests automatisch mit, die httpOnly-Access-Token-Cookie-
  Auth funktioniert daher ohne zusätzlichen Header.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`Content.lockedById`/
  `lockedAt`), Migration `add-content-locking`
- `apps/api/src/content/content.service.ts` (`lock()`, `unlock()`,
  `CONTENT_LOCK_TTL_MS`), `content.controller.ts`
- `apps/web/src/app/api/content/[id]/{lock,unlock}/route.ts`
- `apps/web/src/components/content-editor-form.tsx`
- `apps/web/src/app/dashboard/content/[id]/edit/page.tsx` (reicht
  `canForceUnlock` durch)
- `apps/api/test/content-locking.e2e-spec.ts` (401, Sperren/Heartbeat,
  409 mit Info, 403 bei fremdem Unlock-Versuch, Admin-Override,
  TTL-Ablauf via zurückdatiertem `lockedAt`, normaler Selbst-Unlock)

## Offene Punkte

- Keine serverseitige Durchsetzung bei `PATCH /content/:id` selbst (siehe
  "Warum diese Lösung" oben) – reine UI-Warnung.
- Keine Konfliktauflösung/Merge-UI, falls doch zwei Personen
  gleichzeitig schreiben (separater Roadmap-Punkt).
- Keine Live-Anzeige "X ist jetzt auch hier" ohne Neuladen – die
  409-Info kommt nur beim (erneuten) Öffnen/Locken, kein WebSocket/
  Polling für Echtzeit-Updates.
