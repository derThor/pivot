import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  CategoryArchiveLayout,
  NavigationItemAppearance,
} from '@pivot/database';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class CreateNavigationItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiPropertyOptional({
    description:
      'Ziel-Inhalt (Seitenbaum). Genau eines von contentId/categoryId/externalUrl muss gesetzt sein.',
  })
  @IsOptional()
  @IsString()
  contentId?: string;

  @ApiPropertyOptional({
    description:
      'Ziel-Kategorie: der Menüpunkt zeigt auf deren Übersichtsseite (/{slug}), ' +
      'die alle veröffentlichten Beiträge der Kategorie auflistet. Genau ' +
      'eines von contentId/categoryId/externalUrl muss gesetzt sein.',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: CategoryArchiveLayout,
    description:
      'Darstellung der Übersichtsseite (nur zusammen mit categoryId sinnvoll): ' +
      'LIST = kompakt (Titel + Datum), BLOCKS = Karte mit Titelbild und ' +
      'Anreißtext. Beide blättern über Category.postsPerPage.',
  })
  @IsOptional()
  @IsEnum(CategoryArchiveLayout)
  categoryLayout?: CategoryArchiveLayout;

  @ApiPropertyOptional({
    description:
      'Externe Ziel-URL. Genau eines von contentId/categoryId/externalUrl muss gesetzt sein.',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  externalUrl?: string;

  @ApiPropertyOptional({
    enum: NavigationItemAppearance,
    description:
      'Darstellung im Header der öffentlichen Webseite: LINK = gewöhnlicher ' +
      'Menüpunkt, TEXT_BUTTON = rechts abgesetzt ohne Fläche, ' +
      'ACCENT_BUTTON = rechts abgesetzt mit Akzentfläche. Im Footer ohne ' +
      'Wirkung, dort sind alle Punkte Links.',
  })
  @IsOptional()
  @IsEnum(NavigationItemAppearance)
  appearance?: NavigationItemAppearance;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Für verschachtelte Menüs.',
  })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiPropertyOptional({
    description:
      'Öffnet das Ziel in einem neuen Tab (target="_blank"). Gilt für Inhalte und externe URLs gleichermaßen.',
  })
  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;
}
