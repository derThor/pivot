# "Jobs"-Reiter unter Einstellungen: editierbare Cron-Jobs

**Datum:** 2026-08-22
**Betroffene Bereiche:** apps/api (`src/jobs/`, drei umgebaute Scheduler-
Services), apps/web (`src/components/scheduled-jobs-card.tsx`,
`recent-job-runs-card.tsx`, `job-log-dialog.tsx`)

## Was wurde gebaut

Nutzervorgabe: "baue mir unter einstellungen den reiter jobs und stelle
diese so wie auf den bildern dar ... nimm nur die, die wir jetzt haben.
baue keine vom screen nach. der screen soll nur das design vorgeben."
1:1 nach Bildvorlage ("Geplante Aufgaben"/"Letzte Läufe"), aber nur für
die **drei tatsächlich vorhandenen** Cron-Jobs dieser App:

- `content-publish` – geplante Inhalte veröffentlichen (vorher
  `ContentSchedulerService`, jede Minute)
- `dsr-deadline-reminder` – Löschanfragen-Fristerinnerung (vorher
  `DeletionRequestReminderSchedulerService`, täglich 6:00)
- `dpo-monthly-report` – DSB-Monatsbericht (vorher
  `PrivacyReportSchedulerService`, monatlich am 1., 00:00)

Bewusst NICHT nachgebaut (Nutzervorgabe: nur Design übernehmen, keine
Bildvorlage-Jobs ohne echte Grundlage): Papierkorb-Auto-Löschung
(Löschung ist in dieser App immer manuell, siehe
[trash-page.md](../content/trash-page.md)), Sitemap/Suchindex-Aufbau,
Link-Check, Backup auf externes Ziel – keines davon existiert im Repo.

## Warum diese Lösung: dynamische statt statische Cron-Jobs

