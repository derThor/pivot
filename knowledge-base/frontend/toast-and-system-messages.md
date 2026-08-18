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

## Update 2026-08-16: Nutzerbezogene Kategorien + Ab-/anschaltbarkeit + Cache

Drei neue Kategorien ergänzt, dieselbe Herkunft wie die 2b.14-Profilseite
(Mehrfach-Rollen, Anonymisierung, Impersonation, `mustChangePassword`,
`failedLoginAttempts`, `User.pendingActivation`) – siehe
[user-profile-page-plan.md](../auth/user-profile-page-plan.md):

- **Wartende Freischaltungen** – `User.pendingActivation` (neu, siehe
  Schema-Kommentar): unterscheidet "wartet auf Admin-Freischaltung" von
  einer normalen, manuell deaktivierten Zeile (beide `isActive: false`).
  Wird bei Registrierung gesetzt (`requireAdminActivation` aktiv), beim
  Aktivieren durch einen Admin automatisch gelöscht.
- **Auffällige Fehlversuche** – Nutzer mit ≥5 fehlgeschlagenen Logins in
  Folge (`User.failedLoginAttempts`, Schwelle als privates Konstante in
  `UsersService`).
- **Anstehende Passwortwechsel** – Nutzer mit `mustChangePassword: true`.

Neuer Endpunkt `GET /users/notification-counts` (`UsersService.
getNotificationCounts()`) liefert die drei rohen Zahlen, `UserNotification
Banners` (`apps/web/src/components/user-notification-banners.tsx`) rendert
die Banner nach demselben `SystemMessage`-Muster wie Storage/Webhooks.

**Jede der jetzt 7 Kategorien** (die 4 bisherigen + die 3 neuen) ist über
`AppSettings.notify*` (7 neue Boolean-Felder) einzeln ab-/anschaltbar –
Nutzervorgabe: "das soll nicht nur das Visuelle steuern, sondern auch das
Erfassen dieser Nachrichten beenden, wenn nicht aktiv". Umgesetzt als:
deaktivierte Kategorie wird nicht nur ausgeblendet, sondern die
zugehörige Abfrage/der Request entfällt komplett (`dashboard/layout.tsx`
und `system-messages/page.tsx` überspringen `getMediaStorageUsage()`/
`getWebhooks()`/`getUserNotificationCounts()` ganz, `UsersService.
getNotificationCounts()` überspringt einzelne COUNT-Queries pro
Kategorie). Ausnahme bewusst: `notifyLocalDrafts` steuert nur die
Anzeige (`LocalDraftsSection`s `enabled`-Prop) – das zugrunde liegende
Autosave selbst hängt an der separaten `autosaveEnabled`-Einstellung und
läuft unabhängig weiter (sonst bräche die "Entwurf wiederherstellen"-
Funktion).

Neue Karte **"Benachrichtigungen"** auf `/dashboard/system-messages`
(`NotificationSettingsCard`, rechte Spalte, nur sichtbar mit
`settings:update`) – ein Switch pro Kategorie, PATCHt `/api/settings`.

**Performance-Hintergrund** (Nutzervorgabe: "die App ist nicht auf eine
kleine, feste Admin-Zahl beschränkt" – auch Kundenkonten mit vielen
Nutzern, z.B. Fitnessstudio-Mitglieder, laufen über dasselbe `User`-
Modell): `getNotificationCounts()` läuft bei jeder Dashboard-Navigation
für jeden Nutzer mit `users:read` und ist deshalb zusätzlich für 30s über
den neuen, app-weiten `CacheService` gecacht (siehe
[backend-caching.md](../tooling/backend-caching.md)) sowie durch
zusammengesetzte DB-Indizes auf `User` (`pendingActivation`+
`anonymizedAt`, `isActive`+`anonymizedAt`+`failedLoginAttempts`,
`mustChangePassword`+`isActive`+`anonymizedAt`) und `UserRole.roleId`
abgesichert.

## Update 2026-08-17: `SystemMessage`-Farben sind die App-weite Referenz – globaler Audit

