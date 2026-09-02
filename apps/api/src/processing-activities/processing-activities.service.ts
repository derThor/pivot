import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProcessingActivityDto } from './dto/create-processing-activity.dto';
import { UpdateProcessingActivityDto } from './dto/update-processing-activity.dto';

@Injectable()
export class ProcessingActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.processingActivity.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findOneRaw(id: string) {
    const row = await this.prisma.processingActivity.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException(
        `Verarbeitungstätigkeit ${id} nicht gefunden.`,
      );
    }
    return row;
  }

  create(dto: CreateProcessingActivityDto) {
    return this.prisma.processingActivity.create({ data: dto });
  }

  async update(id: string, dto: UpdateProcessingActivityDto) {
    await this.findOneRaw(id);
    return this.prisma.processingActivity.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOneRaw(id);
    await this.prisma.processingActivity.delete({ where: { id } });
  }
}
