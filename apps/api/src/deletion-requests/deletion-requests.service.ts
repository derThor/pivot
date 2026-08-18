import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';
import { UpdateDeletionRequestDto } from './dto/update-deletion-request.dto';

@Injectable()
export class DeletionRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.deletionRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private async findOneRaw(id: string) {
    const row = await this.prisma.deletionRequest.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Löschanfrage ${id} nicht gefunden.`);
    }
    return row;
  }

  create(dto: CreateDeletionRequestDto) {
    return this.prisma.deletionRequest.create({
      data: { ...dto, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined },
    });
  }

  async update(id: string, dto: UpdateDeletionRequestDto) {
    await this.findOneRaw(id);
    // Setzt completedAt automatisch, wenn der Status auf "erledigt"/
    // "abgelehnt" wechselt und noch kein Zeitpunkt gesetzt ist – kein
    // manuelles Datumsfeld für einen ohnehin ableitbaren Wert.
    const completedAt =
      (dto.status === 'completed' || dto.status === 'rejected') ?
        new Date()
      : undefined;
    return this.prisma.deletionRequest.update({
      where: { id },
      data: {
        ...dto,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        ...(completedAt && { completedAt }),
      },
    });
  }

  async remove(id: string) {
    await this.findOneRaw(id);
    await this.prisma.deletionRequest.delete({ where: { id } });
  }
}
