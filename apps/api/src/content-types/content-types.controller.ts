import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContentTypesService } from './content-types.service';

@ApiTags('content-types')
@ApiBearerAuth()
@Controller('content-types')
export class ContentTypesController {
  constructor(private readonly contentTypesService: ContentTypesService) {}

  @Get()
  findAll() {
    return this.contentTypesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contentTypesService.findOne(id);
  }
}
