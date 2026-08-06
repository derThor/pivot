# pnpm Build-Skript-Freigaben (`allowBuilds`)

**Datum:** 2026-08-02
**Betroffene Bereiche:** Root (`pnpm-workspace.yaml`)

## Was wurde gebaut

Die neuere pnpm-Version (11.x) führt Postinstall-/Build-Skripte von
Dependencies standardmäßig **nicht** mehr automatisch aus
(`ERR_PNPM_IGNORED_BUILDS`). Freigaben werden zentral in
`pnpm-workspace.yaml` unter `allowBuilds:` gepflegt statt interaktiv pro
Entwickler:in bestätigt.

Aktuell freigegeben (`true`): `@prisma/client`, `@prisma/engines`, `prisma`,
`argon2`, `esbuild`, `sharp`, `unrs-resolver`.
Bewusst **nicht** freigegeben (`false`): `@scarf/scarf` (reine
Telemetrie/Analytics-Beacon, keine funktionale Notwendigkeit).

## Warum diese Lösung

Alle freigegebenen Pakete benötigen native Kompilierung oder
Binary-Downloads, um überhaupt zu funktionieren (Prisma-Engines, argon2
native Bindings, sharp für Next.js-Bildoptimierung, esbuild-Binary,
unrs-resolver für ESLint). Ohne Freigabe schlägt entweder die Installation
fehl oder die Pakete funktionieren zur Laufzeit nicht. `@scarf/scarf` ist
eine reine Analytics-Dependency einer Sub-Abhängigkeit ohne Einfluss auf die
Funktion – bewusst deaktiviert, um keine unnötige Telemetrie auszuführen.

## Stolpersteine / Besonderheiten

- Bei jeder neuen Dependency mit nativen Bindings (z.B. weitere
  Bild-/Krypto-/DB-Treiber-Pakete) erscheint dieselbe Fehlermeldung erneut.
  Vorgehen: Paket in `pnpm-workspace.yaml` unter `allowBuilds` eintragen
  (`true`/`false` bewusst je nach Vertrauenswürdigkeit/Notwendigkeit setzen),
  dann `pnpm install` erneut ausführen.
- Diese Datei (`pnpm-workspace.yaml`) wird von pnpm automatisch mit neuen,
  noch unentschiedenen Einträgen (`set this to true or false`) ergänzt, wenn
  neue Pakete mit Build-Skripten hinzukommen – das ist kein Fehler, sondern
  erwartetes Verhalten, das eine bewusste Entscheidung erzwingt.

## Relevante Dateien

- `pnpm-workspace.yaml`

## Offene Punkte

Keine.
