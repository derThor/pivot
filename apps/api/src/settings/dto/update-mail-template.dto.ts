import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMailTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  // Welche Hülle beim Versand verwendet wird (gilt für jede Vorlage,
  // System wie Formular). `null` setzt bewusst auf die Standard-Hülle
  // der Installation zurück.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  shellId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  // Nur bei Vorlagen mit editierbarem Empfänger wirksam (siehe
  // MailerService.updateMailTemplate) – leerer String setzt bewusst auf
  // "gemeinsame Adresse" (AppSettings.notificationRecipientEmail) zurück.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientTo?: string;
}
