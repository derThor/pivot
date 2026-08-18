import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDataProcessorDto } from './dto/create-data-processor.dto';
import { UpdateDataProcessorDto } from './dto/update-data-processor.dto';

@Injectable()
export class DataProcessorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.dataProcessor.findMany({ orderBy: { name: 'asc' } });
  }

  private async findOneRaw(id: string) {
    const row = await this.prisma.dataProcessor.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Auftragsverarbeiter ${id} nicht gefunden.`);
    }
    return row;
  }

  create(dto: CreateDataProcessorDto) {
    return this.prisma.dataProcessor.create({
      data: {
        ...dto,
        contractDate: dto.contractDate ? new Date(dto.contractDate) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateDataProcessorDto) {
    await this.findOneRaw(id);
    return this.prisma.dataProcessor.update({
      where: { id },
      data: {
        ...dto,
        contractDate: dto.contractDate ? new Date(dto.contractDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOneRaw(id);
    await this.prisma.dataProcessor.delete({ where: { id } });
  }
}
