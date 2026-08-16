# App-weiter In-Memory-Cache (`CacheService`)

**Datum:** 2026-08-16
**Betroffene Bereiche:** apps/api (`src/cache`, `src/app.module.ts`), erste
Verwendung in `src/users/users.service.ts`

## Was gebaut wurde

Zentraler, wiederverwendbarer Cache-Service (`apps/api/src/cache/
cache.service.ts`), als `@Global()`-Modul (`cache.module.ts`) registriert –
jeder Service kann `CacheService` injizieren, ohne das Modul einzeln zu
importieren. API: `get`/`set`/`getOrSet`/`delete`/`deleteByPrefix`/`clear`.

Erste Verwendung: `UsersService.getNotificationCounts()` (siehe
[toast-and-system-messages.md](../frontend/toast-and-system-messages.md),
Update 2026-08-16) – Ergebnis 30s gecacht, da der Endpunkt bei jeder
Dashboard-Navigation für jeden Nutzer mit `users:read` aufgerufen wird.

**"Cache leeren" unter Einstellungen:** `POST /settings/clear-cache`
(`settings:update`, Button in `settings-form.tsx`, System-Tab) leert den
gesamten `CacheService` auf einmal – bewusst kein selektives Leeren pro
Bereich, da der Cache app-weit geteilt ist und die Anzahl der Cache-Keys
klein bleiben soll.

## Warum diese Lösung

- Nutzervorgabe, nachdem die Frage aufkam, ob häufig wiederholte Abfragen
  (Systembenachrichtigungs-Zähler) bei vielen Nutzern zum Problem werden:
  "die App ist nicht nur ein normales CMS, sondern es wird auch
  Nutzerkonten mit vielen Nutzern geben (z.B. Fitnessstudio, User
  Accounts usw.)" – die `User`-Tabelle ist also nicht auf eine kleine,
  feste Admin-Zahl beschränkt.
- Kein Redis angebunden (siehe `docs/ROADMAP.md` Phase 3, "Redis-Anbindung
  für Caching/Sessions aktivieren" – dort weiterhin offen) – ein simpler
  Prozess-lokaler `Map`-Cache ist der pragmatische Zwischenschritt, der
  dieselbe Schnittstelle (`getOrSet` etc.) bietet und sich später 1:1
  gegen eine Redis-gestützte Implementierung tauschen lässt, ohne
  Aufrufer-Code anzufassen.
- Bewusst als eigenständiges, generisches Modul statt Ad-hoc-Caching direkt
  in `UsersService` – soll ausdrücklich für weitere Bereiche wiederverwendet
  werden, sobald dort ähnliche Skalierungsfragen auftauchen (z.B. andere
  häufig wiederholte Zähler-/Aggregations-Abfragen).

## Stolpersteine / Besonderheiten

- **Nicht über mehrere Server-Instanzen geteilt.** Für den aktuellen
  Single-Instance-Betrieb unproblematisch; bei horizontaler Skalierung
  (mehrere API-Prozesse hinter einem Load-Balancer) müsste der In-Memory-
  Store durch eine Redis-gestützte Variante mit derselben Schnittstelle
  ersetzt werden – dann sähen auch mehrere Instanzen denselben Cache-Stand
  und dasselbe "Cache leeren" würde wirklich überall greifen.
- **Keine automatische Invalidierung bei Mutationen.** Der 30s-TTL bei
  `getNotificationCounts()` ist bewusst kurz genug gewählt, dass eine
  Änderung (z.B. ein Nutzer wird freigeschaltet) spätestens nach einer
  Dashboard-Navigation sichtbar wird, ohne dass jede betroffene
  Schreiboperation (`UsersService.update()`, `AuthService.login()` bei
  Fehlversuchen, …) den Cache-Eintrag gezielt löschen muss. Für Daten, bei
  denen sofortige Konsistenz nötig ist, ist dieser Cache nicht geeignet.
- **"Nicht nur ausblenden, sondern das Erfassen beenden"**: Für per
  `AppSettings.notify*` deaktivierte Benachrichtigungs-Kategorien wird die
  zugrunde liegende Abfrage gar nicht erst ausgeführt (siehe
  toast-and-system-messages.md) – das ist eine separate Optimierung,
  unabhängig vom `CacheService`, aber im selben Kontext entstanden.

## Relevante Dateien

- `apps/api/src/cache/cache.service.ts`, `cache.module.ts`
- `apps/api/src/app.module.ts` (Registrierung)
- `apps/api/src/users/users.service.ts` (`getNotificationCounts()`)
- `apps/api/src/settings/settings.controller.ts` (`POST /settings/clear-cache`)
- `apps/web/src/components/settings-form.tsx` ("Cache leeren"-Button)
- `apps/web/src/app/api/settings/clear-cache/route.ts`
- `packages/database/prisma/schema.prisma` (`User`/`UserRole`-Indizes für
  dieselben Abfragen, siehe Schema-Kommentare)
