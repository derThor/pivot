import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModuleTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.moduleType.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const moduleType = await this.prisma.moduleType.findUnique({
      where: { id },
    });
    if (!moduleType) {
      throw new NotFoundException(`Modul-Typ ${id} nicht gefunden.`);
    }
    return moduleType;
  }
}
