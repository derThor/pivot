import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NotFoundException } from '@nestjs/common';
import { LicenseClientService } from '../license-client.service';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';

/**
 * Mandantenfähigkeit (Nutzervorgabe, 2026-08-27): sperrt eine Route hart,
 * sofern diese Installation das per `@RequireModule('...')` geforderte
 * Modul nicht gebucht hat – 404 statt 403 (gleiche "existiert nicht"-
 * Konvention wie `MasterOnlyGuard`).
 *
 * Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): Master hat KEINEN
 * pauschalen Bypass mehr ("Master wird nicht über Mandanten geregelt" –
 * er bekommt stattdessen eine eigene, lokale Freischaltung über
 * `ModuleSettings`, editierbar unter Einstellungen → Module). Master und
 * Slave laufen dadurch über exakt dieselbe Prüfung:
 * `LicenseClientService.getEffectiveStatus()` liefert auf beiden Modi ein
 * `modules`-Feld (Slave: signiert vom Master über `LicenseState.modules`;
 * Master: lokal aus `ModuleSettings`).
 */
@Injectable()
export class ModuleEntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly licenseClient: LicenseClientService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(
      REQUIRE_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredModule) {
      return true;
    }

    const effective = await this.licenseClient.getEffectiveStatus();
    const modules = 'modules' in effective ? effective.modules : [];
    if (!modules.includes(requiredModule)) {
      throw new NotFoundException();
    }
    return true;
  }
}
