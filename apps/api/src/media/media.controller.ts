import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { MediaService } from './media.service';
import { CropMediaDto } from './dto/crop-media.dto';
import { QueryMediaDto } from './dto/query-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { multerOptions } from './media.config';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FindPageDto } from '../common/dto/find-page.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @RequirePermission('media:read')
  @Get()
  findAll(@Query() query: QueryMediaDto) {
    return this.mediaService.findAll(query);
  }

  @RequirePermission('media:read')
  @Get(':id/page')
  findPage(@Param('id') id: string, @Query() query: FindPageDto) {
    return this.mediaService.findPage(id, query.pageSize);
  }

  @RequirePermission('media:read')
  @Get('unused')
  findUnused() {
    return this.mediaService.findUnused();
  }

  @RequirePermission('media:read')
  @Get('storage-usage')
  getStorageUsage() {
    return this.mediaService.getStorageUsage();
  }

  @RequirePermission('media:create')
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        alt: { type: 'string' },
        folderId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('alt') alt: string | undefined,
    @Body('folderId') folderId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('Keine Datei übermittelt.');
    }
    return this.mediaService.create(file, user.sub, alt, folderId || undefined);
  }

  @RequirePermission('media:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMediaDto) {
    return this.mediaService.update(id, dto);
  }

  @RequirePermission('media:update')
  @Post(':id/crop')
  crop(
    @Param('id') id: string,
    @Body() dto: CropMediaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mediaService.crop(id, dto, user.sub);
  }

  @RequirePermission('media:create')
  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.mediaService.duplicate(id, user.sub);
  }

  @RequirePermission('media:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }
}
