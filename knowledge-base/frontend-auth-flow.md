# Frontend-Auth-Flow: httpOnly-Cookies via BFF + Middleware-Gate

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/web (`src/middleware.ts`, `src/lib/auth.ts`,
`src/lib/api-server.ts`, `src/app/api/auth/*`, `src/app/login`,
`src/app/dashboard/layout.tsx`)

## Was wurde gebaut

- Next.js Route Handler `POST /api/auth/login` und `POST /api/auth/logout`
  als BFF-Schicht: rufen die NestJS-API auf und setzen/löschen
  `access_token`/`refresh_token` als httpOnly-Cookies (`src/lib/auth.ts`
  bündelt die Cookie-Optionen).
- `middleware.ts` schützt `/dashboard/*`: kein `access_token` → Redirect zu
  `/login`; nur `refresh_token` vorhanden → stiller Refresh gegen
  `POST /auth/refresh`, neue Cookies werden auf die Response geschrieben,
  Request läuft durch. Kein Cookie mehr vorhanden → Redirect + Cookies
  löschen.
- `src/lib/api-server.ts`: serverseitige, typisierte Fetch-Helper
  (`getCurrentUser`, `getContentList`, `getUsers`, `getContentTypes`), die
  den `access_token` aus dem Cookie lesen und `Authorization: Bearer …`
  anhängen. Werden aus Server Components aufgerufen.
- Login-Formular (`src/app/login/page.tsx`) ruft jetzt wirklich
  `/api/auth/login` auf, zeigt Backend-Fehlermeldungen an, leitet nach
  Erfolg zu `redirectTo` (aus der Query) bzw. `/dashboard` weiter.
- `dashboard/layout.tsx` lädt den echten User serverseitig
  (`getCurrentUser()`) und reicht ihn an `AppSidebar` durch (echter
  Name/Rolle/Initialen statt Platzhalter, plus Logout-Button).

## Warum diese Lösung

- Die NestJS-API gibt `accessToken`/`refreshToken` **nur im JSON-Body**
  zurück, setzt selbst keine Cookies (siehe
  [auth-jwt-refresh-rotation.md](./auth-jwt-refresh-rotation.md)). Das
  Frontend muss die Storage-Strategie also selbst entscheiden.
- **httpOnly-Cookies statt `localStorage`**: schützt die Tokens vor
  XSS-Zugriff durch Client-JS. Kosten: Browser-JS kann die Tokens nicht
  selbst an die API schicken, deshalb der BFF-Umweg über Next.js Route
  Handler/Server Components statt direktem Client-seitigem Fetch zur API.
- **Silent Refresh in der Middleware statt in `lib/api-server.ts`**: Next.js
  erlaubt `cookies().set(...)` nur in Route Handlers/Server Actions, nicht
  in Server Components während des Renderns. Middleware kann dagegen
  Response-Cookies setzen und läuft bei jedem `/dashboard`-Request VOR dem
  Rendern – dadurch ist die Refresh-Logik an einer Stelle zentralisiert,
  Server Components müssen sich nicht darum kümmern.
- **Cookie `Path=/` für beide Tokens** (nicht z.B. `/api/auth` für den
  Refresh-Token): der Browser schickt Cookies nur für Requests, deren Pfad
  zum Cookie-Path passt. Mit einem restriktiveren Path hätte die Middleware
  bei `/dashboard`-Requests das `refresh_token`-Cookie gar nicht gesehen.

## Stolpersteine / Besonderheiten

- `useSearchParams()` in einer Client-Page erzwingt in Next.js beim Build
  eine Suspense-Boundary (sonst Build-Fehler). Umgangen, indem
  `redirectTo` beim Submit direkt aus `window.location.search` gelesen
  wird statt über den Hook.
- Middleware läuft standardmäßig in der Edge-Runtime – `fetch` gegen die
  Backend-API funktioniert dort, aber Node-only-APIs wären tabu (aktuell
  nicht benötigt, da nur `fetch` + Cookie-Handling verwendet wird).
- `GET /content`, `/content-types`, `/users` verlangen serverseitig einen
  gültigen Access Token; ohne Cookie liefert `apiFetch()` in
  `lib/api-server.ts` bewusst `null` statt zu werfen, Aufrufer zeigen dann
  einen `–`-Platzhalter statt einen Fehler.

## Relevante Dateien

- `apps/web/src/middleware.ts`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/lib/api-server.ts`
- `apps/web/src/app/api/auth/login/route.ts`
- `apps/web/src/app/api/auth/logout/route.ts`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/dashboard/layout.tsx`
- `apps/web/src/components/app-sidebar.tsx`

## Offene Punkte

- Kein explizites CSRF-Token (Double-Submit-Cookie o.ä.) – `SameSite=Lax`
  mildert das Risiko für die aktuellen POST-Route-Handler, ist aber kein
  vollständiger Schutz.
- Passwort-Reset, 2FA/TOTP, OAuth/SSO: siehe
  [`docs/ROADMAP.md`](../docs/ROADMAP.md) Phase 3/4.
