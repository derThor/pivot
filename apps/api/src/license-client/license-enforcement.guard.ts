import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';
import { LicenseClientService } from './license-client.service';

// Bleiben auch bei "locked" erreichbar (Nutzervorgabe: "API blockt bis auf
// einen minimalen Health-/Lizenz-Endpunkt"). Suffix-Vergleich statt
// exaktem Pfad, damit das URI-Versionierungspräfix (`/v1/...`) keine
// Rolle spielt. `/license/recheck` bewusst mit dabei (Nutzervorgabe,
// 2026-08-24: "damit du nicht neu starten musst") – sonst wäre der
// "Jetzt prüfen"-Endpunkt ausgerechnet im gesperrten Zustand selbst
// blockiert, obwohl genau dort (Master hat gerade entsperrt, lokaler
// Stand ist noch veraltet) der eigentliche Anwendungsfall liegt. Bleibt
// trotzdem hinter echtem Login + `settings:update` (JwtAuthGuard/
// PermissionsGuard laufen unabhängig von diesem Guard weiter).
// `/license/wakeup` aus demselben Grund: der Master muss eine gesperrte
// Installation genau dann wecken können, wenn sie noch gesperrt ist.
// `/settings/maintenance-page` aus demselben Grund (Nutzer-Bugreport,
// 2026-08-25: Titel/Text der Wartungsseite ließen sich ausgerechnet dann
// nicht mehr ändern, wenn die Installation bereits gesperrt war und man
// die angezeigte Seite anpassen wollte) – bewusst NICHT das allgemeine
// `/settings`, das bleibt im gesperrten Zustand weiterhin blockiert.
// `/license/recovery/*` (Nutzervorgabe, 2026-08-26): ohne diese Ausnahme
// gäbe es keine Möglichkeit mehr, einen falsch eingetragenen Lizenz-Key zu
// korrigieren, sobald die Installation einmal gesperrt ist – der Guard
// blockt sonst auch den Login selbst. Bleibt trotzdem durch echte
// Zugangsdaten + `settings:update`-Recht abgesichert (siehe
// LicenseClientService.verifyRecoveryCredentials()), kein offener Bypass.
const ALLOWED_SUFFIXES = [
  '/health',
  '/license/state',
  '/license/recheck',
  '/license/wakeup',
  '/license/recovery/verify',
  '/license/recovery/apply-key',
  '/settings/maintenance-page',
];

/**
 * Globaler Guard: blockt auf einer Slave-Installation (fast) jeden
 * Request, sobald der lokale Lizenzstatus "locked" ist (siehe
 * knowledge-base/platform/master-slave-licensing.md – Wartungsmodus).
 * Auf einer Master-Installation immer inaktiv (`getEffectiveStatus()`
 * liefert dort `{ mode: "master" }`).
 */
@Injectable()
export class LicenseEnforcementGuard implements CanActivate {
  constructor(private readonly licenseClient: LicenseClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (ALLOWED_SUFFIXES.some((suffix) => req.path.endsWith(suffix))) {
      return true;
    }

    const effective = await this.licenseClient.getEffectiveStatus();
    if (effective.mode === 'master') return true;
    if (effective.status === 'locked') {
      throw new ServiceUnavailableException(
        'Diese Installation ist derzeit gesperrt.',
      );
    }
    return true;
  }
}
