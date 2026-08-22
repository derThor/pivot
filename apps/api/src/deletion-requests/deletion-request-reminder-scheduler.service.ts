import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MailerService } from '../mailer/mailer.service';

/**
 * Betroffenenanfragen-Log, Schalter "Erinnerung 7 Tage vor Fristende"
 * (Nutzervorgabe, 2026-08-19). `reminderSentAt` verhindert doppelten
 * Versand an aufeinanderfolgenden Tagen. Läuft seit dem "Jobs"-Reiter
 * (Nutzervorgabe, 2026-08-22) nicht mehr über einen eigenen
 * `@Cron()`-Dekorator, sondern wird von `JobsService` dynamisch über
 * `SchedulerRegistry` getriggert (editierbarer Zeitplan) – die
 * Rückgabe ist ein kurzer Klartext-Status für den zugehörigen Job-Lauf.
 */
@Injectable()
export class DeletionRequestReminderSchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
  ) {}

  async sendDeadlineReminders(): Promise<string> {
    const settings = await this.settings.get();
    if (!settings.dsrDeadlineReminderEnabled) {
      return 'Übersprungen: Automatik deaktiviert.';
    }
    if (!settings.dpoEmail) {
      return 'Übersprungen: kein DSB-Kontakt hinterlegt.';
    }

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
    return due.length > 0
      ? `${due.length} Fristerinnerung(en) versendet.`
      : 'Keine fälligen Fristerinnerungen.';
  }
}
