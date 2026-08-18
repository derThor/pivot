import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { TRASH_TYPES } from '../trash.types';
import type { TrashType } from '../trash.types';

export class QueryTrashDto {
  @ApiPropertyOptional({ enum: TRASH_TYPES })
  @IsOptional()
  @IsIn(TRASH_TYPES)
  type?: TrashType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}
