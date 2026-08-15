# Toast-Benachrichtigungen & Inline-Systemmeldungen

**Datum:** 2026-08-15
**Betroffene Bereiche:** apps/web (fast alle Formular-/Listen-Komponenten),
apps/api (Wartungsmodus, Medien-Kontingent, Webhook-Fehlschlag-Tracking)

## Was wurde gebaut

Zwei getrennte, sich ergänzende Bausteine für Statusrückmeldungen im
Dashboard:

1. **Toasts** (`components/app-toast.tsx`, auf `sonner` aufgesetzt, bereits
   als `<Toaster/>` in `app/layout.tsx` eingebunden): drei Helfer
   `toastCreated`/`toastEdited`/`toastDeleted(description?)`, jeweils mit
   farbigem linkem Rand + Icon-Kreis + fetter Titel + gedämpfter
   Beschreibung + eigener Schließen-Button (`toast.custom()` statt
   Sonners eingebauter `success`/`error`-Varianten, da die kein
   Icon-Farbkreis pro Aktion unterstützen). `ui/sonner.tsx` setzt
   `position="bottom-right"`, `expand={false}`, `visibleToasts={5}`
   explizit – Sonner stapelt mehrere gleichzeitige Toasts dadurch sichtbar
   (vorderster in voller Größe, weitere dahinter leicht versetzt/verkleinert,
   per CDP-`getBoundingClientRect`/`transform` verifiziert). Praktisch
   **jede** erfolgreiche Anlegen-/Bearbeiten-/Löschen-Aktion im gesamten
   Dashboard ruft jetzt einen dieser drei Helfer auf (Auth/Einstellungen,
   Benutzer/Rollen, Content inkl. Versionen, Medien/Ordner,
   Navigation/Taxonomie/Webhooks/Vorschau-Links, FAQ/Galerien) – bewusst
   ausgenommen: Login/Logout, Autosave, Drag&Drop-Umsortieren,
   Aktiv/Inaktiv-Toggles, Zwischenablage-Kopieren (keine "Erfolg"-Aktion im
   engeren Sinn bzw. zu häufig/nicht der Nutzerabsicht entsprechend für
   einen Toast).
2. **`SystemMessage`** (`components/ui/system-message.tsx`): dauerhaft
   sichtbare Inline-Zustandsmeldung innerhalb einer Seite (nicht
   transient wie ein Toast). Fünf Varianten (`info`/`success`/`warning`/
   `error`/`neutral`), je mit passendem Icon/Rahmen-/Textfarbe (1:1 nach
   Bildvorlage), optional `dismissible`+`onDismiss`, optional `icon={false}`
   zum Ausblenden des Icons, optional `actions` (Button-Zeile, z.B.
   "Jetzt speichern"/"Verwerfen"). Aktuell verdrahtete Einsatzorte:
   - **Content-Editor** (`content-editor-form.tsx`): Sperr-Hinweis (Fremd-
     Bearbeitung) und Entwurfs-Wiederherstellungs-Banner (beide vorher
     schon vorhanden, jetzt auf `SystemMessage` migriert statt
     handgestrickter `div`s) sowie **neu**: "Ungespeicherte Änderungen"
     (`warning`, sichtbar sobald `lastAutosavedAt` gesetzt ist – derselbe
     State, der auch das Autosave-Zeitstempel-Label speist, siehe
     [content-autosave.md](../content/content-autosave.md) – mit "Jetzt
     speichern"/"Verwerfen") und "Speichern fehlgeschlagen" (`error`,
     ersetzt reinen `text-destructive`-Absatz für `formError`).
   - **Dashboard-Startseite** und **Medien-Übersicht**: gemeinsame
     `StorageQuotaBanner` (`components/storage-quota-banner.tsx`, `warning`,
     ab 90% Medien-Speicherauslastung, siehe unten).
   - **Dashboard-Startseite**: "Wartungsmodus aktiv" (`neutral`), sichtbar
     wenn `AppSettings.maintenanceModeEnabled` gesetzt ist.
   - **Webhooks-Seite**: `WebhookFailureBanner`
     (`components/webhook-failure-banner.tsx`, `error`, `dismissible`
     – Dismiss ist bewusst nur In-Memory/pro Seitenaufruf, kein
     `localStorage`, damit ein aktives Problem nach Reload wieder
     sichtbar ist statt versehentlich dauerhaft ausgeblendet zu bleiben).

