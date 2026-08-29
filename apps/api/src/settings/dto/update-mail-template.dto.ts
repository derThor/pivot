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

  // Nur bei individuellen (kind: "custom") Vorlagen wirksam – die HTML-
  // Quelle aus dem Tiptap-Editor. `body` wird beim Speichern daraus
  // automatisch als Plaintext-Fallback abgeleitet (siehe
  // MailerService.updateMailTemplate), nicht separat übergeben.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyHtml?: string;

  // Nur bei "custom"-Vorlagen umbenennbar (System-/Formular-Vorlagen
  // leiten ihr Label aus dem Katalog/Formular ab).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // Nur bei "custom"-Vorlagen – welche Hülle beim Versand verwendet wird.
  // `null` setzt bewusst auf "Standard-Hülle der Installation" zurück.
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
