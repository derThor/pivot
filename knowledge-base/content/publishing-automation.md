# Publishing-Automatisierung: Scheduler + Webhooks

**Datum:** 2026-08-06
**Betroffene Bereiche:** apps/api (`src/content`, `src/webhooks`),
apps/web (`src/components/content-editor-form.tsx`,
`src/components/webhook{s-manager,-dialog}.tsx`,
`src/app/dashboard/webhooks`)

> **Update 2026-08-15 (Zustellstatus-Tracking):** `Webhook` hat jetzt
> `lastDeliveryStatus`/`lastDeliveryAt`/`lastDeliveryError`/
> `consecutiveFailures`, von `WebhooksService#deliver` nach jedem
> Zustellversuch geschrieben (best-effort, wie der Dispatch selbst –
> siehe unten "fire-and-forget"). `webhooks-manager.tsx` zeigt pro Zeile
> den Status, die Webhooks-Seite ein `SystemMessage`-Banner "N Webhooks
> schlagen fehl" (`meta.failingCount`, über alle Webhooks gezählt, nicht
> nur die aktuelle Seite). Details in
> [toast-and-system-messages.md](../frontend/toast-and-system-messages.md).

## Was wurde gebaut

- **Neuer echter Zielzeitpunkt**: `Content.scheduledFor DateTime?`.
  Wichtiger Fund vor der Umsetzung: der Status `SCHEDULED` existierte
  im Editor schon lange als Auswahlmöglichkeit, aber es gab **nirgends**
  ein Feld, um tatsächlich einen Zeitpunkt festzulegen – ein Inhalt
  konnte auf "Geplant" gesetzt werden, ohne dass irgendwo gespeichert
  wurde, wann er veröffentlicht werden soll. Jetzt: `datetime-local`-
  Input im Content-Editor, erscheint nur wenn Status = "Geplant",
  Pflichtfeld (Backend validiert das zusätzlich serverseitig in
  `create()`/`update()`).
- **`ContentSchedulerService`** (`@nestjs/schedule`, `@Cron
  (CronExpression.EVERY_MINUTE)`): ruft jede Minute
  `ContentService.publishDueScheduled()` auf, die alle `SCHEDULED`-
  Inhalte mit `scheduledFor <= jetzt` per `updateMany` auf `PUBLISHED`
  setzt und pro Eintrag den `content.published`-Webhook feuert.
- **Neues `Webhook`-Modell** (`url`, `events: String[]`, `isActive`) +
  eigenständiges CRUD-Modul (`src/webhooks`), gegated über
  `settings:manage` (dieselbe Permission wie der Rest von
  `/settings` – Webhooks sind Site-weite Admin-Konfiguration, keine
  granulare Ressource). Events: `content.published`, `content.updated`.
- **`WebhooksService.dispatch(event, payload)`**: fire-and-forget,
  5s-Timeout per `AbortController`, Fehler werden nur geloggt (nie
  geworfen) – ein nicht erreichbarer Webhook-Endpoint darf den
  eigentlichen Content-Speichervorgang oder den automatischen Publish
  niemals blockieren oder fehlschlagen lassen.
- `ContentService.update()`/`create()` feuern `content.updated` bei
  jeder Änderung und zusätzlich `content.published`, wenn der Status neu
  auf `PUBLISHED` wechselt (manuell **oder** über den Scheduler).
- **Eigener `DateTimePicker` statt nativem `datetime-local`-Input**
  (`src/components/date-time-picker.tsx`): der Browser-Kalender sah je
  nach Browser/OS uneinheitlich aus und passte nicht zum restlichen
  Design. Selbst gebauter Kalender (kein externes Datepicker-Paket) im
  Coral/Orange-Verlauf der App: Monatsraster mit Kreis-Badges für den
  gewählten Tag, Schnellauswahl links ("In 1 Stunde", "Morgen, 9 Uhr",
  "Nächste Woche"), separates Stunde/Minute-Eingabefeld darunter,
  "Zurücksetzen"/"Übernehmen"-Leiste unten. Wird **per React-Portal**
  direkt nach `document.body` gerendert (`position: fixed`, Position
  wird aus `getBoundingClientRect()` des Trigger-Buttons berechnet) –
  eine erste Version, die das Panel nur `absolute` positioniert relativ
  zu seinem eigenen Wrapper-Element hatte, wurde vom `overflow-hidden`
  der umgebenden `<Card>` (zweispaltiges Editor-Layout) abgeschnitten.
  Portal umgeht das grundsätzlich, unabhängig davon, in welchem
  Container das Feld künftig verwendet wird. Position wird zusätzlich an
  den Viewport geklemmt (nie über den rechten/unteren Rand hinaus, klappt
  bei zu wenig Platz nach oben statt nach unten auf) und ist auf
  schmalen Viewports einspaltig (Schnellauswahl als horizontal
  scrollbare Zeile statt fixer Sidebar-Spalte, volle Viewport-Breite
  minus Rand statt fester `384px`).
- Neue Admin-Seite `/dashboard/webhooks` (eigener Sidebar-Eintrag unter
  "Verwaltung", gegated über `settings:manage`): Liste mit URL, Event-
  Badges, Aktiv-Schalter (inline togglebar) und Löschen; Dialog zum
  Anlegen (URL + Event-Checkboxen).

