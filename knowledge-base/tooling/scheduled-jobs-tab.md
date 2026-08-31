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
  klappt ein Bearbeiten-Panel auf (immer nur eine Zeile gleichzeitig).
  Jedes Feld speichert sofort (kein "Speichern"-Button in der
  Bildvorlage sichtbar): Rhythmus-Auswahl + Cron-Ausdruck-Eingabe
  (Blur-Save), "Bei Fehler benachrichtigen"/"Als kritisch markieren"
  instant-toggle, gleiches Prinzip wie die übrigen Einstellungen-Schalter
  in dieser App. Icon-Box grau (`bg-muted`/`text-muted-foreground`,
  siehe [[feedback_icon_boxes_grey_default]]), ändert sich nicht bei
  Auswahl/Hervorhebung.
  - **Bugfix, gleicher Tag:** Hervorhebung der ausgewählten Kachel war
    zunächst 1:1 nach Bildvorlage `border-2 border-amber-500
bg-lime-50` (fest verdrahtetes Orange/Lime) – Nutzer-Feedback:
    "jobs orientiert sich nicht an der akzentfarbe. der border um die
    selektierte kachel muss dazu passen". Auf `border-primary
bg-primary/10` umgestellt (gleiches Muster wie `border-l-primary
bg-primary/15` in `roles-explorer.tsx`/`navigation-explorer.tsx`/
    `settings-form.tsx` u.a.) – reagiert jetzt auf die unter
    Einstellungen → Darstellung gewählte Akzentfarbe.
  - **Nachbesserung, gleicher Tag:** Status-Badge hieß zunächst "läuft"
    – Nutzer-Rückfrage machte klar, dass das mit "wird gerade
    ausgeführt" verwechselbar ist, obwohl es nur "nicht pausiert"
    bedeutet (kollidierte sichtbar mit "Noch nie" bei frisch anlegten,
    aber noch nicht fälligen Jobs). Umbenannt zu "aktiv". Spalten-Abstand
    in der Kopfzeile von `gap-3` auf `gap-6` vergrößert (Nutzer-Feedback:
    "mehr abstand zu den einzelnen bereichen").
  - Die beiden `SwitchRow`s im aufgeklappten Panel ("Bei Fehler
    benachrichtigen"/"Als kritisch markieren") haben einen weißen statt
    grauen Hintergrund (`className="border-[#F0F0F0] bg-white"`), da der
    Panel-Hintergrund selbst schon akzentfarben getönt ist – dafür bekam
    `switch-row.tsx` ein neues, optionales `className`-Prop (per `cn()`
    gemerged), das überall sonst im Code ungenutzt bleibt und den
    grauen Standard nicht verändert.
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
  - **Pagination ergänzt** (Nutzervorgabe, gleicher Tag: "bei geplante
    aufgaben auch pagination beachten") – `GET /jobs` liefert seither
    `{ items, meta }` statt eines flachen Arrays (`JobsService.
