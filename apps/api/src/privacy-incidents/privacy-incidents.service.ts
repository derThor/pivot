import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MailerService } from '../mailer/mailer.service';
import { CreatePrivacyIncidentDto } from './dto/create-privacy-incident.dto';
import { UpdatePrivacyIncidentDto } from './dto/update-privacy-incident.dto';

@Injectable()
export class PrivacyIncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
  ) {}

  findAll() {
    return this.prisma.privacyIncident.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private async findOneRaw(id: string) {
    const row = await this.prisma.privacyIncident.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Vorfall ${id} nicht gefunden.`);
    }
    return row;
  }

  async create(dto: CreatePrivacyIncidentDto) {
    const created = await this.prisma.privacyIncident.create({
      data: {
        ...dto,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
    });

    const settings = await this.settings.get();
    if (settings.dpoNotifyOnIncident && settings.dpoEmail) {
      await this.mailer.sendDpoIncidentNotification(settings.dpoEmail, created);
    }

    return created;
  }

  async update(id: string, dto: UpdatePrivacyIncidentDto) {
    await this.findOneRaw(id);
    const resolvedAt = dto.status === 'resolved' ? new Date() : undefined;
    return this.prisma.privacyIncident.update({
      where: { id },
      data: {
        ...dto,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        ...(resolvedAt && { resolvedAt }),
      },
    });
  }

  async remove(id: string) {
    await this.findOneRaw(id);
    await this.prisma.privacyIncident.delete({ where: { id } });
  }
}
