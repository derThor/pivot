import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryMediaDto {
  @ApiPropertyOptional({
    description:
      'Ordner-ID zum Filtern. Literal "root" filtert auf Medien ohne Ordner. Weggelassen = alle Medien, ordnerübergreifend.',
  })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 24;
}
