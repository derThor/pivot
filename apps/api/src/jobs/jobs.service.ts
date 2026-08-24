import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';
import {
  SETTINGS_ENTITY_ID,
  SETTINGS_ENTITY_TYPE,
  SettingsService,
} from '../settings/settings.service';
import { MailerService } from '../mailer/mailer.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ContentService } from '../content/content.service';
import { DeletionRequestReminderSchedulerService } from '../deletion-requests/deletion-request-reminder-scheduler.service';
import { PrivacyReportSchedulerService } from '../privacy/privacy-report-scheduler.service';
import { LICENSE_CHECK_JOB_ID } from '../license-client/license-client.service';
import { WEBSITE_MONITOR_JOB_ID } from '../websites/website-monitor.service';
import { UpdateJobDto } from './dto/update-job.dto';

// Nur für die Anzeige in "Letzte Läufe" (siehe findRecentRuns()) – bewusst
// NICHT Teil von `definitions` unten: die Lizenzprüfung und die
// Live-Überwachung gesperrter Websites dürfen sich nicht pausieren oder
// umplanen lassen (das würde die Durchsetzung untergraben, die sie
// eigentlich sicherstellen), tauchen deshalb auch nicht unter "Geplante
// Aufgaben" auf. Rein lesbare Historie.
const READ_ONLY_JOB_TITLES: Record<string, string> = {
  [LICENSE_CHECK_JOB_ID]: 'Lizenzprüfung (Client)',
  [WEBSITE_MONITOR_JOB_ID]: 'Live-Überwachung gesperrter Websites (Master)',
};

interface JobDefinition {
  id: string;
  title: string;
  description: string;
  defaultCronExpression: string;
  run: () => Promise<string>;
}

/**
 * "Jobs"-Reiter unter Einstellungen (Nutzervorgabe, 2026-08-22, 1:1 nach
 * Bildvorlage "Geplante Aufgaben"/"Letzte Läufe"). Ersetzt die bisherigen
 * statischen `@Cron()`-Dekoratoren in ContentSchedulerService (gelöscht,
 * Logik hier direkt über ContentService)/DeletionRequestReminderScheduler
 * Service/PrivacyReportSchedulerService durch dynamische, zur Laufzeit
 * editierbare Cron-Jobs über `SchedulerRegistry` – nötig, damit ein Admin
 * den Zeitplan über die UI ändern kann, ohne einen Deploy zu brauchen.
 * NUR diese drei real vorhandenen Jobs (siehe `definitions` unten) –
 * bewusst keine Bildvorlage-Jobs ohne echte Grundlage in dieser App
 * (Papierkorb-Auto-Löschung, Sitemap/Suchindex, Link-Check, Backup).
 */
