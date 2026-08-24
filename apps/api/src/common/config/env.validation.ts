import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wird benötigt'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET muss mind. 32 Zeichen lang sein'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET muss mind. 32 Zeichen lang sein'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  TOTP_ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-f]{64}$/i,
      'TOTP_ENCRYPTION_KEY muss ein 64-stelliger Hex-String sein (32 Byte, für AES-256-GCM)',
    ),
  // Master/Slave-Modus liegt seit 2026-08-24 in `AppSettings.deploymentMode`
  // (Pivot-Admin-editierbar unter Einstellungen), nicht mehr hier – siehe
  // knowledge-base/platform/master-slave-licensing.md. Die folgenden Werte
  // bleiben Umgebungsvariablen (Zugangsdaten, gehören nicht in eine
  // web-editierbare Einstellung): nur relevant, wenn diese Installation im
  // Slave-Modus läuft, werden zur Laufzeit von LicenseClientService
  // geprüft, nicht hier beim Start erzwungen (der Modus ist zum
  // Validierungszeitpunkt noch nicht aus der DB bekannt).
  LICENSE_SIGNING_PRIVATE_KEY: z.string().optional(),
  LICENSE_MASTER_URL: z.string().optional(),
  LICENSE_SITE_DOMAIN: z.string().optional(),
  LICENSE_API_KEY: z.string().optional(),
  LICENSE_MASTER_PUBLIC_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Ungültige Umgebungsvariablen:\n${result.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n')}`,
    );
  }
  return result.data;
}
