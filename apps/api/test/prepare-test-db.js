const { spawnSync } = require('node:child_process');
const path = require('node:path');

const TEST_DATABASE_URL =
  'postgresql://pivot:pivot@localhost:5432/pivot_test?schema=public';

const schemaPath = path.resolve(
  __dirname,
  '../../../packages/database/prisma/schema.prisma',
);

const databasePkgDir = path.resolve(__dirname, '../../../packages/database');
const sharedEnv = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };

function run(command) {
  const result = spawnSync(command, {
    cwd: databasePkgDir,
    env: sharedEnv,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Schema synchronisieren (Wegwerf-Testdatenbank, keine Migrationshistorie nötig).
run(
  [
    'pnpm',
    'exec',
    'prisma',
    'db',
    'push',
    '--skip-generate',
    '--accept-data-loss',
    `--schema=${schemaPath}`,
  ].join(' '),
);

// Rollen/Rechte/Settings seeden – ohne isDefault-Rolle würde AuthService.register()
// in den Tests fehlschlagen (findFirstOrThrow auf leerer Role-Tabelle).
run('pnpm exec tsx prisma/seed.ts');