@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  private readonly definitions: JobDefinition[] = [
    {
      id: 'content-publish',
      title: 'Geplante Inhalte veröffentlichen',
      description:
        'Setzt Inhalte mit erreichtem Veröffentlichungstermin automatisch auf veröffentlicht.',
      defaultCronExpression: '* * * * *',
      run: async () => {
        const count = await this.contentService.publishDueScheduled();
        return count > 0
          ? `${count} Inhalt(e) veröffentlicht.`
          : 'Keine fälligen Inhalte.';
      },
    },
    {
      id: 'dsr-deadline-reminder',
      title: 'Löschanfragen-Fristerinnerung',
      description:
        'Erinnert den Datenschutzbeauftragten 7 Tage vor Fristende offener Betroffenenanfragen.',
      defaultCronExpression: '0 6 * * *',
      run: () => this.dsrReminder.sendDeadlineReminders(),
    },
    {
      id: 'dpo-monthly-report',
      title: 'DSB-Monatsbericht',
      description:
        'Verschickt den Datenschutz-Monatsbericht per E-Mail an den Datenschutzbeauftragten.',
      defaultCronExpression: '0 0 1 * *',
      run: () => this.dpoReport.sendMonthlyReport(),
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
    private readonly contentService: ContentService,
    private readonly dsrReminder: DeletionRequestReminderSchedulerService,
    private readonly dpoReport: PrivacyReportSchedulerService,
    private readonly auditLog: AuditLogService,
  ) {}

  async onModuleInit() {
    for (const def of this.definitions) {
      const row = await this.prisma.scheduledJob.upsert({
        where: { id: def.id },
        update: {},
        create: { id: def.id, cronExpression: def.defaultCronExpression },
      });
      this.registerCron(def, row.cronExpression);
    }
  }

  private assertValidCron(cronExpression: string) {
    try {
      new CronJob(cronExpression, () => {});
    } catch (err) {
      throw new BadRequestException(
        `Ungültiger Cron-Ausdruck: ${(err as Error).message}`,
      );
    }
  }

  private registerCron(def: JobDefinition, cronExpression: string) {
    if (this.schedulerRegistry.doesExist('cron', def.id)) {
      this.schedulerRegistry.deleteCronJob(def.id);
    }
    const job = new CronJob(cronExpression, () => this.execute(def, false));
    this.schedulerRegistry.addCronJob(def.id, job);
    job.start();
  }

  /** Führt einen Job aus und protokolliert das Ergebnis. `force=true`
   * (Button "Jetzt ausführen") überspringt die Pause-Prüfung bewusst –
   * eine manuelle Anfrage soll immer funktionieren, unabhängig vom
   * automatischen Zeitplan. Ein automatisch übersprungener Lauf
   * (pausiert) erzeugt bewusst KEINEN JobRun-Eintrag ("wird übersprungen,
   * nicht nachgeholt" laut Bildvorlage). */
  private async execute(def: JobDefinition, force: boolean) {
    const row = await this.prisma.scheduledJob.findUniqueOrThrow({
      where: { id: def.id },
    });
    if (!force && !row.isCritical) {
      const settings = await this.settings.get();
      if (row.isPaused || settings.jobsGloballyPaused) return;
    }

    const startedAt = new Date();
    let status: 'success' | 'error' = 'success';
    let message: string;
    try {
      message = await def.run();
    } catch (err) {
      status = 'error';
      message = (err as Error).message;
      this.logger.error(`Job "${def.id}" fehlgeschlagen: ${message}`);
    }
    const durationMs = Date.now() - startedAt.getTime();

    await this.prisma.$transaction([
      this.prisma.jobRun.create({
        data: { jobId: def.id, startedAt, durationMs, status, message },
      }),
      this.prisma.scheduledJob.update({
        where: { id: def.id },
        data: {
          lastRunAt: startedAt,
          lastRunDurationMs: durationMs,
          lastRunStatus: status,
          lastRunMessage: message,
          totalRuns: { increment: 1 },
          ...(status === 'error' ? { totalErrors: { increment: 1 } } : {}),
        },
      }),
    ]);

    if (status === 'error' && row.notifyOnFailure) {
      const settings = await this.settings.get();
      if (settings.notificationRecipientEmail) {
        await this.mailer.sendSystemNotificationEmail(
          settings.notificationRecipientEmail,
          {
            title: `Job fehlgeschlagen: ${def.title}`,
            description: message,
            actionLabel: 'Jobs öffnen',
            actionUrl: '/dashboard/settings?section=jobs',
          },
        );
      }
    }
  }

  private toDto(
    def: JobDefinition,
    row: {
      cronExpression: string;
      isPaused: boolean;
      isCritical: boolean;
      notifyOnFailure: boolean;
      lastRunAt: Date | null;
      lastRunDurationMs: number | null;
      lastRunStatus: string | null;
      lastRunMessage: string | null;
      totalRuns: number;
      totalErrors: number;
    },
    globalPaused: boolean,
  ) {
    let nextRunAt: string | null = null;
    try {
      nextRunAt = this.schedulerRegistry
        .getCronJob(def.id)
        .nextDate()
        .toJSDate()
        .toISOString();
    } catch {
      nextRunAt = null;
    }
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      cronExpression: row.cronExpression,
      isPaused: row.isPaused,
      isCritical: row.isCritical,
      notifyOnFailure: row.notifyOnFailure,
      effectivelyPaused: !row.isCritical && (row.isPaused || globalPaused),
      lastRunAt: row.lastRunAt,
      lastRunDurationMs: row.lastRunDurationMs,
      lastRunStatus: row.lastRunStatus,
      lastRunMessage: row.lastRunMessage,
      totalRuns: row.totalRuns,
      totalErrors: row.totalErrors,
      nextRunAt,
    };
  }

  async findAll(page: number, pageSize: number) {
    const [rows, settings] = await Promise.all([
      this.prisma.scheduledJob.findMany(),
      this.settings.get(),
    ]);
    const total = this.definitions.length;
    const pageDefs = this.definitions.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );
    const items = pageDefs.map((def) => {
      const row = rows.find((r) => r.id === def.id);
      if (!row)
        throw new NotFoundException(`Job "${def.id}" nicht initialisiert.`);
      return this.toDto(def, row, settings.jobsGloballyPaused);
    });
    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  private getDefinition(id: string): JobDefinition {
    const def = this.definitions.find((d) => d.id === id);
    if (!def) throw new NotFoundException('Unbekannter Job.');
    return def;
  }

  async update(id: string, dto: UpdateJobDto) {
    const def = this.getDefinition(id);
    const current = await this.prisma.scheduledJob.findUniqueOrThrow({
      where: { id },
    });
    if (dto.cronExpression !== undefined) {
      this.assertValidCron(dto.cronExpression);
    }
    const willBeCritical = dto.isCritical ?? current.isCritical;

    const updated = await this.prisma.scheduledJob.update({
      where: { id },
      data: {
        ...(dto.cronExpression !== undefined
          ? { cronExpression: dto.cronExpression }
          : {}),
        ...(dto.isCritical !== undefined ? { isCritical: dto.isCritical } : {}),
        ...(dto.notifyOnFailure !== undefined
          ? { notifyOnFailure: dto.notifyOnFailure }
          : {}),
        // Kritische Jobs lassen sich nicht pausieren (siehe Schema-
        // Kommentar) – ein gleichzeitig übergebenes isPaused:true wird für
        // einen (neu) kritischen Job ignoriert statt einen Fehler zu werfen.
        ...(dto.isPaused !== undefined
          ? { isPaused: willBeCritical ? false : dto.isPaused }
          : willBeCritical && current.isPaused
            ? { isPaused: false }
            : {}),
      },
    });

    if (dto.cronExpression !== undefined) {
      this.registerCron(def, updated.cronExpression);
    }

    const settings = await this.settings.get();
    return this.toDto(def, updated, settings.jobsGloballyPaused);
  }

  async runNow(id: string) {
    const def = this.getDefinition(id);
    await this.execute(def, true);
    const [row, settings] = await Promise.all([
      this.prisma.scheduledJob.findUniqueOrThrow({ where: { id } }),
      this.settings.get(),
    ]);
    return this.toDto(def, row, settings.jobsGloballyPaused);
  }

  /** "Letzte Läufe"-Karte – über ALLE Jobs hinweg, neueste zuerst, mit
   * Pagination (Nutzervorgabe, 2026-08-22: "bei den letzte läufe
   * pagination beachten"). */
  async findRecentRuns(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.jobRun.findMany({
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.jobRun.count(),
    ]);
    const titleById = new Map([
      ...this.definitions.map((d): [string, string] => [d.id, d.title]),
      ...Object.entries(READ_ONLY_JOB_TITLES),
    ]);
    return {
      items: items.map((run) => ({
        id: run.id,
        jobId: run.jobId,
        jobTitle: titleById.get(run.jobId) ?? run.jobId,
        startedAt: run.startedAt,
        durationMs: run.durationMs,
        status: run.status,
        message: run.message,
      })),
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  /** "Alle löschen" bei "Letzte Läufe" (Nutzervorgabe, 2026-08-22) –
   * löscht die komplette Lauf-Historie über alle Jobs hinweg UND setzt
   * die zwischengespeicherten Aggregat-Felder auf `ScheduledJob`
   * (`lastRunAt`/`totalRuns`/`totalErrors`/...) zurück, sonst würde die
   * "Geplante Aufgaben"-Karte weiterhin alte Werte zeigen, obwohl die
   * zugrunde liegende Historie gerade geleert wurde. */
  async deleteAllRuns(actingUserId: string) {
    const { count } = await this.prisma.jobRun.deleteMany();
    await this.prisma.scheduledJob.updateMany({
      data: {
        lastRunAt: null,
        lastRunDurationMs: null,
        lastRunStatus: null,
        lastRunMessage: null,
        totalRuns: 0,
        totalErrors: 0,
      },
    });
    // Landet im "Protokoll"-Tab unter Einstellungen (Nutzervorgabe,
    // 2026-08-22: "letzte läufe alle löschen muss mit in das protokoll") –
    // ohne `metadata.field` würde settings-protocol-card.tsx nur den
    // rohen Action-String anzeigen, siehe dortiges `ACTION_LABELS`.
    await this.auditLog.record({
      action: 'settings.job_runs_deleted',
      entityType: SETTINGS_ENTITY_TYPE,
      entityId: SETTINGS_ENTITY_ID,
      userId: actingUserId,
      metadata: { count },
    });
  }

  /** "Letztes Protokoll"-Dialog – auf einen Job gefiltert. */
  async findRunsForJob(id: string, page: number, pageSize: number) {
    this.getDefinition(id);
    const [items, total] = await Promise.all([
      this.prisma.jobRun.findMany({
        where: { jobId: id },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.jobRun.count({ where: { jobId: id } }),
    ]);
    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
}
