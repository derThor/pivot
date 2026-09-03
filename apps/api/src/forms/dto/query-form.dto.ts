import { ApiPropertyOptional } from '@nestjs/swagger';
import { SortQueryDto } from '../../common/dto/sort-query.dto';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryFormDto extends SortQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ enum: ['draft', 'published', 'paused'] })
  @IsOptional()
  @IsIn(['draft', 'published', 'paused'])
  status?: 'draft' | 'published' | 'paused';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}