Klargestellt (Nutzervorgabe, mehrfach mit Nachdruck: "wichtig, die
FARBEN!!!"): die 5 Varianten-Farben in `ui/system-message.tsx` (siehe
oben, 1:1 nach Bildvorlage vom 2026-08-15 gebaut) sind die **einzige**
Referenz für jede Art von Alert-/Hinweis-Box in der App – info=lime,
success=green, warning=amber, error=red, neutral=muted/grey. Kein anderer
Ort im Code darf eigene, angenäherte Farben für denselben Zweck erfinden
(z.B. `emerald` statt `green`, oder abweichende Opacity-/Shade-Werte im
Dark Mode).

Per Vollaudit (alle Treffer für Alert-artige Boxen in `apps/web/src`
durchsucht) gefundene Abweichungen, alle auf die kanonischen Klassen
umgestellt:

- **`account-lock-banner.tsx`, `email-verification-banner.tsx`,
  `impersonation-banner.tsx`**: alle drei volle Breite, `border-b`-Balken
  (bewusst kein `rounded-xl`-Kasten wie `SystemMessage` – eigenes
  Layout-Muster für Kopfzeilen-Banner). Nutzten `bg-amber-50 ...
  text-amber-900 dark:bg-amber-950 dark:text-amber-200` – korrekt wäre
  (und ist jetzt) `border-amber-300 dark:border-amber-900 dark:bg-amber-950/40
  text-amber-800 dark:text-amber-400`, dazu eine vom Text getrennte
  Icon-Farbe `text-amber-600 dark:text-amber-500` (vorher hatte das Icon
  gar keine eigene Farbklasse, erbte die Textfarbe).
- **`dashboard/content/[id]/preview/page.tsx`,
  `app/preview/[token]/page.tsx`** (interne Vorschau / Freigabe-Link-
  Hinweis): handgestrickte `rounded-xl border ...`-Box mit im Dark Mode
  abweichenden Werten (`border-amber-500/30 bg-amber-500/10` statt
  `border-amber-900 bg-amber-950/40`). Auf echte `<SystemMessage
  variant="warning" icon={Eye} title="..." />` umgestellt statt die
  Klassen nur zu korrigieren – garantiert künftige Konsistenz automatisch,
  keine zweite Stelle mehr, die von Hand synchron gehalten werden muss.
