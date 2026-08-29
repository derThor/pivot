import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Eigene, engste DTO nur für `sccTemplateMediaId` (Nutzervorgabe,
// 2026-08-29: gehört inhaltlich zum "Auftragsverarbeiter"-Reiter
// (Drittlandtransfer-Vorlage), nicht zu `rechtstexte`, wo es zuvor
// über `UpdatePrivacyDto` mitlief) – analog zum `dsb`-Split:
// `PATCH /settings/privacy/scc-template` wird unabhängig über
// `@RequireModuleFeature('datenschutz', 'auftragsverarbeiter')` gegatet.
export class UpdatePrivacySccTemplateDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  sccTemplateMediaId?: string | null;
}
