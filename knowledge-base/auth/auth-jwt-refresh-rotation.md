# Auth: JWT Access + Refresh Token Rotation, RBAC

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/api (`src/auth`, `src/users`), packages/database

## Was wurde gebaut

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`
- Access-Token: JWT, signiert mit `JWT_ACCESS_SECRET`, Default-TTL 15 Minuten,
  enthält `{ sub, email, role }`.
- Refresh-Token: kryptographisch zufälliger 384-Bit-String, **nicht** als JWT,
  sondern serverseitig als SHA-256-Hash in der Tabelle `refresh_tokens`
  gespeichert (Default-TTL 30 Tage). Bei jedem `refresh` wird das alte Token
  als `revokedAt` markiert und ein neues Paar ausgestellt (Rotation).
- Passwort-Hashing mit Argon2 (`argon2.hash`/`argon2.verify`), sowohl in
  `AuthService`/`UsersService` als auch im Seed-Skript
  (`packages/database/prisma/seed.ts`).
- RBAC über `Role`-Enum (`ADMIN`, `EDITOR`, `AUTHOR`, `VIEWER`) im
  Prisma-Schema, durchgesetzt über `@Roles(...)`-Decorator + `RolesGuard`.
- Globale Absicherung: `JwtAuthGuard` + `RolesGuard` sind als `APP_GUARD` in
  `AuthModule` registriert und gelten für **alle** Routen, sofern nicht mit
  `@Public()` explizit ausgenommen (z.B. Login, Register, Health-Check).

## Warum diese Lösung

- **Refresh-Token als Opaque-String statt JWT**: ermöglicht serverseitigen
  Widerruf (JWTs sind bis zum Ablauf grundsätzlich nicht widerrufbar, außer
  über eine zusätzliche Blockliste – dann hätte man ohnehin einen DB-Zugriff
  pro Request). Da Refresh nur selten passiert (alle 15 Min bzw. bei
  Session-Start), ist der DB-Zugriff hier unkritisch für Performance.
- **Rotation statt wiederverwendbarem Refresh-Token**: reduziert das Risiko
  bei Diebstahl eines Refresh-Tokens (Replay wird nach einmaliger Nutzung
  durch den echten Client erkennbar/blockierbar – aktuell wird bei Nutzung
  eines bereits widerrufenen Tokens nur ein Fehler geworfen; ein
  "Token-Reuse-Detection"-Alarm über die ganze Token-Familie ist noch nicht
  implementiert, siehe unten).
- **Argon2 statt bcrypt**: aktuelle OWASP-Empfehlung für Passwort-Hashing.
- **Globale Guards + `@Public()`-Opt-out** statt Guards pro Controller: neue
  Endpoints sind dadurch standardmäßig abgesichert ("secure by default")
  statt versehentlich offen zu bleiben.

## Stolpersteine / Besonderheiten

- `expiresIn` bei `JwtService.signAsync` erwartet entweder eine Zahl
  (Sekunden) oder einen sehr spezifisch typisierten String-Typ (`StringValue`
  aus dem `ms`-Package). Der eigene Env-Wert (`JWT_ACCESS_TTL="15m"`, freier
  String) ließ sich nicht direkt durchreichen (TS2769). Lösung: eigener
  einfacher Parser (`src/common/utils/ms.ts`) wandelt den String in
  Millisekunden um, `signAsync` bekommt dann `Math.floor(ms(ttl) / 1000)` als
  Zahl.
- Prisma-JSON-Felder (`Content.data`) akzeptieren kein plain
  `Record<string, unknown>` ohne Cast – muss als `Prisma.InputJsonValue`
  gecastet werden (siehe `content.service.ts`), sonst TS2322.

## Relevante Dateien

- `apps/api/src/auth/*` (Service, Controller, Module, Strategien, Guards,
  Decorators, DTOs)
- `apps/api/src/common/utils/ms.ts`
- `apps/api/src/common/config/env.validation.ts`
- `packages/database/prisma/schema.prisma` (`User`, `RefreshToken`, `Role`)
- `packages/database/prisma/seed.ts`

## Offene Punkte

- Token-Reuse-Detection über die gesamte Refresh-Token-Familie (bei erkanntem
  Replay alle Tokens der Familie/des Users widerrufen) ist nicht umgesetzt.
- Passwort-Reset-Flow, 2FA/TOTP, OAuth/SSO: siehe
  [`docs/ROADMAP.md`](../../docs/ROADMAP.md) Phase 3/4.
