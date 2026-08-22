import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { join } from 'node:path';
import archiver from 'archiver';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { MediaService } from '../media/media.service';
import { UPLOAD_DIR } from '../media/media.config';
import { CreateDataProcessorDto } from './dto/create-data-processor.dto';
import { UpdateDataProcessorDto } from './dto/update-data-processor.dto';

@Injectable()
export class DataProcessorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly media: MediaService,
  ) {}

  private readonly contractMediaInclude = {
    contractMedia: {
      select: { id: true, filename: true, url: true, size: true },
    },
  } as const;

  findAll() {
    return this.prisma.dataProcessor.findMany({
      orderBy: { name: 'asc' },
      include: this.contractMediaInclude,
    });
  }

  private async findOneRaw(id: string) {
    const row = await this.prisma.dataProcessor.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Auftragsverarbeiter ${id} nicht gefunden.`);
    }
    return row;
  }

  // `include: contractMediaInclude` auf create()/update() (Nutzervorgabe,
  // 2026-08-22: "wenn ich einen av-vertrag hinzufüge, muss ohne neuladen
  // der seite der button zum herunterladen kommen") – ohne das enthielt
  // die Antwort nur die rohe `contractMediaId`, nicht das aufgelöste
  // `contractMedia`-Objekt, auf dem `hasAnyContractFile` im Frontend
  // basiert (privacy-view.tsx). Der Button blieb dadurch bis zum nächsten
  // vollständigen Neuladen unsichtbar.
  create(dto: CreateDataProcessorDto) {
    return this.prisma.dataProcessor.create({
      data: {
        ...dto,
        contractDate: dto.contractDate ? new Date(dto.contractDate) : undefined,
        contractMediaId: dto.contractMediaId || undefined,
      },
      include: this.contractMediaInclude,
    });
  }

  async update(id: string, dto: UpdateDataProcessorDto, actingUserId: string) {
    const existing = await this.findOneRaw(id);
    const nextContractMediaId =
      dto.contractMediaId === undefined
        ? undefined
        : dto.contractMediaId || null;
    // Vertrags-Datei wurde ersetzt oder entfernt (leerer String, siehe
    // Kommentar unten) – die alte Datei liegt sonst als Leiche im
    // geschützten "AVs"-Ordner weiter (Nutzer-Bugreport, 2026-08-22:
    // "wenn av verträge gelöscht werden, müssen die verträge dateien
    // auch entfernt werden"). In den Papierkorb statt hart löschen,
    // gleiche Konvention wie überall sonst in dieser App.
    if (
      nextContractMediaId !== undefined &&
      existing.contractMediaId &&
      existing.contractMediaId !== nextContractMediaId
    ) {
      await this.media.remove(existing.contractMediaId, actingUserId);
    }
    return this.prisma.dataProcessor.update({
      where: { id },
      data: {
        ...dto,
        contractDate: dto.contractDate ? new Date(dto.contractDate) : undefined,
        // Leerer String = Vertrags-Datei bewusst entfernt (Frontend
        // schickt "" statt das Feld wegzulassen, siehe DataProcessorDialog).
        contractMediaId: nextContractMediaId,
      },
      include: this.contractMediaInclude,
    });
  }

  async remove(id: string, actingUserId: string) {
    const existing = await this.findOneRaw(id);
    if (existing.contractMediaId) {
      // Gleicher Grund wie in update() oben – die verknüpfte AV-Vertrag-
      // Datei darf nicht als Leiche im "AVs"-Ordner zurückbleiben, sonst
      // taucht sie in streamContractsZip() weiterhin auf, obwohl der
      // zugehörige Auftragsverarbeiter-Datensatz längst gelöscht ist.
      await this.media.remove(existing.contractMediaId, actingUserId);
    }
    await this.prisma.dataProcessor.delete({ where: { id } });
  }

  /** "AV-Vertrag anfordern" (Auftragsverarbeiter-Tab, Karte "Offene
   * Punkte", Nutzervorgabe 2026-08-20): Dev-Stub-Mail wie überall in
   * dieser App, kein echtes SMTP. Braucht eine hinterlegte Kontakt-
   * E-Mail-Adresse – ohne die gibt es keinen bekannten Empfänger, ein
   * generisches "an wen auch immer" wäre keine echte Anfrage. */
  async requestContract(id: string) {
    const row = await this.findOneRaw(id);
    if (!row.contactEmail) {
      throw new BadRequestException(
        'Keine Kontakt-E-Mail hinterlegt – bitte zuerst beim Bearbeiten ergänzen.',
      );
    }
    await this.mailer.sendDataProcessorContractRequest(
      row.contactEmail,
      row.name,
    );
  }

  /** "AV-Vertrag herunterladen" (Datenschutz → Rechtstexte →
   * Betroffenenrechte, Nutzervorgabe 2026-08-19): zippt den gesamten
   * geschützten "AVs"-Medienordner (siehe seed.ts), nicht gezielt die
   * `contractMedia`-Relation einzelner Auftragsverarbeiter – so werden
   * auch Verträge erfasst, die direkt im Ordner statt über einen
   * bestimmten Auftragsverarbeiter-Datensatz hochgeladen wurden. */
  async streamContractsZip(res: Response) {
    const folder = await this.prisma.mediaFolder.findFirst({
      where: { name: 'AVs', isSystem: true },
    });
    const files = folder
      ? await this.prisma.media.findMany({
          where: { folderId: folder.id, deletedAt: null },
        })
      : [];

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="av-vertraege.zip"',
    );

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    for (const file of files) {
      const filePath = join(UPLOAD_DIR, file.url.replace(/^\/uploads\//, ''));
      archive.file(filePath, { name: file.filename });
    }
    await archive.finalize();
  }
}