Die drei Jobs liefen vorher über feste `@Cron(CronExpression.X)`-
Dekoratoren – das lässt sich nicht zur Laufzeit ändern. Da der Nutzer
den Zeitplan über die UI bearbeiten können soll ("so dass ich diese auch
bearbeiten kann"), wurden die Dekoratoren entfernt und durch
`SchedulerRegistry` aus `@nestjs/schedule` ersetzt (`apps/api/src/jobs/
jobs.service.ts`):

- `JobsService.onModuleInit()` erstellt für jeden im Code definierten Job
  (`definitions`-Array, stabile IDs) per Upsert eine `ScheduledJob`-Zeile
  (nur beim allerersten Start, mit `defaultCronExpression`) und
  registriert dafür einen `CronJob` (Paket `cron`, direkte Abhängigkeit
  ergänzt – wird von `@nestjs/schedule` zwar transitiv genutzt, ist unter
  pnpm aber nicht automatisch im eigenen `node_modules` auflösbar) über
  `schedulerRegistry.addCronJob()`.
- Ändert ein Admin den Cron-Ausdruck (`JobsService.update()`), wird der
  alte `CronJob` per `deleteCronJob()`/`addCronJob()` ersetzt – kein
  Neustart des Servers nötig.
- Ungültige Cron-Ausdrücke werden vor dem Speichern abgefangen
  (`assertValidCron()`: versucht, testweise einen `CronJob` zu
  konstruieren, wirft sonst `BadRequestException`) – live getestet:
  `"not-a-cron"` → 400 "Unknown alias: not".

Die drei Original-Services (`ContentSchedulerService` gelöscht,
`DeletionRequestReminderSchedulerService`/`PrivacyReportSchedulerService`
behalten) wurden von `@Cron()`-Trägern zu reinen Methoden umgebaut, die
einen kurzen Klartext-Status zurückgeben (z.B. "2 Inhalt(e)
veröffentlicht.", "Übersprungen: kein DSB-Kontakt hinterlegt.") – dieser
Text landet direkt als `JobRun.message`.

## Datenmodell

Zwei neue Modelle (`ScheduledJob`, `JobRun`, siehe Schema-Kommentare) +
`AppSettings.jobsGloballyPaused`. `ScheduledJob.id` ist bewusst ein
stabiler, im Code vergebener String (z.B. `"content-publish"`), keine
generierte ID.

- **Kritisch-Schalter** (`isCritical`, vom Admin selbst gesetzt, kein
  Job ist im Code fest kritisch): lässt sich nicht pausieren (weder
  einzeln noch über "Alle Jobs pausieren") – `JobsService.update()`
  ignoriert ein gleichzeitig übergebenes `isPaused:true` für einen
  (neu) kritischen Job, statt einen Fehler zu werfen; live getestet.
- **Pausiert = kein Log-Eintrag**: Ein automatisch übersprungener Lauf
  (Bildvorlage: "wird übersprungen, nicht nachgeholt") erzeugt bewusst
  KEINE `JobRun`-Zeile – nur tatsächliche Ausführungen. Der Button
  "Jetzt ausführen" umgeht die Pause-Prüfung bewusst (`force`-Flag),
  eine manuelle Anfrage soll immer funktionieren.
- **"Alle Jobs pausieren"** (`AppSettings.jobsGloballyPaused`): laut
  Rückfrage im Chat bewusst ein **eigenständiger** Schalter, NICHT der
  bestehende `maintenanceModeEnabled` – obwohl die Bildvorlage die Zeile
  "Wartungsmodus" nennt. Die Frontend-Beschreibung dieser Zeile
  vermeidet deshalb bewusst das Wort "Wartungsmodus" (missverständlich,
  da keine echte Verbindung zur bestehenden Wartungsmodus-Funktion
  besteht).
- **Fehler-Benachrichtigung** (`notifyOnFailure`): mailt bei einem
  fehlgeschlagenen Lauf an `AppSettings.notificationRecipientEmail` –
  Rückfrage im Chat ergab: derselbe gemeinsame Empfänger wie die
  Systembenachrichtigungen (siehe
  [toast-and-system-messages.md](../frontend/toast-and-system-messages.md)),
  kein eigenes Adressfeld nur für Job-Fehler.

## Berechtigung

Rückfrage im Chat ergab: `settings:*` (Pivot-exklusiv), wie der Rest der
Einstellungen-Seite (Webhooks, Integrationen/SMTP, Protokoll) – kein
eigenes Recht.

## Frontend

- `scheduled-jobs-card.tsx` ("Geplante Aufgaben"): Klick auf eine Zeile
  klappt ein Bearbeiten-Panel auf (immer nur eine Zeile gleichzeitig),
  hervorgehoben mit `border-2 border-amber-500 bg-lime-50` (1:1 nach
  Bildvorlage – bewusst NICHT der App-eigene `border-l-4 border-l-
  primary bg-lime-50`-Aktiv-Zustand aus der Sidebar, da die Bildvorlage
  hier erkennbar Orange statt Lime als Rahmenfarbe zeigt). Jedes Feld
  speichert sofort (kein "Speichern"-Button in der Bildvorlage
  sichtbar): Rhythmus-Auswahl + Cron-Ausdruck-Eingabe (Blur-Save),
  "Bei Fehler benachrichtigen"/"Als kritisch markieren" instant-toggle,
  gleiches Prinzip wie die übrigen Einstellungen-Schalter in dieser App.
  Icon-Box grau (`bg-muted`/`text-muted-foreground`, siehe
  [[feedback_icon_boxes_grey_default]]), ändert sich nicht bei
  Auswahl/Hervorhebung.
  - "Rhythmus"-Dropdown ist eine reine Frontend-Komfortfunktion
    (`lib/jobs-format.ts`, `RHYTHM_PRESETS`) – bildet die 3 echten
    Zeitpläne dieser App plus einige gängige Presets ab, fällt bei
    keiner Übereinstimmung auf "Benutzerdefiniert" zurück. Das Backend
    kennt nur den rohen Cron-String.
  - "Letztes Protokoll" öffnet `job-log-dialog.tsx` – dieselbe
    Lauf-Historie wie die "Letzte Läufe"-Karte, aber auf einen Job
    gefiltert (`GET /jobs/:id/runs`), mit eigener dialoginterner
    Vor/Zurück-Pagination statt URL-Query (kein Seiten-Pfad für ein
    Modal).
- `recent-job-runs-card.tsx` ("Letzte Läufe"): app-weit über alle Jobs,
  neueste zuerst, **mit echter Server-Pagination** (Nutzervorgabe: "bei
  den letzte läufe pagination beachten" – in der Bildvorlage selbst
  nicht gezeigt, trotzdem ergänzt), eigener Query-Param `?jobsRunsPage=`
  (gleiches Muster wie `?webhooksPage=`/`?protocolPage=`).

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`ScheduledJob`, `JobRun`,
  `AppSettings.jobsGloballyPaused`)
- `apps/api/src/jobs/` (neu: `jobs.service.ts`, `jobs.controller.ts`,
  `jobs.module.ts`, `dto/`)
- `apps/api/src/content/content-scheduler.service.ts` (gelöscht),
  `content.module.ts` (Provider entfernt)
- `apps/api/src/deletion-requests/deletion-request-reminder-scheduler.service.ts`,
  `apps/api/src/privacy/privacy-report-scheduler.service.ts` (kein
  `@Cron()` mehr, geben jetzt einen Status-String zurück), jeweiliges
  Modul exportiert den Service jetzt für `JobsModule`
- `apps/api/src/settings/dto/update-settings.dto.ts`
  (`jobsGloballyPaused`)
- `apps/web/src/lib/jobs-format.ts` (neu), `lib/api-server.ts`
  (`ScheduledJob`, `JobRunEntry`/`JobRunsResponse`, `getJobs()`/
  `getJobRuns()`)
- `apps/web/src/components/scheduled-jobs-card.tsx`,
  `recent-job-runs-card.tsx`, `job-log-dialog.tsx` (alle neu)
- `apps/web/src/components/settings-form.tsx` (neuer Reiter "Jobs"),
  `app/dashboard/settings/page.tsx` (`getJobs()`/`getJobRuns()`)
- `apps/web/src/app/api/jobs/**` (neue BFF-Routen)

## Verifiziert

Live gegen den laufenden Dev-Server: `GET /jobs` liefert alle drei Jobs
mit korrektem `nextRunAt` (per `CronJob.nextDate()`); `POST /jobs/:id/run`
führt sofort aus und protokolliert; ungültiger Cron-Ausdruck → 400;
kritischer Job lässt sich nicht pausieren (Server ignoriert
`isPaused:true`); nach Entfernen von "kritisch" funktioniert Pausieren;
`GET /jobs/runs`-Pagination liefert korrekte `meta.pageCount`. Nest
startet ohne DI-Fehler trotz der neuen modulübergreifenden Imports
(`JobsModule` → `ContentModule`/`DeletionRequestsModule`/
`PrivacyModule`). Frontend nur per Typecheck/Lint geprüft, nicht per
Browser-Klick (kein Headless-Browser in dieser Session verfügbar).

## Offene Punkte

- Kein e2e-Test.
- "Letztes Protokoll"-Dialog nicht live durchgeklickt (nur Typecheck).
- Sollten künftig weitere echte Cron-Jobs entstehen, müssen sie nur zum
  `definitions`-Array in `JobsService` ergänzt werden – Registrierung,
  UI und Historie sind vollständig generisch.
