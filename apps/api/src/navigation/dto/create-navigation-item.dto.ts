import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateNavigationItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiPropertyOptional({
    description:
      'Ziel-Inhalt (Seitenbaum). Genau eines von contentId/externalUrl muss gesetzt sein.',
  })
  @IsOptional()
  @IsString()
  contentId?: string;

  @ApiPropertyOptional({
    description:
      'Externe Ziel-URL. Genau eines von contentId/externalUrl muss gesetzt sein.',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  externalUrl?: string;

  @ApiPropertyOptional({ nullable: true, description: 'Für verschachtelte Menüs.' })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
