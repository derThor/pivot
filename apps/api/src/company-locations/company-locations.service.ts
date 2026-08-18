import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyLocationDto } from './dto/create-company-location.dto';
import { UpdateCompanyLocationDto } from './dto/update-company-location.dto';

@Injectable()
export class CompanyLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    // Hauptsitz zuerst, danach neueste zuerst – deckt sich mit der
    // Bildvorlage (Hauptsitz immer oben in der Liste).
    return this.prisma.companyLocation.findMany({
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  private async findOneRaw(id: string) {
    const location = await this.prisma.companyLocation.findUnique({
      where: { id },
    });
    if (!location) {
      throw new NotFoundException(`Standort ${id} nicht gefunden.`);
    }
    return location;
  }

  async create(dto: CreateCompanyLocationDto) {
    if (dto.isPrimary) {
      await this.clearPrimary();
    }
    return this.prisma.companyLocation.create({ data: dto });
  }

  async update(id: string, dto: UpdateCompanyLocationDto) {
    await this.findOneRaw(id);
    if (dto.isPrimary) {
      await this.clearPrimary();
    }
    return this.prisma.companyLocation.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOneRaw(id);
    await this.prisma.companyLocation.delete({ where: { id } });
  }

  // Genau ein Standort darf gleichzeitig "Hauptsitz" sein (Nutzervorgabe,
  // 2026-08-17, 1:1 nach Bildvorlage – genau ein grünes "Hauptsitz"-Badge).
  private async clearPrimary() {
    await this.prisma.companyLocation.updateMany({
      where: { isPrimary: true },
      data: { isPrimary: false },
    });
  }
}