## Warum diese Lösung

- **`@nestjs/schedule`-Cron statt Redis/BullMQ** (wie ursprünglich in
  der Roadmap vorgesehen): Redis ist im Projekt aktuell noch gar nicht
  angebunden (siehe Phase 3, "Redis-Anbindung… aktivieren" ist selbst
  noch offen). Einen kompletten Queue-Betrieb nur für einen einzigen,
  simplen periodischen "prüfe fällige Einträge"-Job aufzusetzen wäre
  unverhältnismäßige Infrastruktur für die aktuelle Größe des Projekts.
  In-Process-Cron reicht für minuten-/stundengenaue Redaktionstermine
  völlig aus. Sobald Redis aus anderen Gründen (Caching/Sessions)
  eingeführt wird, kann der Job bei Bedarf migriert werden.
- **`updateMany` statt `update()` pro fälligem Eintrag**: eine reine
  automatische Statusumschaltung ist keine inhaltliche Änderung, braucht
  daher keinen `ContentVersion`-Snapshot (der bildet Datenänderungen ab)
  und keinen handelnden Editor – exakt dieselbe Design-Überlegung wie
  beim Content-Locking-Feature.
- **`settings:manage` statt eigener `webhooks:manage`-Permission**:
  konsistent mit der bisherigen Linie in diesem Projekt (siehe
  [content-locking.md](./content-locking.md), [global-search.md](./global-search.md))
  – wo eine bereits existierende, passende Permission die Anforderung
  abdeckt, wird keine neue erfunden.
- **Fire-and-forget statt Zustellungs-Queue mit Retry**: für eine erste
  Version bewusst einfach gehalten. Eine echte Zustellungs-Garantie
  (Retry mit Backoff, Zustellprotokoll/-historie, Signatur-Header) wäre
  ein sinnvoller, aber klar separater Ausbauschritt – siehe Offene
  Punkte.

## Stolpersteine / Besonderheiten

- `WebhooksModule` wird in `ContentModule` importiert (für die
  `WebhooksService`-Injection in `ContentService`), nicht umgekehrt –
  keine zirkuläre Abhängigkeit.
- **Live verifiziert mit einem echten lokalen HTTP-Receiver** (kein
  Mock): Webhook auf `http://localhost:4567/` registriert, Content-
  Statuswechsel ausgelöst, empfangene Payloads geprüft; danach den
  Cron-Job einen echten Zyklus (bis zu 60s) abwarten lassen und den
  automatischen Publish + den daraus resultierenden
  `content.published`-Webhook bestätigt. Testbewusst: Windows/`/tmp`-
  Pfadstolperstein dabei entdeckt und korrigiert – ein unter Node.js
  direkt (nicht über Git-Bash) gestartetes Skript interpretiert
  `/tmp/...` als `C:\tmp\...`, nicht als das Git-Bash-`/tmp`; Log-Datei
  musste in den (Windows-)Scratchpad-Pfad geschrieben werden.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`Content.scheduledFor`,
  `Webhook`), Migration `add-scheduler-and-webhooks`
- `apps/api/src/content/content-scheduler.service.ts`,
  `content.service.ts` (`publishDueScheduled()`, Webhook-Dispatch in
  `create()`/`update()`), `dto/create-content.dto.ts` (`scheduledFor`)
- `apps/api/src/webhooks/*` (Modul, Controller, Service, DTOs)
- `apps/api/src/app.module.ts` (`ScheduleModule.forRoot()`,
  `WebhooksModule`)
- `apps/web/src/components/content-editor-form.tsx`
  (`scheduledFor`-Feld, Autosave-Snapshot erweitert)
- `apps/web/src/components/webhooks-manager.tsx`,
  `webhook-dialog.tsx`, `src/app/dashboard/webhooks/page.tsx`
- `apps/web/src/app/api/webhooks/{route.ts,[id]/route.ts}`
- `apps/api/test/content.e2e-spec.ts` (Validierung `scheduledFor`
  Pflicht bei `SCHEDULED`, Scheduler-Verhalten für fällige/nicht-fällige
  Einträge), `apps/api/test/webhooks.e2e-spec.ts` (CRUD, Permission-
  Gate, Validierung, fire-and-forget-Zustellung an unerreichbare URL)

## Offene Punkte

- Kein Zustellungs-Retry/-Backoff, kein Zustellprotokoll/-verlauf in
  der UI, keine Signatur-Header (z.B. HMAC) zur Verifikation durch den
  Empfänger.
- Kein manuelles "Sofort testen"-Button im Webhook-Dialog.
- Scheduler-Genauigkeit ist minutengenau (Cron-Intervall), nicht
  sekundengenau.
- `DateTimePicker` ist nicht in einem echten Browser click-getestet
  worden (kein Browser-Tool in dieser Session verfügbar) – Verifikation
  über Type-Check, Live-SSR-Rendering-Check (Trigger-Button erscheint
  korrekt, keine Server-/Hydration-Fehler) und sorgfältige Code-Review
  der Portal-/Positionierungs-Logik. Der ursprüngliche
  `overflow-hidden`-Clipping-Bug wurde vom Nutzer selbst per Screenshot
  gemeldet, nicht durch eigene Tests gefunden.
