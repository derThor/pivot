const { spawnSync } = require('node:child_process');
const path = require('node:path');

const TEST_DATABASE_URL =
  'postgresql://strasev:strasev@localhost:5432/strasev_test?schema=public';

const schemaPath = path.resolve(
  __dirname,
  '../../../packages/database/prisma/schema.prisma',
);

const command = [
  'pnpm',
  'exec',
  'prisma',
  'db',
  'push',
  '--skip-generate',
  '--accept-data-loss',
  `--schema=${schemaPath}`,
].join(' ');

const result = spawnSync(command, {
  cwd: path.resolve(__dirname, '../../../packages/database'),
  env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  console.error('Konnte Test-Datenbank nicht vorbereiten.');
  process.exit(result.status ?? 1);
}
