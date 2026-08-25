import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

let cached: string | null = null;

/** Sucht von `startDir` aus nach oben, bis eine `package.json` mit
 * `name: "pivot"` gefunden wird – robuster als ein fester relativer Pfad,
 * der je nach src-/dist-Verschachtelung unterschiedlich tief wäre. */
function findRepoRoot(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
          name?: string;
        };
        if (pkg.name === 'pivot') return dir;
      } catch {
        // ungültige/fremde package.json – weiter nach oben suchen
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Version dieser Installation für Diagnose/Support (Nutzervorgabe,
 * 2026-08-25: "Versionierung ... soll beim Prüfen eingeholt werden, so
 * dass man den aktuellen Stand ermitteln kann") – Semver aus der
 * Monorepo-Wurzel (`package.json`, EIN Wert für die ganze Installation
 * statt der bisher nie disziplinär gepflegten, unterschiedlichen
 * Versionen von apps/web und apps/api) kombiniert mit dem kurzen
 * Git-Commit-Hash, der immer exakt den ausgelieferten Stand zeigt, auch
 * wenn die Semver-Zahl mal nicht hochgezählt wurde. Wird einmalig pro
 * Prozess ermittelt und danach zwischengespeichert. */
export function getAppVersion(): string {
  if (cached) return cached;
  const repoRoot = findRepoRoot(__dirname);

  let semver = '0.0.0';
  if (repoRoot) {
    try {
      const pkg = JSON.parse(
        readFileSync(join(repoRoot, 'package.json'), 'utf8'),
      ) as { version?: string };
      semver = pkg.version ?? semver;
    } catch {
      // Fallback bleibt bestehen
    }
  }

  let commit = 'unbekannt';
  try {
    commit = execSync('git rev-parse --short HEAD', {
      cwd: repoRoot ?? __dirname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    // Kein Git-Verzeichnis verfügbar (z.B. gepackter Deploy ohne .git)
  }

  cached = `${semver}+${commit}`;
  return cached;
}
