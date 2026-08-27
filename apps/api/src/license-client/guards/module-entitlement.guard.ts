import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NotFoundException } from '@nestjs/common';
import { LicenseClientService } from '../license-client.service';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';

/**
 * Mandantenfähigkeit (Nutzervorgabe, 2026-08-27): sperrt eine Route hart,
 * sofern diese Installation das per `@RequireModule('...')` geforderte
 * Modul nicht gebucht hat – 404 statt 403 (gleiche "existiert nicht"-
 * Konvention wie `MasterOnlyGuard`). Auf einer Master-Installation wirkt
 * der Guard NIE (Master ist das Hauptsystem, keine Modul-Freischaltung
 * für sich selbst nötig) – nur eine Slave-Installation prüft ihre eigenen,
 * vom Master signiert bestätigten Entitlements (`LicenseState.modules`,
 * siehe `LicenseClientService.getEffectiveStatus()`).
 *
 * Noch nirgends angewendet (Nutzervorgabe: "Verdrahtung von 'Datenschutz'
 * hinter den Guard ist Folgearbeit, nicht Teil dieser Runde") – dieser
 * Guard ist die vorbereitete Infrastruktur dafür.
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
    if (effective.mode === 'master') {
      return true;
    }
    const modules = 'modules' in effective ? effective.modules : [];
    if (!modules.includes(requiredModule)) {
      throw new NotFoundException();
    }
    return true;
  }
}
