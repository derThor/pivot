import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateFormDto } from './create-form.dto';

export class UpdateFormDto extends PartialType(CreateFormDto) {
  @ApiPropertyOptional({ enum: ['draft', 'published', 'paused'] })
  @IsOptional()
  @IsIn(['draft', 'published', 'paused'])
  status?: 'draft' | 'published' | 'paused';
}