- **`two-factor-setup-card.tsx`** (Konto → Sicherheit, "Authenticator-App
  eingerichtet"-Kasten): weiterhin handgestrickt statt `SystemMessage` zu
  nutzen – bewusst **nicht** auf die Komponente umgestellt, da deren
  `actions`-Slot nur unterhalb des Texts rendert, die Bildvorlage aber den
  "Neu einrichten"-Button in derselben Zeile rechts zeigt (das Layout ist
  mit `SystemMessage` nicht abbildbar). Bei den Farben selbst zwei
  Fehlversuche, bevor es stimmte – siehe eigener Abschnitt unten
  ("info vs. success verwechselt").
- **Bewusst ausgenommen:** `app-toast.tsx` (transiente Toasts, eigenes
  Layout mit Icon-Kreis + linkem Rand-Akzent statt getönter Box – laut
  eigenem Code-Kommentar bewusst ein anderes Muster als `SystemMessage`)
  sowie alle Status-`Badge`-Pills (nutzen die separate, ebenfalls
  bestehende `emerald`/`red`-Konvention für Badges, siehe
  [two-factor-authentication.md](../auth/two-factor-authentication.md)
  "2FA-Status durchgängig als Badge" – Badges und Alert-Boxen sind zwei
  unterschiedliche, je für sich konsistente Farbfamilien in dieser App).

**Zweiter, breiterer Audit (selbiger Tag, auf Nutzer-Nachfrage "alle
Alerts im gesamten Projekt aktualisieren"):** gesamtes `apps/web/src`
erneut durchsucht – diesmal zusätzlich nach rohen Hex-Hintergründen
(`bg-[#...]`), allen Tailwind-Farbfamilien (nicht nur amber/red/green),
jeder Dialog-Komponente (26 Stück geprüft) sowie gezielt dem
Benutzer-Bereich (`user-edit-view.tsx`, `create-user-dialog.tsx`,
`users-table.tsx`, `no-dashboard-access.tsx` u.a.). Ergebnis: **keine
weiteren Abweichungen gefunden** – alle im ersten Durchgang gefixten
Stellen sind korrekt, `two-factor-setup-card.tsx`s Erfolgs-Box hatte
bereits exakt die kanonischen `green-*`-Klassen. Rohe Hex-Hintergründe
existieren nur als UI-Chrome (Platzhalter, Tab-Hintergründe,
Upload-Zonen-Hover), nicht als Status-Alerts. Damit ist diese Datei die
**einzige** Quelle für Alert-/Hinweis-Box-Farben im gesamten Projekt –
jede künftige Stelle, die eine getönte Icon+Text-Box für einen Status
(info/success/warning/error/neutral) braucht, MUSS entweder die echte
`<SystemMessage>`-Komponente rendern oder – nur falls das Layout das
zwingend verhindert (z.B. Aktions-Button inline rechts statt unterhalb,
oder ein Balken über volle Breite ohne `rounded-xl`) – exakt deren
Klassen aus der Tabelle oben kopieren. Niemals eine angenäherte Farbe
neu erfinden.

**Dritter Nachtrag (selbiger Tag): `info` (lime) und `success` (green)
verwechselt.** Die Bildvorlage hat **zwei** grünliche Varianten, die sich
mit bloßem Auge leicht verwechseln lassen:
- `info` = `lime` (olivgrün-gelblich) – z.B. "Hinweis" und "Neues Feature
  verfügbar" in der Bildvorlage.
- `success` = `green` (kühleres Minzgrün) – z.B. "Gespeichert".

Der "Authenticator-App eingerichtet"-Kasten in `two-factor-setup-card.tsx`
brauchte die **`info`/lime**-Variante (Status-Hinweis, keine
abgeschlossene Erfolgsmeldung wie ein Speichervorgang) – wurde aber erst
auf `emerald` (falsch, keine der beiden Bildvorlage-Varianten) und dann
auf `success`/`green` (falsch, die andere Variante) korrigiert, bevor
`info`/`lime` als tatsächlich richtige Wahl erkannt wurde. Per
Pixel-Abgleich verifiziert (`System.Drawing` in PowerShell, RGB der
gerenderten Box mit der Bildvorlage verglichen): `bg-lime-50` rendert als
exakt `#F7FEE7`, praktisch identisch zur Bildvorlage. **Faustregel für
künftige Fälle:** ein Kasten, der einen bereits bestehenden Zustand
*anzeigt* (2FA eingerichtet, Wartungsmodus aktiv, ein Hinweis) ist `info`;
ein Kasten, der eine gerade **abgeschlossene, einmalige Aktion**
bestätigt (gespeichert, hochgeladen, erfolgreich versendet) ist
`success`.

**Vierter Nachtrag (selbiger Tag): 2FA-Karte 1:1 nach Bildvorlage
nachgebaut, exakte CSS-Werte statt Tailwind-Paletten-Klassen.** Für den
"Zwei-Faktor"-Bereich auf `Mein Konto` (`two-factor-setup-card.tsx`) gab
die Bildvorlage exakte Nicht-Palette-Werte vor, die nicht 1:1 auf
Tailwinds Standardfarben abbilden – hier wurden sie per Arbitrary-Value-
Syntax (`bg-[...]`, `shadow-[...]`, `text-[#...]`) statt über
Paletten-Utilities umgesetzt:

- **Card-Titel** verkürzt von "Zwei-Faktor-Authentifizierung" auf
  "Zwei-Faktor", `CardDescription` komplett entfernt (Bildvorlage zeigt
  keinen Beschreibungstext unter dem Titel).
- **"Authenticator-App eingerichtet"-Kasten** (info/lime, siehe dritter
  Nachtrag oben): `bg-[rgba(188,230,77,0.14)]` +
  `shadow-[inset_0_0_0_1px_rgba(120,150,60,0.35)]` + `text-[#1c2b3a]` für
  den Text, Icon in `text-[#78963c]`. Per Pixel-Sample verifiziert: über
  weißem Hintergrund rendert das exakt als `246,251,230` RGB – deckt sich
  mit der `rgba(188,230,77,0.14)`-Vorgabe rechnerisch (188·0.14+255·0.86
  ≈ 246 usw.).
- **"Neu einrichten"-Button** (innerhalb des lime-Kastens): teilt bewusst
  denselben Hintergrund wie der Kasten selbst
  (`bg-[rgba(188,230,77,0.14)]`, `border-[rgba(120,150,60,0.35)]`,
  `text-[#1c2b3a]`) statt weiß/Standard-`outline` hervorzustechen, dazu
  `size="sm"`, damit er nicht höher wirkt als der Kasten drumherum.
- **"Neue Codes generieren"-Button** (außerhalb des lime-Kastens, eigene
  Zeile): exakte Vorlage `background: #F4F4F5; box-shadow: inset 0 0 0 1px
  #E6E6E6; border-radius: 8px; padding: 8px 12px; font-size: 12.5px;
  font-weight: 500; color: #6E6E6E;` umgesetzt als reines `<button>`
  (nicht die `Button`-Komponente, deren `variant="secondary"` einen
  abweichenden, zu hellen Ton lieferte) mit
  `bg-[#F4F4F5] shadow-[inset_0_0_0_1px_#E6E6E6] rounded-[8px] px-3 py-2
  text-[12.5px] font-medium text-[#6E6E6E]` und **`self-start`
  statt `w-full`** – Button ist absichtlich so breit wie sein Text, nicht
  container-breit. Per Pixel-Sample verifiziert: `244,244,245` RGB im
  Button-Inneren, exakt `#F4F4F5`.
- **"Authenticator-App eingerichtet am …"-Datum**: kein erfundener Wert –
  `twoFactorEnabledAt` wird direkt aus der DB gerendert und ist bei
  Accounts, deren 2FA-Einrichtung vor Einführung dieses Felds lag (z.B.
  `admin@pivot.dev`), schlicht `NULL`; die UI zeigt in diesem Fall den
  Satz ohne Datumszusatz (`{enabledAt && " am ..."}`). Für jede
  Neueinrichtung ab jetzt wird das echte Datum korrekt gesetzt und
  angezeigt (verifiziert per Playwright-Testlauf: frisch eingerichteter
  Account zeigt sofort das reale Tagesdatum).

**Fünfter Nachtrag (2026-08-17): "Zwei-Faktor-Authentifizierung
deaktivieren" an "Alle anderen Sitzungen beenden" angeglichen.** War
bisher ein reiner Text-Link (`text-sm text-muted-foreground
underline-offset-4 hover:text-destructive hover:underline`) unterhalb von
"Neue Codes generieren". Auf denselben Button-Stil umgestellt wie der
Sitzungen-Beenden-Button (siehe
knowledge-base/auth/self-service-auth-flows.md, Nachtrag 2026-08-17):
`Button variant="outline" className="self-start rounded-xl
border-[#E5E5E5] text-destructive hover:bg-destructive/5
hover:text-destructive"`. Grund: beide sind destruktive
Sicherheits-Aktionen auf derselben Seite (Mein Konto → Sicherheit) und
sollen optisch gleich gewichtet sein statt einer als Button, dem anderen
als beiläufiger Textlink.

**Sechster Nachtrag (2026-08-17): Höhe an "Neue Codes generieren"
angeglichen.** Die `Button`-Komponente (auch mit `variant="outline"`)
bringt ihr Standard-Padding (`py-3.5 px-5`) mit und rendert dadurch
spürbar höher als der direkt darüber liegende `<button>` mit `px-3 py-2
text-[12.5px]`. Sowohl "Zwei-Faktor-Authentifizierung deaktivieren" als
auch "Alle anderen Sitzungen beenden" (in `my-account-view.tsx` und
`user-edit-view.tsx`) von `Button variant="outline"` auf ein reines
`<button>` mit identischem Padding/Schriftgröße umgestellt (`rounded-xl
border border-[#E5E5E5] bg-transparent px-3 py-2 text-[12.5px]
font-medium text-destructive hover:bg-destructive/5`) – jetzt exakt
gleiche Höhe wie "Neue Codes generieren", nur mit rotem statt grauem
Text/Rahmen.
