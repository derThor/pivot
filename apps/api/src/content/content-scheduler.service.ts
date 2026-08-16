import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContentService } from './content.service';

/**
 * Schaltet fällige `SCHEDULED`-Inhalte automatisch auf `PUBLISHED`, sobald
 * ihr `scheduledFor`-Zeitpunkt erreicht ist. Läuft jede Minute – für
 * redaktionelle Veröffentlichungstermine (typischerweise minuten- bis
 * stundengenau geplant) ausreichend genau, ohne einen separaten Redis/
 * BullMQ-Queue-Betrieb nur für diesen einen periodischen Job zu benötigen
 * (Redis ist im Projekt aktuell ohnehin noch nicht angebunden, siehe
 * Phase 3 der Roadmap).
 */
@Injectable()
export class ContentSchedulerService {
  private readonly logger = new Logger(ContentSchedulerService.name);

  constructor(private readonly contentService: ContentService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async publishDueScheduled() {
    const count = await this.contentService.publishDueScheduled();
    if (count > 0) {
      this.logger.log(
        `${count} geplante Inhalt(e) automatisch veröffentlicht.`,
      );
    }
  }
}
