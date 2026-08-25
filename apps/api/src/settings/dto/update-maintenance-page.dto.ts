import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Eigene, bewusst enge DTO statt UpdateSettingsDto (Nutzer-Bugreport,
// 2026-08-25: Titel/Text der Wartungsseite ließen sich auf einer bereits
// gesperrten Client-Installation nicht mehr ändern, weil `PATCH /settings`
// dort wie jeder andere Endpunkt vom LicenseEnforcementGuard blockiert
// wird – genau dann, wenn man die angezeigte Seite am dringendsten
// anpassen will). Nur diese zwei Felder dürfen über die eigens
// allowlistete Route `PATCH /settings/maintenance-page` (siehe
// LicenseEnforcementGuard) auch im gesperrten Zustand geändert werden,
// der allgemeine `PATCH /settings` bleibt dort weiterhin blockiert.
export class UpdateMaintenancePageDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  maintenancePageTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  maintenancePageMessage?: string | null;
}
