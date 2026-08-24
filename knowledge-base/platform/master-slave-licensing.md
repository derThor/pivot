# Master/Slave-Lizenzsystem (Websites-Verwaltung)

**Datum:** 2026-08-24 (Master-seitige Umsetzung abgeschlossen, Slave-Phase
noch offen – siehe "Update 2026-08-24" unten)
**Betroffene Bereiche:** apps/api (neues `websites`/`license`-Modul),
apps/web (`/dashboard/settings/websites`), packages/database (Schema),
Deployment/Betrieb (neuer `DEPLOYMENT_MODE`-Umgebungsschalter)

## Kontext

Das Pivot-CMS soll künftig an mehrere Kunden ausgeliefert werden (erste
Installation: **strasev**, Ordner `C:\git\strasev` – ein reiner Checkout
desselben Repos, siehe unten). Damit eine nicht bezahlte/gekündigte
Installation abgeschaltet werden kann, bekommt eine **Master-Instanz** (die
aktuelle Codebase unter `C:\git\pivot`) eine zentrale Verwaltung aller
**Slave-Installationen**. Jede Slave-Installation prüft periodisch bei der
Master-Instanz, ob sie noch aktiv sein darf.

Zentrale Anforderung des Nutzers: **manipulationssicher**, aber gleichzeitig
darf ein vorübergehend nicht erreichbarer Master **niemals** dazu führen,
dass eine Slave-Installation fälschlich in den Wartungsmodus geht.

## Architektur-Entscheidungen (Stand 2026-08-24)

- **Ein Repo, Modus-Flag** statt zwei getrennter Codebases. Neuer
  Umgebungsschalter `DEPLOYMENT_MODE=master|slave`. Im Master-Modus ist die
  Websites-Verwaltung (Backend-Endpunkte + `/dashboard/settings/websites`)
  aktiv, im Slave-Modus stattdessen der Lizenz-Client (wöchentlicher Abruf +
  lokale Durchsetzung). Beide Modi laufen mit demselben Code, nur
  unterschiedlich konfiguriert.
- **Pull statt Push**: die Slave-Installation ruft wöchentlich selbst beim
  Master ab (`GET /license/check` o.ä.), nicht umgekehrt. Grund: Push würde
  verlangen, dass der Master jede Kunden-Domain erreichen kann (Firewall,
  dynamische IP, Wartungsfenster) – das ist außerhalb unserer Kontrolle.
  Pull braucht nur einen ausgehenden HTTPS-Request von der Slave-Seite, das
  funktioniert praktisch überall, und die Slave-Seite steuert ihr eigenes
  Retry-/Backoff-Verhalten.
- **strasev** ist bereits als reiner Git-Checkout unter `C:\git\strasev`
  angelegt (`git clone` desselben Repos/`origin`, kein eigener Remote).
  Noch NICHT eingerichtet: `.env` (inkl. `DEPLOYMENT_MODE=slave`), eigene
  Datenbank, eigener Port, `pnpm install`. Folgt erst nach der Code-Basis
  (Nutzervorgabe: "immer erst fragen", siehe Ablaufplan unten).

## Token-Design

Signiertes, zeitlich begrenztes Token, vom Master ausgestellt, von der
Slave-Installation lokal verifiziert:

```json
{
  "domain": "strasev.de",
  "siteId": "cuid...",
  "status": "live" | "locked",
  "issuedAt": 1735000000,
  "expiresAt": 1736200000,
  "seq": 42
}
```

- **Asymmetrische Signatur (Ed25519)**, kein gemeinsames Geheimnis. Der
  Master signiert mit einem privaten Schlüssel; jede Slave-Installation
  bekommt bei der Erstverbindung nur den öffentlichen Schlüssel. Ein
  gemeinsames Secret in beiden Apps wäre der Knackpunkt: Serverzugriff auf
  eine Slave-Installation würde sonst reichen, um selbst "aktiv"-Tokens zu
  fälschen.
- **Domain-Bindung** (`domain`-Feld): verhindert, dass das Token einer
  aktiven Installation auf eine gesperrte kopiert wird.
- **Monotoner Zähler (`seq`)**: verhindert Replay/Rollback – eine Slave-
  Installation lehnt jedes Token mit `seq` ≤ dem zuletzt akzeptierten Wert
  ab, damit ein wiederhergestelltes altes "aktiv"-Token (z.B. aus einem
  Backup) eine später ausgesprochene Sperre nicht aushebeln kann.
- **Ablage**: Token gehört in die Datenbank der Slave-Installation, nicht
  in eine Datei. Die Durchsetzung darf sich nie auf ein einfaches
  `isActive`-Boolean verlassen, sondern muss bei jeder relevanten Prüfung
  Signatur + Ablaufdatum + Domain erneut verifizieren – sonst reicht ein
  DB-Zugriff, um die Sperre zu umgehen.

## Token-Laufzeit & Ausfalltoleranz (bestätigt, 2026-08-24)

- **14 Tage Gültigkeit** pro Token bei wöchentlichem Abruf → 1–2 verpasste
  Zyklen Puffer, bevor überhaupt ein Risiko besteht.
- Läuft das zuletzt gültige Token ab **und** gelingt kein neuer Abruf, geht
  die Slave-Installation NICHT sofort in den Wartungsmodus, sondern zeigt
  zunächst nur eine sichtbare Warnung ("Lizenzprüfung ausstehend"). Erst
  nach einer weiteren Karenzzeit (Vorschlag: +7 Tage) ohne erfolgreichen
  Abruf greift die echte Sperre.
- **Uhrzeit-Manipulation**: die Slave-Installation speichert zusätzlich den
  Zeitpunkt der letzten erfolgreich verifizierten Prüfung. Springt die
  Systemzeit spürbar zurück, darf das nicht automatisch mehr Vertrauen
  schaffen (kein "Ablaufdatum liegt jetzt wieder in der Zukunft" nach einer
  Zeitreise rückwärts) – vollständig lösen lässt sich das ohne externe
  Zeitquelle nicht, aber so wird es zumindest erschwert.

## Status-Werte & Durchsetzung (bestätigt, 2026-08-24)

Drei Status in der Websites-Verwaltung: **Live**, **Entwicklung**,
**Gesperrt**.

- **Live**: normale Lizenzprüfung greift, Token-Status `"live"`.
- **Gesperrt**: Token-Status `"locked"` → echter Wartungsmodus (siehe
  unten).
- **Entwicklung**: von der Lizenzprüfung komplett ausgenommen (keine
  Sperre möglich, unabhängig von Master-Erreichbarkeit) – **aber** die
  Slave-Installation zeigt dafür einen präsenten, gut sichtbaren Hinweis im
  Dashboard (z.B. Banner "Entwicklungsinstanz – ungeprüft"), damit niemand
  eine Entwicklungsinstanz versehentlich für produktiv/lizenziert hält.

## Wartungsmodus

- Betrifft nur den Status **Gesperrt**.
- Öffentliche Seite liefert eine Wartungsseite statt Content; API blockt
  bis auf einen minimalen Health-/Lizenz-Endpunkt.
- **Wartungsseite ist konfigurierbar** (bestätigt, 2026-08-24) – Text/
  Branding lokal in der Slave-Installation editierbar (vermutlich analog
  `AppSettings`, da diese Konfiguration pro Installation individuell ist,
  nicht vom Master vorgegeben wird).

## Master: Datenmodell (Entwurf, noch nicht implementiert)