Im selben Zug wurden drei kleine Backend-Erweiterungen gebaut, die diese
Banner mit echten Daten statt Fake-UI versorgen (siehe PROCESS.md – ein
Hinweis-Banner ohne echten Datenpfad wäre eine irreführende Attrappe
gewesen):

- **Wartungsmodus**: `AppSettings.maintenanceModeEnabled` (Boolean,
  Default `false`), Schalter in Einstellungen → "Zugriff & Funktionen".
  **Nur ein Hinweis im Dashboard** – es gibt in diesem Repo keine
  öffentliche Website-Auslieferung (`apps/web` ist reines Headless-CMS-
  Dashboard + `/preview/[token]`), tatsächliche Sperrung für Besucher
  müsste eine externe, das API konsumierende Frontend-Anwendung selbst
  umsetzen (das Flag ist über `GET /settings/public` erreichbar).
- **Medien-Speicherkontingent**: `AppSettings.mediaStorageQuotaMb`
  (`Int?`, `null` = unbegrenzt; bewusst **MB als `Int`**, nicht Bytes als
  `BigInt` – vermeidet BigInt-JSON-Serialisierungsprobleme, siehe
  Stolpersteine). Neuer Endpoint `GET /media/storage-usage`
  (`media.service.ts#getStorageUsage`, `RequirePermission('media:read')`)
  summiert `Media.size` + `MediaVariant.size` (Thumbnails/responsive
  Varianten liegen ebenfalls physisch auf der Platte) und berechnet
  `percentUsed`. Einstellungsfeld für die Kontingent-Zahl in MB im
  "Zugriff & Funktionen"-Tab.
- **Webhook-Fehlschlag-Tracking**: `Webhook.lastDeliveryStatus`
  (`"success"|"failure"|null`), `lastDeliveryAt`, `lastDeliveryError`,
  `consecutiveFailures` (Int, Default 0). `WebhooksService#deliver`
  schreibt das Ergebnis jeder Zustellung zurück (`recordDeliveryResult`,
  best-effort wie `deliver` selbst – ein Fehler beim Schreiben darf den
  Dispatch nicht stören). `findAll` liefert zusätzlich `meta.failingCount`
  (`consecutiveFailures > 0`, über **alle** Webhooks gezählt, nicht nur
  die aktuelle Seite – sonst würde das Banner auf Seite 1 fehlschlagende
  Webhooks auf Seite 2 verschweigen). `webhooks-manager.tsx` zeigt pro
  Zeile eine Status-Spalte (Erfolgreich/N× fehlgeschlagen/Noch keine
  Zustellung).

## Warum diese Lösung

