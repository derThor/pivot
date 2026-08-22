import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MailerService } from '../mailer/mailer.service';

/**
 * Betroffenenanfragen-Log, Schalter "Erinnerung 7 Tage vor Fristende"
 * (Nutzervorgabe, 2026-08-19) – gleiches Cron-Muster wie
 * `PrivacyReportSchedulerService`, läuft aber täglich statt monatlich, da
 * Fristen laufend ablaufen. `reminderSentAt` verhindert doppelten Versand
 * an aufeinanderfolgenden Tagen.
 */
@Injectable()
export class DeletionRequestReminderSchedulerService {
  private readonly logger = new Logger(
    DeletionRequestReminderSchedulerService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async sendDeadlineReminders() {
    const settings = await this.settings.get();
    if (!settings.dsrDeadlineReminderEnabled || !settings.dpoEmail) return;

    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const due = await this.prisma.deletionRequest.findMany({
      where: {
        status: { in: ['open', 'in_progress'] },
        dueAt: { lte: in7Days, gte: new Date() },
        reminderSentAt: null,
      },
    });

    for (const row of due) {
      await this.mailer.sendDeletionRequestDeadlineReminder(
        settings.dpoEmail,
        row.dsrId,
        row.dueAt!,
      );
      await this.prisma.deletionRequest.update({
        where: { id: row.id },
        data: { reminderSentAt: new Date() },
      });
    }
    if (due.length > 0) {
      this.logger.log(`${due.length} Fristerinnerung(en) versendet.`);
    }
  }
}
