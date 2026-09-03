import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateNavigationItemDto } from './create-navigation-item.dto';

export class UpdateNavigationItemDto extends PartialType(
  CreateNavigationItemDto,
) {
  @ApiPropertyOptional({
    description:
      'Markiert diesen Menüpunkt als Startseite der öffentlichen Webseite. ' +
      'App-weit kann immer nur genau ein Punkt die Startseite sein – beim ' +
      'Setzen wird der bisherige automatisch abgewählt. Nur für Menüpunkte ' +
      'mit Inhalts-Ziel möglich – weder für externe Links noch für Kategorien.',
  })
  @IsOptional()
  @IsBoolean()
  isHomepage?: boolean;
}
