import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ReorderNavigationItemDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty({ nullable: true, description: 'null = oberste Ebene.' })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiProperty()
  @IsInt()
  sortOrder!: number;
}

export class ReorderNavigationItemsDto {
  @ApiProperty({ type: [ReorderNavigationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderNavigationItemDto)
  items!: ReorderNavigationItemDto[];
}
