import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContentTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.contentType.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const contentType = await this.prisma.contentType.findUnique({
      where: { id },
    });
    if (!contentType) {
      throw new NotFoundException(`Content-Type ${id} nicht gefunden.`);
    }
    return contentType;
  }
}