```prisma
model Website {
  id                    String    @id @default(cuid())
  name                  String
  domain                String    @unique
  status                String    @default("development") // live | development | locked
  publicKeyFingerprint  String
  lastCheckInAt         DateTime?
  lastSeq               Int       @default(0)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

## Master-UI: eigene Seite `/dashboard/websites`

Ursprünglich als Abschnitt unter Einstellungen geplant, dann umgebaut auf
eine eigene Seite (siehe "Update 2026-08-24: Umbau auf eigene Seite" unten)
– Sidebar-Gruppe "Administration" (nur Master), Menüpunkt "Webseite".
Kacheln liegen direkt auf dem Seitenhintergrund (kein umschließender
Card-Kasten), pro Kachel nur:

- Domain + Status-Badge (Live/Entwicklung/Gesperrt)
- **Bearbeiten** (Name/Domain/Status – Statusänderung läuft ausschließlich
  über diesen Dialog, nicht mehr inline auf der Kachel)

## Registrierungsablauf für eine neue Slave-Installation

1. Im Master unter Websites eine neue Site anlegen → Master stellt einmalig
   seinen öffentlichen Signier-Schlüssel + eine Site-ID/API-Key bereit.
2. Diese Werte werden außerhalb der App (Umgebungsvariablen beim Deployment
   der Slave-Instanz) hinterlegt – bewusst kein automatisierter Kanal dafür,
   sonst wäre genau dieser Kanal der Angriffspunkt.
3. Ab dann läuft der wöchentliche Pull-Abruf automatisch.

## Sicherheits-Realitätscheck (bestätigt, 2026-08-24)

Wichtige, bewusste Erwartungshaltung, bevor die Slave-Seite gebaut wird:
Eine rein lokal (auf der Slave-Installation) laufende Lizenzprüfung kann
**grundsätzlich niemals hart unumgehbar** sein – egal wie sie implementiert
ist (auch nicht durch Verschlüsselung des Prüfcodes selbst). Wer die
Slave-Installation vollständig kontrolliert (Server-/Dateizugriff, was bei
Self-Hosting immer der Fall ist), kann den Prüfcode entfernen/patchen, den
Netzwerkaufruf abfangen und eine gefälschte "gültig"-Antwort zurückgeben,
oder einfach `DEPLOYMENT_MODE`/den entschlüsselten Code zur Laufzeit aus
dem Speicher extrahieren. Das ist keine Design-Lücke dieses Projekts,
sondern eine grundsätzliche Grenze jeder self-hosted Software mit lokaler
Lizenzprüfung (gilt genauso für WordPress-Plugins, andere selbstgehostete
SaaS-Forks, klassisches Software-DRM).

**Konsequenz für dieses Projekt** (Nutzerentscheidung, 2026-08-24):
Das gesamte Lizenzsystem wird bewusst als **weiche Prüfung** gebaut – eine
Abschreckung gegen versehentliche/nachlässige Weiternutzung nach
Zahlungsausfall, **kein** Schutz gegen einen vorsätzlichen, technisch
versierten Umgehungsversuch. Rechtlicher/vertraglicher Schutz bleibt der
eigentliche Rückhalt gegen absichtliche Umgehung, nicht der Code. Diese
Erwartungshaltung gilt für die gesamte Slave-seitige Umsetzung (Lizenz-
Client, Wartungsmodus-Durchsetzung) – keine Überinvestition in
Verschleierung/Anti-Debugging o.ä. anstreben, das wäre Aufwand ohne echten
Sicherheitsgewinn.

## Offene Punkte (noch nicht entschieden)

- Exakte Formulierung/Platzierung des "Lizenzprüfung ausstehend"-Hinweises
  während der Karenzzeit.
- Ob der wöchentliche Abruf über das bestehende `ScheduledJob`-System läuft
  oder ein eigener, einfacherer Cron-Mechanismus in der Slave-Installation
  reicht.
- Wie der öffentliche Schlüssel bei einer Schlüsselrotation des Masters neu
  an bestehende Slave-Installationen verteilt wird (aktuell nur für die
  Erstregistrierung bedacht).

## Ablaufplan (Nutzervorgabe, 2026-08-24: "immer erst fragen")

1. ✅ Diesen Plan dokumentieren (dieser Eintrag + `docs/ROADMAP.md`).
2. ✅ Code-Umsetzung im Master (Datenmodell, Token-Ausstellung,
   Websites-UI) – siehe "Update 2026-08-24" unten.
3. Code-Umsetzung im Slave-Modus (Modus-Flag, Lizenz-Client, Wartungsmodus,
   Entwicklungs-Hinweisbanner) – **vor Beginn Rückfrage/Abstimmung**.
4. Erst danach: strasev-Installation technisch lauffähig machen (`.env`,
   eigene Datenbank, eigener Port, `pnpm install`).

## Update 2026-08-24: Master-seitige Umsetzung

- **Datenmodell**: `Website` in `schema.prisma` (`id`, `name`, `domain`
  unique, `status` live/development/locked, `apiKeyHash`, `lastSeq`,
  `lastCheckInAt`). Kein `publicKeyFingerprint`-Feld (aus dem
  ursprünglichen Entwurf) – solange es nur einen aktiven Master-Signier-
  schlüssel gibt, wäre der Wert überall identisch; wird ergänzt, sobald
  Schlüsselrotation tatsächlich gebaut wird (siehe "Offene Punkte").
- **`apps/api/src/websites/`** (neues Modul):
  - `license-token.util.ts`: Ed25519-Signierung/-Verifikation ohne externe
    Library, reines `node:crypto` (`createPrivateKey`/`createPublicKey`/
    `sign`/`verify`), eigenes kompaktes Token-Format
    `base64url(payload).base64url(signature)` (kein Standard-JWT, da wir
    weder Header-Feld noch Alg-Verhandlung brauchen). `verifyLicenseToken()`
    liegt schon hier (für die Slave-Phase), wird vom Master-Code noch nicht
    aufgerufen.
  - `websites.service.ts`: CRUD + `checkLicense()`. API-Key wird mit
    `argon2.hash()` gespeichert (gleiche Library wie Passwort-Hashing),
    Klartext nur bei `create()`/`regenerateApiKey()` einmalig zurückgegeben
    (nie wieder abrufbar). `checkLicense()` liefert für "Domain unbekannt"
    UND "falscher Key" denselben generischen 401 (verhindert Domain-
    Enumeration über den öffentlichen Endpunkt).
  - `websites.controller.ts`: Admin-CRUD, `@RequirePermission('settings:
    read'|'settings:update')` – bewusst keine neue Rechte-Ressource
    (Pivot ist ohnehin exklusiv über `settings:*`, siehe
    [[project_pivot_role_and_scoped_permissions]]).
  - `license.controller.ts`: `POST /license/check`, `@Public()` (kein JWT-
    Login), Auth über `Authorization: Bearer <site-api-key>` + `domain` im
    Body. Rate-Limiting läuft über den bereits app-weiten `ThrottlerGuard`,
    kein zusätzlicher Schutz nötig.
- **Env**: `DEPLOYMENT_MODE` (Zod-Enum `master`/`slave`, Default `master`)
  und `LICENSE_SIGNING_PRIVATE_KEY` (Base64-PKCS8-DER, nur im Master-Modus
  gesetzt) in `env.validation.ts` + `.env.example` ergänzt, echter Schlüssel
  in `apps/api/.env` generiert.
- **Frontend**: neuer Abschnitt "Websites" in `settings-form.tsx`
  (`websites-settings-card.tsx` + `website-dialog.tsx`), Karten-Grid mit
  Status-Badge (grün/grau/rot für live/development/locked), "Bearbeiten"
  öffnet denselben Dialog wie "Website verbinden". Nach dem Anlegen zeigt
  der Dialog einmalig API-Key + öffentlichen Master-Schlüssel mit Kopieren-
  Buttons (Muster aus `preview-links-dialog.tsx`), danach nie wieder
  abrufbar. Statusänderung über `SegmentedPicker` (App-Standard für feste
  Options-Auswahl) direkt auf der Karte, keine eigene Bestätigung nötig.
  Formular-Validierung folgt der App-Konvention: Feldfehler
  (`nameError`/`domainError`) direkt unter dem jeweiligen Input,
  `submitError` für Server-/Konfliktfehler unten im Formular (siehe
  `gallery-dialog.tsx`).
- **Live verifiziert** (curl gegen den laufenden Master):
  Website anlegen → API-Key erhalten; `/license/check` mit korrektem Key
  liefert ein Token; mit falschem Key/unbekannter Domain je 401; Token-
  Signatur gegen den öffentlichen Schlüssel erfolgreich geprüft, ein
  manipuliertes Payload-Byte lässt die Prüfung fehlschlagen; zweiter
  `/license/check`-Aufruf erhöht `seq` korrekt (1→2); Statuswechsel per
  PATCH; 400 bei ungültigem Status; 409 bei Domain-Konflikt; 403 ohne
  `settings:read`. Testdaten danach gelöscht.
- **Nicht verifiziert**: echte Browser-Ansicht der neuen Websites-Karten
  (kein Playwright/Chromium, kein Login-Cookie für einen echten Nutzer
  verfügbar in dieser Umgebung – nur Typecheck/Lint/SSR-Statuscode
  geprüft).

## Update 2026-08-24: Umbau auf eigene Seite + Sidebar-Gruppe "Administration"

Nutzervorgabe nach Sichtung des ersten Entwurfs: nicht mehr als Abschnitt
unter Einstellungen, sondern eigene Seite mit eigenem Sidebar-Eintrag –
und Statusänderung nur noch über den Bearbeiten-Dialog, nicht mehr inline
auf der Kachel.

- **`GET /auth/me` liefert jetzt `deploymentMode`** (aus
  `process.env.DEPLOYMENT_MODE`) – steuert im Frontend, ob die neue
  Sidebar-Gruppe "Administration" überhaupt gerendert wird. Eine Slave-
  Installation sieht diesen Bereich gar nicht erst.
- **Neue Sidebar-Gruppe "Administration"** (`app-sidebar.tsx`, über der
  bestehenden "Webseite"-Inhalts-Gruppe einsortiert) mit Menüpunkt
  **"Webseite"** (→ `/dashboard/websites`, `permission: "settings:read"`)
  und Unterpunkt **"Module"** (→ `/dashboard/modules`, Platzhalter für
  künftige branchenspezifische Erweiterungen wie Fitnessstudio,
  Datenschutz – noch kein Datenmodell/Backend dahinter, ehrliche
  Platzhalter-Seite ohne erfundenen Inhalt).
- **`GET /websites` jetzt echt paginiert** (`QueryWebsiteDto`
  page/pageSize, `{items, meta}`-Antwort wie bei Webhooks/Formularen) –
  vorher unpaginiert, war für eine wachsende Liste von Kunden-
  Installationen nicht tragfähig.
- **`websites-settings-card.tsx` ersetzt durch `websites-view.tsx`**
  (Komponente + Datei umbenannt, da es jetzt eine ganze Seite statt eine
  Einstellungen-Karte ist) – Layout 1:1 nach `forms-view.tsx`: `<h1>` +
  `DashboardBreadcrumbs` links, "Website verbinden"-Button rechts, darunter
  Kacheln **direkt auf dem Seitenhintergrund** (kein umschließender
  `<Card>`-Kasten mehr – Nutzervorgabe: "haupt bg weiß weg machen"), unten
  `PaginationControls` mit `buildHref` (URL-getrieben wie bei Formularen,
  nicht clientseitig).
- **`website-dialog.tsx`**: Statusfeld (`SegmentedPicker` Live/Entwicklung/
  Gesperrt) nur im Bearbeiten-Modus sichtbar – beim Anlegen startet eine
  Website immer als "development" (Backend-Default), Statusänderung
  passiert danach ausschließlich über "Bearbeiten".
- **Live verifiziert**: Pagination (`page`/`pageSize`-Parameter,
  `meta.total`/`pageCount` korrekt bei 4 Einträgen über 2 Seiten à 2).
  Test-Einträge danach gelöscht, eine vom Nutzer selbst über die UI
  angelegte reale `strasev.de`-Website blieb unangetastet erhalten.
- **Kachel-Aktionen umsortiert**: "Bearbeiten" ist jetzt ein reines
  Stift-Icon oben neben dem Status-Badge (statt vollem Button unten), unten
  steht stattdessen **"Öffnen"** – öffnet `https://{domain}/login` in einem
  neuen Tab. Statusänderung bleibt weiterhin nur im Bearbeiten-Dialog.

## Update 2026-08-24: Master/Client-Badge in der Sidebar

Nutzervorgabe: visuell erkennbar machen, ob die aktuell offene Installation
Master oder Slave ist – **"Slave" heißt in der UI bewusst "Client"** (nicht
das Wort "Slave" verwenden). Badge sitzt unter dem Logo im
`SidebarHeader` (`app-sidebar.tsx`):

- **Ausgeklappt**: volle Pille mit Text "Master" (`bg-primary/15
  text-primary`) oder "Client" (`bg-slate-200 text-slate-700`).
- **Eingeklappt** (icon-only, kein Platz für Text): nur ein farbiger Punkt
  (`bg-primary` bzw. `bg-slate-400`), Label erscheint als Tooltip beim
  Hovern (`side="right"`, `ui/tooltip.tsx`) – gleiches Umschalt-Verhalten
  wie beim Logo selbst (`group-data-[collapsible=icon]:hidden`/`:block`).
- Quelle ist dasselbe `isMaster` (aus `user.deploymentMode`), das schon die
  Sichtbarkeit der "Administration"-Sidebar-Gruppe steuert – keine
  zusätzliche Abfrage nötig.
- **Wichtig, siehe "Sicherheits-Realitätscheck" oben**: dieses Badge ist
  eine reine Anzeige, keine Sicherheitsgrenze – `deploymentMode` kommt
  unverändert aus der `DEPLOYMENT_MODE`-Env-Variable.

## Update 2026-08-24: Zwei Bugs + maskierte API-Key-Anzeige

- **Bugfix Bearbeiten-Dialog**: `website-dialog.tsx` initialisierte
  Name/Domain/Status nur per `useState(isEdit ? target... : ...)` – das
  greift nur beim allerersten Mount. Da der Dialog dauerhaft gemountet
  bleibt (nur `target` wechselt bei jedem Klick auf "Bearbeiten"), blieben
  die Felder nach dem ersten Öffnen leer/veraltet. Behoben mit
  Render-Zeit-Sync über einen `targetKey` (`null`/`"new"`/Website-Id,
  gleiches Muster wie `syncedRoleId` in `roles-explorer.tsx`).
- **Nutzerwunsch "bisherigen Key anzeigen" vs. bestehende Sicherheits-
  konvention**: Der App hat bereits eine etablierte Regel für Secrets
  (siehe SMTP-Passwort in `settings.service.ts`: selbst bei umkehrbarer
  Verschlüsselung wird nie der Klartext zurückgegeben, nur `hasPassword`).
  Vollen Klartext-Rückruf hätte diese Konvention gebrochen und wäre ein
  echter Sicherheits-Rückschritt gewesen (DB-Leak würde nutzbare Keys für
  alle Websites offenlegen). Nutzerentscheidung nach Rückfrage: **maskierte
  Anzeige**, kein Klartext-Rückschritt.
  - Neue Spalte `Website.apiKeyLastFour` (nullable) – nur die letzten 4
    Zeichen im Klartext, analog zu Stripe/GitHub-API-Key-Anzeigen. Aus 4
    von 64 Hex-Zeichen lässt sich der Key nicht rekonstruieren, kein
    relevanter Entropie-Verlust.
    Wird bei `create()` und `regenerateApiKey()` gesetzt
    (`apiKey.slice(-4)`), bleibt `null` für Installationen, deren Key vor
    dieser Spalte angelegt wurde (erst beim nächsten "Neu erzeugen"
    befüllt).
  - `WebsitesService`: neue `PUBLIC_SELECT`-Konstante (id/name/domain/
    status/apiKeyLastFour/lastCheckInAt/createdAt/updatedAt) statt
    dreifach dupliziertem `select` – `apiKeyHash` verlässt den Service nie.
  - `website-dialog.tsx`: zeigt im Bearbeiten-Modus standardmäßig
    `•••• •••• •••• {letzte4}` (oder einen Hinweistext bei `null`) über dem
    weiterhin vorhandenen "API-Key neu erzeugen"-Button.
  - Live verifiziert: Regenerieren des echten `strasev`-Keys setzt
    `apiKeyLastFour` korrekt auf die letzten 4 Zeichen des neuen Klartexts.

## Update 2026-08-24: Doch umkehrbare Verschlüsselung statt Hash + Sidebar-Badge-Feinschliff

**API-Key-Speicherung erneut geändert** (Nutzerentscheidung nach Rückfrage,
2026-08-24: "ich will mir den Key immer mit Icon anzeigen lassen") – löst
das direkt vorherige "nur maskiert"-Update wieder ab:

- `Website.apiKeyHash`/`apiKeyLastFour` → **`apiKeyEncrypted String?`**
  (AES-256-GCM, gleicher Helfer `common/utils/secret-encryption.ts` und
  gleicher app-weiter Schlüssel `TOTP_ENCRYPTION_KEY` wie beim
  SMTP-Passwort). Explizit dokumentierter Trade-off: ein DB-Leak legt
  jetzt nutzbare Keys für **alle** Websites offen, nicht nur neu
  angelegte – anders als beim vorherigen Hash-Ansatz. Bewusste
  Nutzerentscheidung, kein Versehen.
- Neuer Endpunkt `GET /websites/:id/api-key` (`settings:read`) –
  entschlüsselt und liefert den Klartext nur auf explizite Anfrage, nie
  Teil der normalen Listen-Antwort (`PUBLIC_SELECT` enthält
  `apiKeyEncrypted` nirgends).
- `checkLicense()` vergleicht jetzt per `timingSafeEqual` (konstante Zeit)
  statt `argon2.verify()` – Längen werden vorher geprüft, damit
  `timingSafeEqual` bei unterschiedlich langen Buffern nicht wirft.
- `website-dialog.tsx`: sowohl der frisch erzeugte Key (Anlegen/"Neu
  erzeugen") als auch der bestehende, gespeicherte Key sind jetzt über ein
  Augen-Icon abrufbar/maskierbar (`type="password"`/`"text"`-Toggle,
  bestehender Key wird erst bei Klick vom Server geladen, nicht beim
  Öffnen des Dialogs). "Neu erzeugen"-Button bleibt zusätzlich bestehen
  (Nutzervorgabe: "Button drin lassen").
- Live verifiziert: Regenerieren + anschließendes Abrufen liefert
  identischen Klartext zurück; `checkLicense()` funktioniert weiterhin
  korrekt mit dem neuen Vergleichsverfahren (gültiger Key → Token,
  falscher Key gleicher/unterschiedlicher Länge → je 401, kein Crash).

**Sidebar-Badge nachgeschärft**: `rounded-md` statt der Standard-
Pillenform der `Badge`-Komponente (Nutzervorgabe: "border-radius zu
groß"), jetzt oben rechts am Logo positioniert (`absolute -top-1 right-0`
im relativen Logo-Zeilen-Container) statt darunter links; eingeklappt ein
kleiner Punkt oben rechts direkt am Icon (eigener `relative`-Wrapper um
die Icon-Box, damit der Punkt trotz `overflow-hidden` des Bild-Containers
sichtbar bleibt).

**Abgelehnter Vorschlag**: verdecktes, vor dem Betreiber verborgenes
"Phone-Home"-Signal bei `DEPLOYMENT_MODE=master` auf einer eigentlich als
Slave vorgesehenen Installation – abgelehnt (Backdoor-Charakter trotz
guter Absicht, hält technisch ohnehin nicht geheim vor jemandem mit
Server-Zugriff, siehe "Sicherheits-Realitätscheck" oben). Offene,
dokumentierte Anomalie-Erkennung im regulären Lizenzsystem als
Alternative vorgeschlagen – siehe "WebsiteMonitorService" unten.

## Update 2026-08-24: Slave-seitige Umsetzung + Modus-Umschalter in Einstellungen

### Modus liegt jetzt in der Datenbank, nicht mehr in der Umgebungsvariable

Nutzervorgabe: "mach es so, dass der Pivot admin den Modus setzen kann,
unter Einstellungen" – `DEPLOYMENT_MODE` als Env-Var entfällt komplett,
ersetzt durch `AppSettings.deploymentMode` (`"master"` | `"slave"`,
Default `"master"`). Editierbar unter Einstellungen → Integrationen
("Bereitstellungsmodus"-Karte, `deployment-mode-card.tsx`) über die
bestehende generische `PATCH /settings`-Route – kein neuer Endpunkt
nötig. `AuthService.getDeploymentMode()` liest ihn für `/auth/me`
(vorher `process.env.DEPLOYMENT_MODE`).

**Sicherheitsfrage dazu** (Nutzer: "stelle sicher, dass ein illegal
gesetzter Master nicht Zugriff auf meine Projekte bekommt"): Ein Kunde,
der seine eigene (Slave-)Installation lokal auf "Master" umstellt, bekommt
dadurch **keinen** Zugriff auf fremde Daten – jede Installation hat eine
komplett isolierte Datenbank, und `LICENSE_SIGNING_PRIVATE_KEY` (der
einzige Weg, gültige Tokens auszustellen) liegt ausschließlich in der
Umgebungsvariable des echten Masters, wird nie an Kunden verteilt und
lässt sich über die UI nicht setzen. Zur Verteidigungstiefe zusätzlich:
**`MasterOnlyGuard`** (`websites/master-only.guard.ts`) sperrt
`WebsitesController` und `LicenseController` hart auf API-Ebene (404
statt 403 – die Endpunkte wirken auf einer Client-Installation, als
existierten sie nicht), sobald `deploymentMode !== "master"` ist. Live
verifiziert: Modus auf "slave" umgestellt → `GET /websites` und
`POST /license/check` beide 404, `GET /license/state` weiterhin korrekt
`{mode:"slave", status:"unchecked"}`.

### `LicenseClientService` (`apps/api/src/license-client/`)

Pull-Client: `@Cron(CronExpression.EVERY_WEEK)` + Sofort-Check über
`onModuleInit()`, falls noch nie erfolgreich geprüft (frische
Installation wartet nicht eine volle Woche auf die erste Prüfung). Nur
aktiv, wenn `deploymentMode === "slave"` (sonst überall früher Return –
komplett inert auf einem Master).

- Env-Vars (weiterhin Umgebungsvariablen, nicht Einstellungen – Zugangs-
  daten gehören nicht in eine web-editierbare Form): `LICENSE_MASTER_URL`,
  `LICENSE_SITE_DOMAIN`, `LICENSE_API_KEY`, `LICENSE_MASTER_PUBLIC_KEY`.
  In `env.validation.ts` bewusst nicht mehr per `.superRefine()` erzwungen
  (der Modus ist beim Env-Validierungszeitpunkt noch nicht aus der DB
  bekannt) – fehlen sie, loggt `performCheck()` einen Fehler und bricht
  sauber ab, statt die App am Start zu blockieren.
- Signaturprüfung über das bereits vorhandene `verifyLicenseToken()`
  (aus `websites/license-token.util.ts`, war seit dessen Erstellung schon
  für diesen Zweck vorbereitet, aber noch nie aufgerufen worden).
- Replay-Schutz: neues Token wird nur übernommen, wenn `payload.seq` >
  gespeicherter `LicenseState.seq` ist.
- Domain-Bindung: `payload.domain` muss exakt `LICENSE_SITE_DOMAIN`
  entsprechen, sonst wird das Token verworfen.
- **Uhrzeit-Manipulationsschutz**: `LicenseState.lastObservedAt` hält den
  höchsten je gesehenen Zeitpunkt fest (aktualisiert bei jedem Check,
  auch fehlgeschlagenen). Springt die Systemzeit spürbar zurück (> 5 Min
  Toleranz für legitimen NTP-Drift), rechnet `getEffectiveStatus()` mit
  `lastObservedAt` statt der aktuellen (möglicherweise manipulierten)
  Zeit weiter.
- **Karenzzeit-Logik** (`getEffectiveStatus()`): `"live"` wenn nicht
  abgelaufen; `"pending"` (samt `expiresAt`) wenn abgelaufen, aber
  innerhalb der 7-Tage-Karenz seit Ablauf; erst danach `"locked"`.
  `"unchecked"` für eine frische Installation ohne je erfolgreich
  geprüftes Token (nicht sofort sperren, siehe Ausfalltoleranz-Vorgabe).

### `LicenseEnforcementGuard` + `GET /license/state`

Globaler `APP_GUARD`: auf einem Master immer inaktiv (`getEffectiveStatus()`
liefert dort `{mode:"master"}`). Auf einem Client blockt er bei "locked"
jeden Request mit 503 – außer den in `ALLOWED_SUFFIXES` gelisteten
`/health` und `/license/state` (Pfad-Suffix-Vergleich statt exaktem Pfad,
da NestJS' URI-Versionierung den `/v1`-Präfix voranstellt).
`GET /license/state` ist bewusst öffentlich (`@Public()`, kein
`MasterOnlyGuard`) und bleibt selbst bei Sperre erreichbar – sonst könnte
sich eine gesperrte Installation nie mehr selbst erklären. Liefert bei
`status:"locked"` zusätzlich `maintenanceTitle`/`maintenanceMessage`
direkt mit (aus `AppSettings`), damit die Wartungsseite ihren Inhalt
nicht über einen zweiten, vom Guard blockierten Aufruf (`/settings/public`)
holen muss.

### Wartungsseite (`apps/web/src/app/locked/page.tsx`)

`middleware.ts` prüft vor jeder Anfrage an `/dashboard/*`, `/login`,
`/register` per `isInstanceLocked()` (30s In-Memory-Cache, um nicht bei
jedem einzelnen Request die API zu befragen) den Lizenzstatus und
rewritet bei Sperre auf `/locked` – URL bleibt für den Besucher
unverändert. Titel/Text kommen aus `AppSettings.maintenancePageTitle`/
`maintenancePageMessage` (Nutzervorgabe: "Wartungsseite konfigurierbar",
editierbar in derselben "Bereitstellungsmodus"-Karte, nur sichtbar wenn
"Client" gewählt ist), mit eingebautem Standardtext als Fallback. Trägt
ein `<meta name="pivot-maintenance" content="true">` als Marker für die
Master-Überwachung (siehe unten).

**Wichtiger Scope-Hinweis**: Der ursprüngliche Plan sprach von einer
"öffentlichen Seite" für normale Website-Besucher – das Frontend
(`apps/web`) hat aber aktuell **keine** öffentliche Content-Auslieferung
für Endbesucher (kein `[...slug]`-Catch-all o.ä., siehe Roadmap Phase 4
"Content Delivery API"/"Preview API", beide noch `[ ]`). `apps/web` ist
bislang nur das Dashboard + Auth-Seiten. Die Wartungsseite deckt daher
aktuell genau das ab, was heute existiert (Dashboard + Login/Register)
– sobald ein öffentliches Content-Frontend gebaut wird, muss dessen
Routing ebenfalls an die Middleware-Prüfung angebunden werden.

### Entwicklungs-/Karenzzeit-Hinweisbanner (`dashboard/layout.tsx`)

Bei `deploymentMode === "slave"` wird `getLicenseState()` geladen und je
nach Status ein `SystemMessage`-Banner (`variant="warning"`) app-weit über
allen Dashboard-Seiten angezeigt: `"development"` → "Entwicklungsinstanz –
ungeprüft"; `"unchecked"`/`"pending"` → "Lizenzprüfung ausstehend". Bei
`"locked"` erscheint hier nie ein Banner, da der Guard das Dashboard dann
bereits komplett blockt (Wartungsseite greift vorher).

### `WebsiteMonitorService` (Master-seitig, `apps/websites/`)

Nutzervorgabe: "baue einen Test ein, der regelmäßig testet, ob eine Seite
live ist. wenn gesperrt, dennoch live, dass ich in Master gewarnt werde"
– bewusst ein ganz normaler, öffentlicher `fetch("https://{domain}/")`
gegen die Website selbst (kein verdecktes Signal von der Slave-
Installation, siehe abgelehnter Vorschlag oben). `@Cron(EVERY_30_MINUTES)`
prüft alle `Website`-Zeilen mit `status:"locked"`; antwortet die Seite mit
2xx **ohne** das `pivot-maintenance`-Meta-Tag im Body, gilt das als
Anomalie (`Website.lastLiveCheckAnomaly = true`) – die Sperre wird dort
offenbar nicht durchgesetzt. Ein fehlgeschlagener/nicht erreichbarer
Aufruf ist dagegen unauffällig (genau das erwarten wir von einer korrekt
durchgesetzten Sperre).

Die eigentliche Benachrichtigung entsteht **nicht** direkt im Monitor,
sondern über den bestehenden `NotificationsService.buildCandidates()`-
Mechanismus (gleiches Muster wie "Webhook schlägt fehl"): neuer Kandidat
`website-anomaly:{id}`, gesteuert über den neuen Schalter
`notifyWebsiteAnomaly` (Default an, aktuell ohne eigene UI zum
Deaktivieren – wie die anderen `notify*`-Schalter aufgebaut, könnte bei
Bedarf in `notification-settings-card.tsx` ergänzt werden).

### Live verifiziert (2026-08-24)

- Modus-Umschaltung wirkt sofort auf `MasterOnlyGuard` (404) und
  `/license/state` (`{mode:"master"}` ↔ `{mode:"slave",...}`).
- `/auth/me.deploymentMode` kommt korrekt aus der DB statt Env.
- Simulierter "locked"-Zustand (direkt per Prisma gesetzt, da ein echter
  zweiter Slave-Server für einen vollständigen Cross-Instanz-Test noch
  nicht existiert): `/health` bleibt erreichbar (200), `/auth/me` wird
  blockiert (503), `GET /dashboard` liefert die Wartungsseite inkl.
  korrektem Meta-Tag-Marker und sowohl mit konfiguriertem Text als auch
  mit dem eingebauten Standardtext. Zustand danach vollständig
  zurückgesetzt.
- **Nicht verifiziert**: `LicenseClientService.performCheck()` gegen eine
  echte zweite, separat laufende Slave-Installation (folgt organisch bei
  der strasev-Einrichtung); `WebsiteMonitorService`s echter HTTPS-Abruf
  gegen eine reale Domain (bewusst keine unbeteiligte externe Seite ohne
  klaren Zweck angefragt).

## Update 2026-08-24: Eigener Einstellungen-Reiter "Master-Client"

Nutzervorgabe nach einer Mockup-Vorlage: eigener Sidebar-Punkt unter
Einstellungen (`master-client-card.tsx`, Icon `ShieldCheck`, zwischen
"Benachrichtigungen" und "Jobs"), der die unter Administration → Webseite
verwalteten Websites als "Mandanten"-Liste automatisch mit anzeigt, plus
einen "Prüfen"-Button.

**Bewusst NICHT aus dem Mockup übernommen** (Nutzervorgabe: "was wird
vorgegeben soll weg"):
- Erfundene Kennzahlen pro Mandant ("24 Nutzer · 42 Seiten") – der Master
  hat auf die Datenbank einer Slave-Installation keinen Einblick, diese
  Zahlen gäbe es nicht wirklich.
- Die "Quelle"/"aktuell"/"abweichend"-Sync-Status-Spalte und die komplette
  "Abgleich"-Karte (täglicher Job, "Abweichungen erlauben"-Schalter,
  "Vor dem Überschreiben benachrichtigen", "Vorgaben an alle verteilen").
  Das hätte eine **Einstellungs-Weiterverteilung vom Master an alle
  Clients** bedeutet – ein komplett neues, deutlich größeres Feature
  (Push von beliebiger Konfiguration statt nur des Lizenzstatus), das wir
  nie geplant hatten und das dem bewusst gewählten Pull-Modell
  widerspricht. Das System verteilt weiterhin ausschließlich den
  Lizenzstatus (live/development/locked), keine sonstigen Einstellungen.

**Was tatsächlich gebaut wurde:**
- `MasterClientCard`: erste Zeile immer "Diese Installation" mit Master-
  (gelb) bzw. Client-Badge (grau) je nach `AppSettings.deploymentMode`;
  danach alle echten `Website`-Zeilen (aus `getWebsites()`) mit Domain,
  "Zuletzt geprüft"-Zeit und Status-Badge (Live/Entwicklung/Gesperrt).
  Klick auf einen Mandanten öffnet denselben `WebsiteDialog` wie auf
  `/dashboard/websites` (dort auch Master/Client-naheliegend – der
  Dialog selbst kennt aber nur den Live/Entwicklung/Gesperrt-Status
  einer verwalteten Website, nicht "Master/Client", da nur die eigene
  Installation Master oder Client sein kann, nicht eine verwaltete
  Website).
- **"Prüfen"-Button**: neuer Endpunkt `POST /websites/check-now`
  (`settings:update`, hinter `MasterOnlyGuard`) – löst
  `WebsiteMonitorService.checkLockedWebsites()` sofort aus, statt auf den
  nächsten 30-Minuten-Cron-Lauf zu warten. Live getestet, liefert
  `{checkedAt: <ISO-Zeitstempel>}`.
- Der bestehende Mode-Umschalter + Wartungsseiten-Editor (`deployment-
  mode-card.tsx`) zog aus "Integrationen" hierher um (thematisch
  passender), unverändert in seiner Funktion.

## Update 2026-08-24: Mandanten-Liste rein informativ statt bearbeitbar

Nutzer-Korrektur: "unter Einstellungen soll nur Master oder Client
eingestellt werden, nichts anderes, sonst haben wir das ja doppelt" –
gefolgt von einem erneuten Verweis auf die Bildvorlage mit "soll das so
aussehen ... grauer Hintergrund". Beides zusammen gelesen: die
Mandanten-**Liste** soll unter Einstellungen weiterhin sichtbar sein
(automatischer Überblick), aber **nicht** als zweite Bearbeiten-Oberfläche
– Bearbeiten/Prüfen bleibt ausschließlich auf `/dashboard/websites`, hier
nur Anzeige. Die einzige tatsächlich unter Einstellungen → Master-Client
änderbare Einstellung ist der eigene Modus (`DeploymentModeCard`).

- `MasterClientCard` umgebaut: Zeilen sind nicht mehr klickbar (kein
  `WebsiteDialog`, kein `WebsiteDialog`-Import mehr), kein "Prüfen"-Button
  mehr hier.
- Optik geändert: ein durchgehender `bg-[#F4F4F5]`-Container mit
  `divide-y`-Trennlinien zwischen den Zeilen statt einzelner weißer
  Kacheln mit Rand – 1:1 nach der erneut gezeigten Bildvorlage
  ("grauer Hintergrund").
- **"Prüfen"-Button umgezogen** auf `/dashboard/websites`
  (`websites-view.tsx`, neben "Website verbinden") – ruft weiterhin
  `POST /websites/check-now` auf. Das ist jetzt die einzige Stelle, an der
  manuell geprüft/bearbeitet wird; Einstellungen zeigt nur noch an.

## Update 2026-08-24: Zeilen wieder klickbar, als Popup statt Karte

Nutzer-Korrektur (erneuter Verweis auf die Bildvorlage): "Bearbeiten
Button, weiter Button weg. Dann soll ein Popup kommen, wo ich das von
Client zu Master und andersrum stellen kann. Das darf alles nur auf dem
Master erlaubt sein. Dieses System genauso behandeln. Unten
Bereitstellungsmodus raus." Löst die vorherige rein-informative Fassung
wieder ab – diesmal nicht als dauerhaft sichtbare Karte, sondern als
Popup, das durch Klick auf die Zeile selbst geöffnet wird (kein
separater Button mehr):

- `deployment-mode-card.tsx` (dauerhaft sichtbare Karte am Seitenende)
  gelöscht; ihr Inhalt (Master/Client-`SegmentedPicker` + die beiden
  Wartungsseiten-Felder, nur bei Modus "Client" sichtbar) lebt jetzt in
  `deployment-mode-dialog.tsx`, einem `Dialog` mit `open`/`onOpenChange`-
  Props nach demselben Render-Zeit-Sync-Muster wie `website-dialog.tsx`.
- `master-client-card.tsx` erneut umgebaut: die Selbst-Zeile ("Diese
  Installation") und jede Mandanten-Zeile sind wieder klickbare
  `<button>`-Elemente (kein separater "Bearbeiten"-Button daneben).
  Klick auf die Selbst-Zeile öffnet `DeploymentModeDialog`, Klick auf
  eine Mandanten-Zeile öffnet den bestehenden `WebsiteDialog` (gleiche
  Komponente wie auf `/dashboard/websites`) – **kein** eigener "Master/
  Client"-Umschalter für Mandanten-Zeilen, weil ein entfernter
  `Website`-Datensatz gar kein `deploymentMode`-Feld hat (nur `status`)
  und der Master ohnehin keinen Push-Mechanismus hat, um den Modus einer
  entfernten Installation zu setzen – "dieses System genauso behandeln"
  wurde als *gleiche Interaktion* (Zeile anklicken → Popup), nicht als
  *gleicher Inhalt* umgesetzt.
- **Nur auf dem Master klickbar**: `disabled={!isMaster}` auf allen
  Zeilen-Buttons, `ChevronRight` (Klick-Hinweis-Pfeil) nur bei
  `isMaster` gerendert, beide Dialoge werden auf einer Client-Installation
  gar nicht erst ins DOM gehängt (`{isMaster && (...)}`) – deckt sich mit
  `MasterOnlyGuard` auf dem Backend, das Bearbeiten dort ohnehin ablehnen
  würde.
- `/dashboard/websites` (`websites-view.tsx`) bleibt unverändert – der
  separate Bearbeiten-Stift-Button dort betrifft eine andere, bereits
  eigenständig gestylte Kachel-Ansicht und war nicht Gegenstand dieser
  Korrektur.

## Update 2026-08-24: Wartungsseite raus aus dem Popup, rein auf die Webseite-Seite

Nutzer-Korrektur: "alle Apps sollen hier einfach nur umgestellt werden
können ... hier unter Einstellungen soll nur Master oder Client
ausgewählt werden. Beim Umstellen soll nichts weiter passieren. Alle
anderen Einstellungen unter Webseite. Auch kein Titel und Text usw."
`DeploymentModeDialog` (Einstellungen → Master-Client → "Diese
Installation") enthält jetzt ausschließlich den Master/Client-
`SegmentedPicker` + eine erklärende Zeile – die Wartungsseiten-Felder
(Titel/Text) sind komplett raus.

Diese Felder gehören aber inhaltlich zu genau der Installation, die sie
verwaltet (werden angezeigt, sobald DIESE Installation als Client
gesperrt wird) – und die Seite "Webseite" (`/dashboard/websites`) war
bis dahin komplett Master-exklusiv (`MasterOnlyGuard`, Sidebar-Punkt nur
bei `isMaster` sichtbar). Auf einer echten Client-Installation (z.B.
strasev) wäre die Seite also gar nicht erreichbar gewesen – Rückfrage an
den Nutzer ergab: **eigener Bereich auf `/dashboard/websites`, der
Guard dafür gelockert, bleibt auch im Client-Modus erreichbar + im Nav
sichtbar; die Mandanten-Liste selbst bleibt Master-exklusiv.**

Umgesetzt:
- Neue Komponente `maintenance-page-card.tsx` – eigenständige Karte mit
  Titel/Text-Feldern + eigenem "Speichern"-Button (PATCH `/settings`),
  bewusst NICHT hinter `MasterOnlyGuard` (der auf dieser Seite nur die
  Mandanten-Verwaltungs-Endpunkte schützt, nicht `PATCH /settings`).
- `app-sidebar.tsx`: der `isMaster`-Filter auf die Gruppe
  "Administration" ist raus – "Webseite" (+ "Module") ist jetzt immer im
  Nav sichtbar, unabhängig vom Modus.
- `websites-view.tsx` bekommt neu `isMaster`, `maintenanceTitle`,
  `maintenanceMessage` als Props. Bei `!isMaster`: rendert NUR die
  `MaintenancePageCard` (keine Mandanten-Kacheln, kein "Prüfen", keine
  "Projekt anlegen"-Kachel – diese Endpunkte würden serverseitig ohnehin
  mit 404 antworten). Bei `isMaster`: Mandanten-Kacheln wie bisher, plus
  `MaintenancePageCard` darunter.
- `websites/page.tsx`: `getWebsites()` wird nur noch aufgerufen, wenn
  `settings.deploymentMode === "master"` ist (unnötigen 404-Request auf
  einer Client-Installation vermeiden); `isMaster` + die beiden
  Wartungsseiten-Felder aus `getSettings()` werden an `WebsitesView`
  durchgereicht.

## Update 2026-08-24: Wartungsseite doch nicht auf /dashboard/websites – eigener Einstellungen-Reiter; Mandanten-Zeilen bekommen echtes Master/Client-Popup

Zwei direkt aufeinanderfolgende Korrekturen zum oben beschriebenen Stand:

**1. Wartungsseite zurück unter Einstellungen.** Nutzer-Korrektur: "Wartungsseite da weg machen. Das gehört nicht zu Webseite." – die gerade erst dorthin verschobene `MaintenancePageCard` gehört doch nicht auf `/dashboard/websites`. Rückfrage ergab: **eigener, neuer Einstellungen-Reiter "Wartungsseite"** (`SectionId = "maintenance-page"`, Icon `Construction`), getrennt vom "Master-Client"-Reiter, immer erreichbar unabhängig vom Modus (die Einstellungen-Seite selbst ist ohnehin nur für Pivot-Rollen sichtbar, nicht Master/Client-abhängig). Enthält jetzt zusätzlich den bisher unter "Zugriff & Funktionen" liegenden `maintenanceModeEnabled`-Schalter ("Wartungsmodus" – ein anderer, allgemeiner Wartungshinweis im Dashboard, nicht zu verwechseln mit der Sperr-Wartungsseite) – Nutzervorgabe: "verschiebe dann den Wartungsseite aktiv aus Zugriff in Wartungsseite". Rückgängig gemacht: `/dashboard/websites` ist wieder rein Master-exklusiv (Sidebar-Filter, Seiten-Fetch), `websites-view.tsx` wieder ohne `isMaster`/Wartungsseiten-Props.

**2. Mandanten-Zeilen bekommen ein echtes, funktionierendes Master/Client-Popup statt nur eine Anzeige.** Nutzer-Korrektur (mehrfach, zunehmend deutlich): "ALLE APPS UNTER MASTER CLIENT AUFFÜHREN: ABER DA DARF NUR DIE EINSTELLUNG ZU CLIENT ODER MASTER JE SEITE GEMACHT WERDEN" / "wenn ich ... eine Seite anklicke, kommt ein Popup, wo man NUR wechseln kann zwischen Master und Client. Mehr nicht." Der erste Versuch (Mandanten-Zeile öffnet den vollen `WebsiteDialog`) widersprach damit dem "nur Master oder Client, sonst nichts"-Prinzip, das für die Selbst-Zeile schon galt.

Umgesetzt:
- Neues Feld `Website.deploymentMode` (`"master" | "slave"`, Default `"slave"`) in `schema.prisma` – ausdrücklich als **rein dokumentarisches Feld ohne technische Wirkung** kommentiert: ein Mandant hat keinen Push-Mechanismus, über den der Master seinen tatsächlichen Modus setzen könnte, das bleibt Sache der jeweiligen Installation selbst (`AppSettings.deploymentMode` vor Ort). Trotzdem als echtes, speicherbares Feld umgesetzt statt einer Attrappe ohne Persistenz, da der Nutzer ausdrücklich "wechseln" (nicht nur "anzeigen") verlangt hat.
- `UpdateWebsiteDto` + `WebsitesService.update()` akzeptieren `deploymentMode` (`WEBSITE_DEPLOYMENT_MODES`), `PUBLIC_SELECT` liefert es mit aus.
- Neue Komponente `website-mode-dialog.tsx` – exakt nach dem Vorbild von `deployment-mode-dialog.tsx` (Render-Zeit-Sync, `SegmentedPicker`, eigenständiges PATCH), aber für eine Mandanten-Zeile: PATCHt `/api/websites/:id` mit `{ deploymentMode }`. Enthält bewusst NICHTS sonst (kein Name/Domain/API-Key/Status – das bleibt unter Administration → Webseite im bestehenden `WebsiteDialog`).
- `master-client-card.tsx`: Mandanten-Zeilen öffnen jetzt `WebsiteModeDialog` statt `WebsiteDialog`; das "Client"-Badge pro Zeile zeigt den echten `website.deploymentMode` statt eines festen Texts.
- `db push --accept-data-loss` ausgeführt und live geprüft: beide vorhandenen Mandanten (strasev, dietest.de) haben jetzt `deploymentMode: "slave"` als Default.

## Update 2026-08-24: Löschen unter Webseite + Pagination im Master-Client-Reiter

Nutzervorgabe: "bei Webseiten und Einstellung Master-Client Pagination einbauen ... außerdem muss Löschen in Webseite eingebaut werden."

- `websites-view.tsx` (`/dashboard/websites`): zweiter Icon-Button (`Trash2`, neben dem bestehenden `Pencil`) pro Kachel, öffnet `ConfirmDeleteDialog` (Standard-Komponente, gleiches Muster wie `gallery-grid.tsx`). `DELETE /websites/:id` + der BFF-Proxy dafür existierten serverseitig bereits (unbenutzt) – jetzt ans Frontend angebunden. Hard-Delete (kein `deletedAt`/Papierkorb bei `Website`, anders als bei Content/Galerien) – Dialogtext macht das explizit ("wird endgültig entfernt") und stellt klar, dass die entfernte Installation selbst unberührt bleibt (nur der Master-seitige Mandanten-Eintrag verschwindet).
- Echte URL-Pagination war auf `/dashboard/websites` bereits vorhanden (`PaginationControls`, unverändert).
- Einstellungen → Master-Client: `getWebsites()` lädt jetzt mit echter Seitengröße (`settings.defaultPageSize`) statt fest `pageSize: 50`, eigener Query-Param `mandantenPage` (gleiche Konvention wie `webhooksPage`/`protocolPage`/`jobsRunsPage`). `SettingsForm`/`MasterClientCard` bekommen die volle `WebsiteListResponse` statt nur `items[]`; `PaginationControls` erscheint unterhalb der Mandanten-Liste, nur wenn `isMaster` und `pageCount > 1`.

## Update 2026-08-24: strasev lokal aufgesetzt – echter Cross-Instanz-Test erfolgreich

Erster echter Test mit zwei tatsächlich separat laufenden Prozessen statt der bisherigen Simulation (siehe "Nicht verifiziert" oben). Wichtige Erkenntnis dabei: `C:\git\strasev` war zwar schon geklont, hatte aber – da derselbe GitHub-Remote (`github.com/derThor/pivot`) wie Pivot selbst – den kompletten Master/Slave-Code noch nicht, weil der bis dahin nur uncommitted im Pivot-Arbeitsverzeichnis lag. Erst committet + zu `origin/master` gepusht (Commit `44b43e0`), dann bei strasev `git pull`.

**Lokales Setup** (kein eigener Server, dieselbe Windows-Maschine wie Pivot):
- Eigene Postgres-Datenbank `strasev` im bereits laufenden `pivot-postgres-1`-Container angelegt (nicht strasevs eigene `docker-compose.yml` gestartet – gleicher Compose-Projektname/Port 5432 wie bei Pivot, hätte kollidiert).
- `apps/api/.env`, `apps/web/.env.local`, `packages/database/.env`: eigene Ports (API 3011, Web 3010, Pivot bleibt 3001/3000), eigene `DATABASE_URL`, frisch generierte `JWT_*`/`TOTP_ENCRYPTION_KEY`-Secrets (nicht von Pivot wiederverwendet). `LICENSE_MASTER_URL="http://localhost:3001/v1"`, `LICENSE_SITE_DOMAIN="strasev.de"`, `LICENSE_API_KEY` (Klartext, per Skript aus `Website.apiKeyEncrypted` mit Pivots `TOTP_ENCRYPTION_KEY` entschlüsselt) und `LICENSE_MASTER_PUBLIC_KEY` (aus Pivots `LICENSE_SIGNING_PRIVATE_KEY` abgeleitet) aus der Master-Installation übernommen.
- `prisma db push` + `seed` gegen die neue DB, danach `AppSettings.deploymentMode` direkt per Skript auf `"slave"` gesetzt (einmaliger Bootstrap – ohne laufenden Server keine Möglichkeit, es über die UI zu setzen).

**Ergebnis:** Direkt beim Start von strasevs API griff `LicenseClientService.onModuleInit()` (da noch nie geprüft) und führte einen echten `performCheck()` gegen Pivots laufende API aus – erfolgreich: `GET /license/state` auf strasev liefert `{"mode":"slave","status":"development"}`, `LicenseState` bei strasev zeigt `seq: 2`, `lastCheckInAt` gesetzt, Ed25519-Signatur korrekt verifiziert. Pivots `Website`-Datensatz für strasev.de zeigt exakt denselben `lastSeq: 2`/`lastCheckInAt` – erste echte, verifizierte Ende-zu-Ende-Kommunikation zwischen zwei tatsächlich getrennten Prozessen. `status: "development"` ist von der Durchsetzung ausgenommen, daher kein Sperr-Test an dieser Stelle (folgt, sobald gewünscht, durch Umstellen auf "locked" im Master und Beobachten des Wartungsseiten-Verhaltens bei strasev).

**Cookie-Kollision entdeckt und dokumentiert:** Pivot (`:3000`) und strasev (`:3010`) teilen sich im selben Browser denselben Cookie-Speicher, da Cookies pro **Host**, nicht pro **Port** gelten (`localhost` ist bei beiden identisch). Ein bei strasev gesetztes Auth-Cookie überschreibt Pivots Cookie (gleicher Name, gleicher Host) – Pivot kann das fremde Token nicht validieren (anderes `JWT_ACCESS_SECRET`), was zu einer Endlosschleife zwischen `/login` und `/dashboard` führt (`ERR_TOO_MANY_REDIRECTS`), weil die Middleware nur prüft, OB ein Cookie da ist, nicht ob es gültig ist. **Für lokale Multi-Instanz-Tests: Pivot und strasev in getrennten Browser-Profilen/-Fenstern (z.B. eines davon im Inkognito-Modus) öffnen.** Kein Bug im Code, reines Artefakt des lokalen "beide auf localhost"-Setups – bei echten Kunden mit eigener Domain tritt das nicht auf.

**Sperr-Test danach live durchgeführt** (Nutzeranfrage: "ich will das mit der Lizenz testen"): `Website.status` bei Pivot auf `"locked"` gesetzt, strasevs `LicenseState` gelöscht, strasev-API neu gestartet → `onModuleInit()` holt sich den neuen, echten "locked"-Status. Ergebnis: `GET /license/state` bei strasev → `status:"locked"`, strasev-Dashboard zeigt die echte Wartungsseite, `GET /settings/public` bei strasev → `503`, `GET /health` bleibt `200`. Kompletter Kreis (Sperren → Pull → Signaturprüfung → Wartungsseite → API-Enforcement) einmal end-to-end mit zwei echten Prozessen bestätigt.

## Update 2026-08-24: `Website.testUrl` – lokale Installationen in die Live-Überwachung einbeziehen

Nutzerfrage beim Anschauen des "Website bearbeiten"-Dialogs: "wie findet hier die Verbindung statt? Muss da nicht ein Endpunkt angesteuert werden?" – Antwort: Für die eigentliche Lizenzprüfung nein (Pull-Modell, der Master ruft nie aktiv beim Client an), aber der `WebsiteMonitorService` (Live-Überwachung gesperrter Websites) ruft tatsächlich `https://{domain}/` auf – und das lief bei lokalen Testinstallationen wie strasev ins Leere, weil `strasev.de` nicht wirklich auf `localhost:3010` zeigt. Nutzerwunsch direkt danach: "ich will auch das lokale Testen hier drin haben."

Umgesetzt: neues optionales Feld `Website.testUrl` (schema.prisma) – wenn gesetzt, verwendet `WebsiteMonitorService.checkLockedWebsites()` diese URL statt `https://{domain}/`. Für echte Kunden bleibt es leer (Normalfall: `domain` reicht). Im `WebsiteDialog` (Administration → Webseite → Bearbeiten) neues Feld "Test-URL" mit erklärendem Hilfetext, nur im Bearbeiten-Modus sichtbar, `UpdateWebsiteDto.testUrl` (`@IsUrl({ require_tld: false })`, erlaubt `http://localhost:3010`).

**Live verifiziert:** `testUrl` für strasev auf `http://localhost:3010/` gesetzt, echten `POST /websites/check-now` mit einem gültigen (manuell signierten Test-)JWT ausgelöst – `lastLiveCheckAt` aktualisiert, `lastLiveCheckAnomaly: false` (korrekt: strasev war zu diesem Zeitpunkt gesperrt UND zeigte die Wartungsseite, also keine Anomalie) – bestätigt, dass tatsächlich `testUrl` statt der nicht erreichbaren echten Domain angefragt wurde.

## Update 2026-08-24: "Wecken" – der Master darf einen Client ohne Bruch des Pull-Prinzips anstupsen

Nutzer-Kontext: Pivot hatte strasev gesperrt, aber strasev bekam das nicht mit ("ich habe jetzt strasev in pivot gesperrt. aber nichts passiert") – erwartungsgemäß, da nur der wöchentliche Cron oder ein manueller Klick bei strasev selbst eine neue Prüfung auslöst. Auf "ich will das über Pivot auslösen" folgte die Erklärung, dass ein echter Push das Pull-Prinzip bräche. Der Kompromiss, dem der Nutzer zugestimmt hat ("können wir das auch einbauen?"): ein **"Wecken"-Aufruf ohne Autorität** – er löst bei der Installation nur ihren eigenen, weiterhin selbst-signierten Pull-Check aus, setzt nie selbst einen Status.

**Umgesetzt:**
- Client-seitig: `POST /license/wakeup` (`license-state.controller.ts`) – `@Public()`, authentifiziert per Konstant-Zeit-Vergleich gegen den ohnehin geteilten `LICENSE_API_KEY` (kein neues Secret). Steht in `LicenseEnforcementGuard`s Ausnahmeliste, damit eine gesperrte Installation überhaupt geweckt werden kann.
- Master-seitig: `WebsitesService.wakeup()` + `POST /websites/:id/wakeup` – entschlüsselt den gespeicherten API-Key, ruft `${website.testUrl ?? https://domain}/api/license/wakeup` auf. Neuer, dedizierter Next.js-Proxy `apps/web/src/app/api/license/wakeup/route.ts` beim Client (bewusst NICHT über `proxyToApi()`, da kein eingeloggter Nutzer, sondern der Master als Aufrufer – reiner Authorization-Header-Passthrough).
- UI: dritter Icon-Button ("Wecken", Glocke) pro Kachel auf `/dashboard/websites`.
- **Live verifiziert** (Nutzer-Frage danach: "was bedeutet das für die Sicherheit, kann man die Seite lahmlegen?"): Status bei Pivot auf "Live" gesetzt, strasev zeigte vorher noch "Gesperrt", `POST /websites/:id/wakeup` ausgelöst → strasev zeigt sofort `{"mode":"slave","status":"live"}`, ganz ohne Neustart.

**Sicherheitsbewertung** (Antwort auf die "lahmlegen"-Frage): Kein neuer Angriffsvektor – derselbe Key, derselbe globale `ThrottlerGuard` (100/Min/IP) wie bei `/license/check`. Ein Angreifer ohne Key wird billig abgelehnt (reiner Buffer-Vergleich); ein Angreifer MIT Key könnte ohnehin schon direkt `/license/check` missbrauchen, "Wecken" eröffnet keine neue Fähigkeit. Fälschen des Lizenzstatus ist unmöglich, da `performCheck()` immer die echte Master-Signatur verifiziert.

**Zusätzliche Härtung** (Nutzer, defensiv, obwohl kein akutes Loch): 60-Sekunden-Abklingzeit in `LicenseClientService.requestWakeup()` – verhindert, dass derselbe (evtl. geleakte) Key über mehrere IPs verteilt den IP-basierten Rate-Limit umgeht und wiederholt echte Master-Anfragen samt DB-Schreibzugriffen auslöst. Rein In-Memory, kein DB-Feld nötig.

## Update 2026-08-24: Lizenzprüfung + Live-Überwachung als rein lesbare Jobs sichtbar

Nutzerfrage: "warum wird der Job nicht unter Einstellungen → Jobs aufgeführt?" Antwort/Entscheidung: bewusst als interne Infrastruktur behandelt (siehe ursprüngliche Design-Notiz), nicht im editierbaren `ScheduledJob`-System – ein Admin dürfte diesen Job sonst pausieren und damit die Durchsetzung selbst aushebeln. Nutzer bestätigte trotz "nur Pivot-Rollen haben Zugriff" die Empfehlung, **nur lesbar** sichtbar zu machen, nicht editierbar.

Umgesetzt: `LicenseClientService.performCheck()` und `WebsiteMonitorService.checkLockedWebsites()` schreiben jetzt bei jedem Lauf einen `JobRun` (`jobId: "license-check"` bzw. `"website-monitor"`). Da `JobRun.jobId` per Fremdschlüssel an `ScheduledJob` gebunden ist, legt jede Methode zuerst idempotent eine `ScheduledJob`-Zeile an (`isCritical: true`) – aber **beide IDs fehlen bewusst in `JobsService.definitions`**, wodurch `JobsService.update()`/`runNow()` sie nie finden (`getDefinition()` wirft `NotFoundException`). `JobsService.findRecentRuns()` bekommt eine zusätzliche `READ_ONLY_JOB_TITLES`-Zuordnung für hübsche Anzeigenamen. Ergebnis: Beide Jobs tauchen in "Letzte Läufe" auf, aber nicht unter "Geplante Aufgaben" – kein Pausieren, kein Umplanen möglich.

**Live verifiziert:** `PATCH /jobs/website-monitor` (Versuch, zu pausieren) → `404 Unbekannter Job`. `GET /jobs/runs` zeigt den Lauf mit Titel "Live-Überwachung gesperrter Websites (Master)"; `GET /jobs` (Geplante Aufgaben) listet weiterhin nur die drei ursprünglichen Jobs.

**Für später wichtig:** Diese lokale Umgebung ist rein für Entwicklungstests gedacht, kein echter Kunden-Server. Sobald ein echter Server existiert, wird eine CI/CD-Pipeline aufgebaut (Nutzerentscheidung, 2026-08-24: zentrales Deploy-Skript/CI statt manuellem `git pull` pro Server) – strasev hat bereits eine eigene `docker-compose.yml`, die sich dafür anbietet.

## Update 2026-08-24: strasev bekommt ein eigenes GitHub-Repo

`C:\git\strasev`s `origin` zeigte bisher auf denselben Remote wie Pivot (`github.com/derThor/pivot`) – GitHub Desktop zeigte es deshalb konsequent als "pivot" statt als eigenständiges Repo an (Namensauflösung folgt dem verknüpften GitHub-Repo, nicht dem lokalen Ordnernamen). Nutzer hat ein neues, leeres Repo `github.com/derThor/strasev` angelegt. Umgebogen: `origin` → `upstream` (bleibt Quelle für `git pull upstream master`, unverändertes Deploy-Modell), neues `origin` zeigt auf `github.com/derThor/strasev.git`. Initialer `git push -u origin master` musste der Nutzer selbst ausführen (vom Auto-Mode-Berechtigungssystem als sensible Aktion geblockt).

## Update 2026-08-24: Standard-Wartungsseite nach Bildvorlage – markenfähig für jede Installation

Nutzervorgabe (mit Bildvorlage – lime-grüner Hintergrund, große Headline "Gleich wieder da.", Footer mit Kontakt/Firmenname): `/locked/page.tsx` komplett neu gebaut, als **Standard für alle** ausgelieferten Installationen, nicht nur strasev. Titel/Text bleiben wie vorbereitet unter Einstellungen → Wartungsseite editierbar; alle anderen Daten kommen automatisch aus bereits bestehenden Einstellungen – keine neue Konfigurationsfläche:

- **Hintergrundfarbe** = `AppSettings.accentColor` (Standard `#C8EE44`, dieselbe Farbe wie im Bildvorlage) – Textfarbe/Rahmen passen sich per Helligkeitsschätzung an (gleiche Formel wie beim Akzentfarbe-Feld unter Einstellungen → Darstellung), funktioniert also auch bei einem dunklen Kunden-Akzent.
- **Logo/Firmenname oben links** = `companyLogoUrl`/`companyName` (öffentlich über `GET /settings/public`, war bereits vorbereitet). Ohne eigenes Logo UND ohne gesetzten Firmennamen: Fallback auf das echte Pivot-Markenzeichen (`/brand/logo-collapsed.png`) + "Pivot" – genau der unkonfigurierte Zustand, den die Bildvorlage zeigt.
- **Footer-Kontaktzeile** (E-Mail/Telefon/Firmenname · Stadt) = `companyEmail`/`companyPhone`/`companyName`/`companyCity`, nur gerendert wenn mindestens eines davon gesetzt ist.
- Dekorative "● 503"-Pille oben rechts, UND `middleware.ts`s Rewrite setzt jetzt tatsächlich `{status: 503}` – **live bei strasev bestätigt: echte HTTP-Antwort ist 503**, nicht mehr 200. Nebeneffekt: `WebsiteMonitorService.isSiteUnexpectedlyLive()`s `res.ok`-Prüfung greift dadurch jetzt auch ohne den Meta-Tag-Marker korrekt (ein korrekt gesperrtes 503 ist nie `res.ok`).

**Wichtige Lektion beim Testen:** Ein erster Live-Test gegen strasev zeigte zunächst weiterhin die ALTE Wartungsseite (200 statt 503, alter Text) – Ursache war nicht die neue Seite selbst, sondern schlicht vergessen, den Commit vor dem Test zu Pivot zu pushen und bei strasev (`git pull upstream master`, neuer Remote-Name seit dem eigenen strasev-Repo) zu pullen. Nach dem Pull zeigte die neue Seite korrekt 503 + "Gleich wieder da." + den Pivot-Fallback (strasev hat unter Firma noch keinen eigenen Namen/Logo hinterlegt, Footer-Kontaktzeile blendet sich deshalb erwartungsgemäß aus).

## Update 2026-08-24: Firma-Daten kamen bei echter Sperre gar nicht an – `getPublicSettings()` durch `/license/state` ersetzt

Nutzer-Korrektur mit exakter Bildvorlage (`bg ist #bce64d`, Titel/Text mittig-links) + direkter Auftrag "footer bauen und Daten von Firma nehmen". Hex-Fix war trivial (`DEFAULT_ACCENT` von `#C8EE44` auf `#BCE64D`), das Ausrichtungs-Layout war schon korrekt (`flex-col justify-center`, kein `items-center`/`text-center`) – der eigentliche Fund beim Nachtesten: der Footer blieb bei einer ECHTEN Sperre leer, obwohl strasevs Firma-Daten inzwischen befüllt waren (testweise: "StraSev Steuerberatung PartG" / "kanzlei@strasev.de" / "+49 251 12345-0" / "Münster").

**Ursache:** `/locked/page.tsx` rief bisher zusätzlich zu `getLicenseState()` auch `getPublicSettings()` (`GET /settings/public`) auf, um Firma/Akzentfarbe zu bekommen. Aber `GET /settings/public` ist – bewusst, siehe `LicenseEnforcementGuard`-Kommentar – gerade WÄHREND einer echten Sperre selbst blockiert (503), da nur eine minimale Endpunkt-Allowlist erreichbar bleiben soll. Die Wartungsseite bekam ihre Marken-Daten also ausgerechnet in dem einen Moment nicht, in dem sie gebraucht werden – vorher unbemerkt, weil frühere Tests nie eine ECHTE Sperre mit befüllten Firma-Daten kombiniert hatten.

**Fix:** `EffectiveLicenseStatus`s "locked"-Variante (`license-client.service.ts`) um `companyName`/`companyLogoUrl`/`companyEmail`/`companyPhone`/`companyCity`/`accentColor` erweitert (neuer Typ `LockedPageBranding`, gespiegelt im Frontend-`LicenseState`-Typ). `getMaintenanceContent()` lädt diese Felder jetzt mit. `/locked/page.tsx` bezieht ALLES nur noch über `getLicenseState()`, `getPublicSettings()`-Aufruf komplett entfernt – die Seite ist dadurch auch architektonisch konsistent: sie wird ohnehin nur im gesperrten Zustand gerendert, braucht also nie einen Datenpfad, der genau dann blockiert ist.

**Live verifiziert:** strasev gesperrt + geweckt → Wartungsseite zeigt jetzt tatsächlich `#BCE64D`-Hintergrund UND (nach dem Befüllen der Firma-Seite) den echten Footer mit "StraSev Steuerberatung PartG · Münster", `kanzlei@strasev.de`, `+49 251 12345-0`.

## Update 2026-08-24: `/license/wakeup`-Abklingzeit entfernt – schluckte legitime Aufrufe

Nutzer-Bugreport: "wenn ich über Pivot sperre und dann die Wecker-Funktion ausrufe, geht es mal wieder nicht." Ursache: die eben erst eingebaute 60-Sekunden-Abklingzeit in `requestWakeup()` (siehe vorheriges Update) schluckte den Aufruf still, wenn kurz zuvor aus IRGENDEINEM Grund schon eine Prüfung gelaufen war (eigener Test, `onModuleInit` nach einem Neustart, …) – der Controller meldete aber trotzdem `{triggered:true}`, obwohl `performCheck()` gar nicht lief. Genau der beabsichtigte Normalfall ("sperren, dann sofort wecken") lief dadurch zufällig oft ins Leere.

Abwägung: Die Abklingzeit war ohnehin nur zusätzliche Vorsichtsmaßnahme (siehe Sicherheitsbewertung oben – der Endpunkt ist schon durch den geteilten API-Key + den globalen `ThrottlerGuard` abgesichert, kein akutes Loch ohne sie). Der reale Schaden am Kern-Feature wiegt schwerer als der marginale Zusatzschutz gegen einen Multi-IP-Replay eines ohnehin schon kompromittierten Keys. **Ersatzlos entfernt** – `requestWakeup()` ruft jetzt direkt `performCheck()` auf. Mehrfach live verifiziert (sperren → sofort wecken → korrekt; zweimal direkt hintereinander wecken → beide Male korrekt; entsperren → sofort wecken → korrekt).

## Update 2026-08-24: API-Key der Client-Installation über die UI änderbar

Vorheriger Zustand: Wenn der Master-Admin den API-Key einer Website regeneriert, musste der neue Key manuell in die `.env` der Client-Installation eingetragen und die Installation neu gestartet werden (siehe Nutzerfrage "wie bekomme ich den aktuellen beim Client rein?"). Nutzervorgabe danach: "eine Eingabe, wo man den Schlüssel ändern kann. Mach ein Schlüssel-Icon bei 'Diese Installation'."

**Umgesetzt** (gleiches Muster wie das SMTP-Passwort – schreibt-only, nie im Klartext zurückgegeben):
- Neues Feld `AppSettings.licenseApiKeyEncrypted` (schema.prisma), AES-256-GCM wie SMTP-Passwort/TOTP-Secrets.
- `SettingsService.getLicenseClientSettings()`/`updateLicenseClientSettings()` + `GET`/`PATCH /settings/license-client` (gleiches Recht wie der Rest der Einstellungen, kein eigenes Recht) – liefert nur `hasApiKey: boolean`, nie den Key selbst.
- `LicenseClientService.getApiKey()`: liest bevorzugt den über die UI gesetzten (entschlüsselten) DB-Wert, fällt auf die `LICENSE_API_KEY`-Umgebungsvariable zurück, solange noch nie über die UI ein Key gesetzt wurde (Erstinbetriebnahme per `.env` bleibt möglich).
- Frontend: neues Schlüssel-Icon (`KeyRound`) bei der "Diese Installation"-Zeile in `master-client-card.tsx`, **nur im Client-Modus sichtbar** (auf dem Master ergibt der eigene API-Key keinen Sinn – der Master stellt Tokens aus, prüft aber nie selbst welche). Öffnet `license-api-key-dialog.tsx`: zeigt nur "aktuell hinterlegt: ja/nein", ein Eingabefeld für den NEUEN Key (mit Anzeigen/Verbergen-Toggle für das gerade Getippte, nicht für den gespeicherten Wert) und einen Speichern-Button. Leer lassen behält den bestehenden Key.
- Selbst-Zeile musste dafür strukturell umgebaut werden: war bisher ein einziges `<button>` fürs ganze Zeilen-Klickverhalten (Master-Client-Popup) – jetzt ein `<div>`-Container mit dem Klick-Button links (Master-Client-Popup, weiterhin nur im Master-Modus aktiv) und dem neuen Schlüssel-Icon-Button rechts (nur im Client-Modus), da ein `<button>` kein zweites interaktives Element enthalten darf.
