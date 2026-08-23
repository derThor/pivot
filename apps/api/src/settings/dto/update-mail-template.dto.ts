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