findAll(page, pageSize)` slict das in-memory `definitions`-Array,
    kein DB-Query nötig). **Achtung, Stolperstein:** Die Backend-Antwort
    wurde umgestellt, bevor Frontend/Typen nachgezogen waren → Live-Fehler
    "jobs.map is not a function" auf `/dashboard/settings` (Nutzer-
    Screenshot). Sofort behoben: `ScheduledJobsResponse`-Typ in
    `api-server.ts`, `getJobs({ page, pageSize })`, `?jobsPage=`-Query-
    Param in `page.tsx`, Karte hält jetzt `{items, meta}` statt eines
    Arrays im State. **Lehre:** Bei einer Response-Shape-Änderung
    Backend+Frontend in einem Zug ändern, nicht nacheinander mit Lücke
    dazwischen, wenn der Dev-Server während der Bearbeitung live bleibt.
- `recent-job-runs-card.tsx` ("Letzte Läufe"): app-weit über alle Jobs,
  neueste zuerst, **mit echter Server-Pagination** (Nutzervorgabe: "bei
  den letzte läufe pagination beachten" – in der Bildvorlage selbst
  nicht gezeigt, trotzdem ergänzt), eigener Query-Param `?jobsRunsPage=`
  (gleiches Muster wie `?webhooksPage=`/`?protocolPage=`).
  - **"Alle löschen"** (Nutzervorgabe, gleicher Tag, 1:1 nach dem
    "Alle löschen"-Muster der Protokoll-Karte): `DELETE /jobs/runs`
    löscht die komplette `JobRun`-Historie über alle Jobs UND setzt die
    zwischengespeicherten Aggregat-Felder auf jedem `ScheduledJob`
    (`lastRunAt`/`totalRuns`/`totalErrors`/...) zurück – sonst würde
    "Geplante Aufgaben" weiter alte Werte zeigen, obwohl die Historie
    gerade geleert wurde. Landet außerdem im "Protokoll"-Tab
    (Nutzervorgabe: "letzte läufe alle löschen muss mit in das
    protokoll") als `settings.job_runs_deleted`-Audit-Eintrag
    (`entityType`/`entityId` von `SettingsService` reexportiert). Da
    dieser Eintrag kein `metadata.field` hat, brauchte sowohl
    `settings-protocol-card.tsx` (`ACTION_LABELS`-Fallback für die
    Titel-Anzeige) als auch `SettingsService.exportSettingsChangesCsv()`
    (gleichnamiges `ACTION_LABELS`-Mapping, sonst leere "Feld"-Spalte in
    der CSV) eine kleine Ergänzung – **Nutzerfrage, die den zweiten Bug
    aufdeckte:** "letzte änderung als einstellung, kann man das als
    export bekommen oder ist das schon drin?".

**Refresh-Icons** (Nutzervorgabe, gleicher Tag: "setzte oben rechts ein
refresh icon um den bereich zu refreschen, ohne die seite neu zu laden",
dann "bei letzte läufe auch"): beide Karten haben oben rechts
(`CardAction`) einen `RefreshCw`-Icon-Button (`size="icon-sm"
rounded-lg`), der NUR die eigene Karte per Client-`fetch()` neu lädt und
lokal per `setState` ersetzt – bewusst kein `router.refresh()` (würde
die komplette Seite serverseitig neu rendern, genau das wollte der
Nutzer vermeiden).

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
- `apps/api/src/settings/settings.service.ts` (`SETTINGS_ENTITY_TYPE`/
  `SETTINGS_ENTITY_ID` jetzt exportiert, neues `ACTION_LABELS`-Mapping
  in `exportSettingsChangesCsv()`)
- `apps/web/src/lib/jobs-format.ts` (neu), `lib/api-server.ts`
  (`ScheduledJob`, `ScheduledJobsResponse`, `JobRunEntry`/
  `JobRunsResponse`, `getJobs({ page, pageSize })`/`getJobRuns()`)
- `apps/web/src/components/scheduled-jobs-card.tsx`,
  `recent-job-runs-card.tsx`, `job-log-dialog.tsx` (alle neu)
- `apps/web/src/components/switch-row.tsx` (neues optionales
  `className`-Prop)
- `apps/web/src/components/settings-protocol-card.tsx`
  (`ACTION_LABELS`-Fallback für Einträge ohne `metadata.field`)
- `apps/web/src/components/settings-form.tsx` (neuer Reiter "Jobs",
  direkt unter "Sicherheit" einsortiert – siehe Sidebar-Reihenfolge
  unten), `app/dashboard/settings/page.tsx` (`getJobs()`/`getJobRuns()`,
  `?jobsPage=`/`?jobsRunsPage=`)
- `apps/web/src/app/api/jobs/**` (BFF-Routen inkl. `DELETE /api/jobs/runs`)

## Nebenbei erledigt, gleicher Tag

- Sidebar-Reihenfolge unter Einstellungen: "Benachrichtigungen" direkt
  unter "Sicherheit" einsortiert (vorher zwischen Webhooks und Jobs),
  Nutzervorgabe: "setze benachrichtigungen direkt unter sicherheit in
  der sidebar bei einstellungen".
- Zwei Sidebar-Icons in `app-sidebar.tsx` getauscht (unabhängig vom
  Jobs-Feature, gleicher Chat-Abschnitt): Verwaltung-Gruppe
  `ShieldCheck` → `FolderCog`, Datenschutz-Eintrag `Lock` →
  `ShieldKeyhole`.
- "In neuem Tab öffnen" im Menüpunkt-Dialog (`navigation-item-dialog.tsx`)
  von einer schlichten `Checkbox` zunächst auf einen selbstgebauten
  Kreis-Badge umgestellt, dann auf Nutzer-Korrektur wieder zurück auf die
  Standard-`Checkbox` – aber mit `className="size-5 rounded-md"`, exakt
  das Muster aus `roles-explorer.tsx`s Rechte-Checkboxen (Nutzervorgabe:
  "kein kreis mit rand, sondern wie bei rollen und rechte eine
  checkbox").

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
Browser-Klick (kein Headless-Browser in dieser Session verfügbar) –
der "jobs.map is not a function"-Fehler oben wurde vom Nutzer selbst per
Screenshot aus dem echten Browser gemeldet, nicht von mir vorab erkannt.

Live-Test der Löschanfragen-Fristerinnerung (Nutzerfrage: "an welche
email wird löschanfragen durch den job gesendet? die mail ist nicht
angekommen"): Root Cause war kein Bug – alle offenen Löschanfragen
hatten zu diesem Zeitpunkt eine Frist ca. 1 Monat in der Zukunft, außerhalb
des 7-Tage-Erinnerungsfensters, der Job lief korrekt mit "Keine fälligen
Fristerinnerungen." Zum Testen wurde `DSR-2026-001.dueAt` testweise auf
+3 Tage gesetzt (mit Nutzer-Zustimmung, unkritisch, da der hinterlegte
DSB-Kontakt die eigene Adresse des Nutzers ist).

## Offene Punkte

- Kein e2e-Test.
- "Letztes Protokoll"-Dialog nicht live durchgeklickt (nur Typecheck).
- Sollten künftig weitere echte Cron-Jobs entstehen, müssen sie nur zum
  `definitions`-Array in `JobsService` ergänzt werden – Registrierung,
  UI und Historie sind vollständig generisch.

## Update 2026-08-30: Job-Lauf-Historie aufräumen (Retention)

Nutzerfrage ("wie sieht das mit der history aus, wenn dann hunderte
einträge bei jobs ist?") deckte auf, dass `JobRun` unbegrenzt wächst –
allein die Live-Überwachung gesperrter Websites (siehe
[master-slave-licensing.md](../platform/master-slave-licensing.md))
erzeugt 48 Zeilen/Tag. Vierter Job in `definitions`: `job-run-cleanup`
(täglich 3:00), löscht `JobRun`-Zeilen älter als
`AppSettings.jobRunRetentionDays` (nullable Int, Default 90, `null` =
unbegrenzt, gleiches Muster wie `retentionFormSubmissionsDays`) – **über
alle `jobId`s hinweg**, nicht nur die registrierten `definitions`, sonst
blieben die größten Verursacher (Live-Überwachung, Lizenzprüfung)
unberührt.

Frontend-Karte `job-run-retention-card.tsx` (`SegmentedPicker`,
Optionen 30/90 Tage, 1 Jahr, unbegrenzt) wurde zweimal umplatziert:
zunächst Teil von `recent-job-runs-card.tsx`, dann per Nutzervorgabe
("setze das am anfang der seite") eigene Karte ganz oben auf der Seite.
Live-Verifiziert (nicht nur "kein Fehler", sondern eine synthetische
10 Tage alte `JobRun`-Zeile per Skript eingefügt, Job manuell ausgelöst,
tatsächliche Löschung bestätigt).

## Update 2026-08-30: "Alle Jobs pausieren" wandert in dieselbe Karte

Nutzervorgabe ("alle jobs pausieren ganz am anfang der seite in die
kachel job lauf historie aufbewahren"): der bestehende
`jobsGloballyPaused`-Schalter (bis dahin unten in
`recent-job-runs-card.tsx`) wurde in `job-run-retention-card.tsx`
verschoben – beide sind job-weite Einstellungen, keine Eigenschaft der
Lauf-Historie-Liste selbst. `RecentJobRunsCard` verlor dadurch ihr
`jobsGloballyPaused`-Prop komplett und enthält seither nur noch die
Läufe-Liste, Pagination und "Alle löschen"/Refresh.

## Update 2026-08-30: Jobs respektieren die Datenschutz-Modul-Freischaltung

Nutzervorgabe: "dsb job-monatsbericht darf nur da sein, wenn
datenschutzmodul aktiv ist. wenn nicht, darf der job weder erscheinen
noch ausgeführt werden" (danach identisch für die
Löschanfragen-Fristerinnerung: "genau so, nur mit aktiven
Datenschutzmodul"). Baut auf der Datenschutz-als-Modul-Infrastruktur
auf (siehe
[master-slave-licensing.md](../platform/master-slave-licensing.md),
Update 2026-08-28) – `JobDefinition` bekommt ein neues optionales Feld
`requiresModuleFeature?: { moduleKey, featureKey }`:

- `dpo-monthly-report` → `{ moduleKey: 'datenschutz', featureKey: 'dsb' }`
- `dsr-deadline-reminder` → `{ moduleKey: 'datenschutz', featureKey: 'loeschanfragen' }`

`JobsService.isEntitled(def)` prüft das über dieselbe
Master-wie-Slave-einheitliche Quelle wie `ModuleFeatureGuard`/
`NotificationsService.hasModuleFeature`
(`LicenseClientService.getEffectiveStatus().moduleFeatures`). Wirkt an
drei Stellen:

- `findAll()` filtert unlizenzierte Jobs komplett aus der Liste heraus
  (`getEntitledDefinitions()`) – "Geplante Aufgaben" zeigt sie gar nicht
  erst an.
- `getDefinition(id)` wirft `NotFoundException` für einen (aktuell)
  nicht freigeschalteten Job – gleiche "existiert nicht"-Konvention wie
  der Guard bei einer gesperrten Route. Trifft `update()`, `runNow()`
  (Button "Jetzt ausführen") und `findRunsForJob()` gleichermaßen.
- `execute()` prüft zusätzlich direkt vor jedem Lauf – fängt auch den
  automatischen Cron-Tick ab, der `getDefinition()` nicht durchläuft
  (die `CronJob`-Registrierung selbst bleibt für alle `definitions`
  bestehen, unabhängig von der Freischaltung).

Historische `JobRun`-Einträge (in "Letzte Läufe") bleiben unabhängig von
der aktuellen Freischaltung mit korrektem Job-Titel sichtbar – die
`titleById`-Zuordnung in `findRecentRuns()` nutzt bewusst das
ungefilterte `definitions`-Array.

Live gegen die laufende API verifiziert: Feature `dsb` deaktiviert →
`dpo-monthly-report` verschwindet aus `GET /jobs`, `POST
/jobs/dpo-monthly-report/run` und `GET
/jobs/dpo-monthly-report/runs` liefern 404; gleiches für `loeschanfragen`
→ `dsr-deadline-reminder`. Beide Features danach wieder aktiviert,
beide Jobs wieder sichtbar.

## Update 2026-08-30: Aktivitäten-Historie aufräumen (geteilter AuditLog)

Nutzerfrage, ob es noch weitere Datenschutz-Jobs gibt, führte zur
Anschlussfrage "bitte auch noch den aktivitäten history über sowas
regeln" – der `AuditLog` (Grundlage für den "Aktivität"-Tab der
Benutzer-Profilseite, das "Protokoll" unter Einstellungen UND das
Datenschutz-"Zugriffsprotokoll", siehe
[privacy-page.md](../auth/privacy-page.md) bzw. `privacy-view.tsx`)
wuchs bis dahin komplett unbegrenzt.

**Wichtige Rückfrage vorab:** Für das Zugriffsprotokoll gab es bereits
eine bewusste Nutzerentscheidung vom 18.08. gegen automatisches Löschen
("Werte speichern + Liste mit Einzel-/Alles-löschen statt
automatischer Hintergrund-Löschung", `retentionAccessLogMonths`,
Default 12 Monate). Da alle drei Ansichten dieselbe Tabelle teilen,
würde eine neue Automatik das faktisch überschreiben. Rückfrage per
`AskUserQuestion` ergab: "Automatik für alles" – bewusste, informierte
Entscheidung, die bisherige rein manuelle Regelung zu ersetzen.

Fünfter Job: `activity-log-cleanup` (täglich 4:00,
`AuditLogService.deleteOlderThan(cutoff)`), gesteuert über
`AppSettings.activityLogRetentionDays` (nullable Int, **Default bewusst
365** statt der sonst üblichen 90 – ein kürzerer Default hätte
Zugriffsprotokoll-Einträge automatisch gelöscht, bevor sie je die
konfigurierten 12 Monate erreichen und in der bestehenden manuellen
Review-Liste auftauchen). Frontend-Karte
`activity-log-retention-card.tsx`, gleiches `SegmentedPicker`-Muster.
Der erklärende Text bei "Zugriffsprotokoll (Monate)" in `privacy-view.tsx`
wurde angepasst (vorher fälschlich "keine automatische Löschung") und
verweist jetzt auf die neue Einstellung unter Einstellungen → Jobs.

Live verifiziert – **mit echtem Seiteneffekt:** Retention testweise auf
1 Tag gesetzt, Job ausgelöst → 98 echte, bereits vorhandene
Audit-Log-Zeilen (nicht nur eine synthetisch eingefügte Testzeile)
wurden gelöscht, bevor die Einstellung wieder auf 365 zurückgesetzt
wurde. Lehre: Bei Retention-Tests auf einer Tabelle mit echtem
Bestand IMMER mit einem sehr kurzen, aber nicht komplett zerstörerischen
Vorher-Blick rechnen – hier unkritisch (Dev-Datenbank), auf einer
Produktivinstanz wäre ein Dry-Run oder ein Test ausschließlich mit
synthetischen Zeilen nötig gewesen.

## Update 2026-08-30: Layout – Retention-Karten in die rechte Sidebar

Nutzervorgabe: "mach job history aufbewahren und aktivitätshistory
aufbewahren nach rechts als sidebar und geplante aufgaben und letzte
aufrufe mittig" – der "Jobs"-Reiter folgt jetzt dem app-weiten
Sidebar-Breiten-Muster von "Mein Konto"
(`grid grid-cols-1 items-start gap-4 lg:grid-cols-3`, Hauptspalte
`lg:col-span-2`), siehe [[feedback_sidebar_width_convention]]: Hauptspalte
= `ScheduledJobsCard` + `RecentJobRunsCard`, rechte Sidebar =
`JobRunRetentionCard` + `ActivityLogRetentionCard`.

## Update 2026-08-31: kein Zeitstempel mehr in der eingeklappten Zeile

Nutzervorgabe: "in der Übersicht in eingeklapptem Zustand keinen Zeitpunkt
anzeigen. sobald man da aufklappt, sieht man das ja". Die rechte Spalte der
Job-Zeile (letzter Lauf + Dauer, `formatRelativePast`/`formatDuration`)
ist deshalb entfallen; die Zeile zeigt jetzt nur noch Titel, Beschreibung,
Rhythmus samt Cron-Ausdruck, Status-Badge und Schalter.

**Wichtig dabei:** der aufgeklappte Bereich zeigte den _letzten_ Lauf
vorher gar nicht – nur "N Läufe · N Fehler · nächster: …". Ein reines
Löschen hätte die Information also komplett aus der Oberfläche entfernt
(sie stünde nur noch im Protokoll-Dialog). Die Fußzeile im aufgeklappten
Zustand lautet deshalb jetzt: "N Läufe · N Fehler · letzter: <Zeitpunkt>
(<Dauer>) · nächster: <Zeitpunkt>". Die Dauer wird nur angehängt, wenn es
überhaupt einen Lauf gab – sonst stünde dort "letzter: Noch nie (–)".