- **Toast vs. `SystemMessage` als zwei getrennte Komponenten statt einer**:
  unterschiedliche Lebensdauer/Zweck – ein Toast bestätigt eine
  abgeschlossene Aktion und verschwindet von selbst, eine `SystemMessage`
  beschreibt einen andauernden Zustand ("Kontingent ist voll", "Sperre
  aktiv") und bleibt, bis der Zustand sich ändert oder aktiv weggeklickt
  wird. Eine gemeinsame Komponente hätte beide Konzepte unnötig vermischt.
- **`icon`-Prop erlaubt `false` statt nur Icon-Override**: die
  Bildvorlage zeigt zwei der "Varianten"-Beispiele ganz ohne Icon
  (schlanke, textlastige Banner) – eine reine Icon-Override-Prop hätte
  das nicht abgebildet, ohne dass Aufrufer ein leeres Fragment übergeben
  müssten.
- **Kontingent in MB statt Bytes/`BigInt`**: `Int` in Postgres reicht bis
  ~2,1 Mrd. – als Byte-Zahl wären das nur ~2 GB Maximalkontingent, als
  MB-Zahl dagegen ~2000 TB, weit genug für jeden realistischen Fall, ohne
  die Serialisierungskomplexität von `BigInt` (`JSON.stringify` wirft bei
  `BigInt` ohne expliziten Umgang eine `TypeError`) ins Projekt zu holen.
- **`failingCount` als eigenes `meta`-Feld statt Client-seitig aus der
  aktuellen Seite gezählt**: Webhooks sind paginiert; ein rein
  Client-seitiger Zähler über `items` hätte fehlschlagende Webhooks auf
  anderen Seiten verschwiegen.

## Stolpersteine / Besonderheiten

- **Sonner-Stapelung braucht keine eigene Logik** – das ist eingebautes
  Verhalten (`expand={false}` ist ohnehin der Default), nur bei
  `toast.custom()` war nicht offensichtlich, dass es trotzdem greift, da
  die gerenderte Karte komplett eigenes Markup ist. Per CDP verifiziert:
  zwei rasch aufeinanderfolgende Toasts erhalten unterschiedliche
  `data-front`/`transform`/`z-index`-Werte (Sonner steuert das über den
  äußeren `<li data-sonner-toast>`-Wrapper, unabhängig vom Karten-Inhalt).
- **`AlertDialogAction` erbt `variant="destructive"` direkt von
  `Button`** (`alert-dialog.tsx` wrapped `Button` ohne eigene
  Varianten-Logik) – die globale Umstellung auf Outline-Stil (siehe
  [design-refresh.md](./design-refresh.md)) betrifft dadurch automatisch
  auch die "Wirklich löschen?"-Bestätigungs-Buttons in jedem
  `ConfirmDeleteDialog`, nicht nur einzelne Listen-Buttons.
- **Windows-Prisma-Client-Lock beim Schema-Ändern**: Jede
  `prisma migrate dev` mit laufendem `nest start --watch` schlägt mit
  `EPERM`/`rename … query_engine-windows.dll.node.tmp…` fehl, da Node den
  geladenen Client hält. Fix-Ablauf: API-Dev-Prozess gezielt beenden
  (`nest.js`- und `apps/api/dist/main`-Prozess, per
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` finden),
  Migration/`prisma generate` erneut ausführen, danach `pnpm dev` neu im
  Hintergrund starten. Mehrere Schema-Änderungen in einem Rutsch planen
  spart wiederholte Neustarts.

## Relevante Dateien

- `apps/web/src/components/app-toast.tsx`, `ui/sonner.tsx`
- `apps/web/src/components/ui/system-message.tsx`
- `apps/web/src/components/storage-quota-banner.tsx`,
  `webhook-failure-banner.tsx`
- `apps/web/src/app/dashboard/page.tsx`, `dashboard/media/page.tsx`,
  `dashboard/webhooks/page.tsx`
- `apps/web/src/components/content-editor-form.tsx`,
  `settings-form.tsx`, `webhooks-manager.tsx`
- `apps/api/src/settings/{settings.service,dto/update-settings.dto}.ts`
- `apps/api/src/media/{media.service,media.controller}.ts`
- `apps/api/src/webhooks/webhooks.service.ts`
- `packages/database/prisma/schema.prisma` (`AppSettings.
  maintenanceModeEnabled`/`mediaStorageQuotaMb`, `Webhook.
  lastDeliveryStatus`/`lastDeliveryAt`/`lastDeliveryError`/
  `consecutiveFailures`)

## Offene Punkte

- Wartungsmodus wirkt sich nur auf das Dashboard-Banner aus, keine echte
  Besuchersperre (siehe oben, außerhalb des Scopes von `apps/web`).
- Kein automatisiertes Zurücksetzen von `consecutiveFailures` außer durch
  eine erneute erfolgreiche Zustellung – kein manueller "Reset"-Button in
  der UI.
