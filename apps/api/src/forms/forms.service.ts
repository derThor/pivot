import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@pivot/database';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { QueryFormDto } from './dto/query-form.dto';
import { QuerySubmissionsDto } from './dto/query-submissions.dto';
import type { FormField } from './form-field.types';

function fieldValuesToStrings(
  values: Record<string, unknown>,
  fields: FormField[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    if (field.type === 'section') continue;
    const value = values[field.id];
    if (Array.isArray(value)) {
      out[field.id] = value.join(', ');
    } else if (typeof value === 'boolean') {
      out[field.id] = value ? 'Ja' : 'Nein';
    } else if (value == null) {
      out[field.id] = '';
    } else if (typeof value === 'string' || typeof value === 'number') {
      out[field.id] = String(value);
    } else {
      out[field.id] = JSON.stringify(value);
    }
  }
  return out;
}

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  private readonly submissionCountInclude = {
    _count: { select: { submissions: true } },
  } as const;

  async findAll(query: QueryFormDto) {
    const { page, pageSize, status, q } = query;
    const where = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
    };
    const [items, total, unreadByForm] = await Promise.all([
      this.prisma.form.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.submissionCountInclude,
      }),
      this.prisma.form.count({ where }),
      this.prisma.formSubmission.groupBy({
        by: ['formId'],
        where: { isRead: false },
        _count: { _all: true },
      }),
    ]);
    const unreadMap = new Map(
      unreadByForm.map((row) => [row.formId, row._count._all]),
    );
    return {
      items: items.map((form) => ({
        ...form,
        unreadSubmissions: unreadMap.get(form.id) ?? 0,
      })),
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /** Stat-Kacheln der Formulare-Übersicht. */
  async getStats() {
    const [total, published, draft, paused, submissionsLast30Days, unread] =
      await Promise.all([
        this.prisma.form.count({ where: { deletedAt: null } }),
        this.prisma.form.count({
          where: { deletedAt: null, status: 'published' },
        }),
        this.prisma.form.count({
          where: { deletedAt: null, status: 'draft' },
        }),
        this.prisma.form.count({
          where: { deletedAt: null, status: 'paused' },
        }),
        this.prisma.formSubmission.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.formSubmission.count({ where: { isRead: false } }),
      ]);
    return { total, published, draft, paused, submissionsLast30Days, unread };
  }

  private async findOneRaw(id: string) {
    const form = await this.prisma.form.findUnique({ where: { id } });
    if (!form || form.deletedAt) {
      throw new NotFoundException(`Formular ${id} nicht gefunden.`);
    }
    return form;
  }

  async findOne(id: string) {
    const form = await this.findOneRaw(id);
    const submissionCount = await this.prisma.formSubmission.count({
      where: { formId: id },
    });
    return { ...form, submissionCount };
  }

  private async assertSlugAvailable(slug: string, excludeId?: string) {
    const existing = await this.prisma.form.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (existing) {
      throw new BadRequestException(
        'Der Slug wird bereits von einem anderen Formular verwendet.',
      );
    }
  }

  async create(dto: CreateFormDto) {
    await this.assertSlugAvailable(dto.slug);
    // Vorbelegung aus Einstellungen → Mailing → Einsendungen
    // (Nutzervorgabe, 2026-09-02). Greift nur, wenn das Formular selbst
    // nichts mitschickt – bestehende Formulare bleiben unberührt.
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { formSubmissionConfirmationDefault: true },
    });
    return this.prisma.form.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        fields: dto.fields as unknown as Prisma.InputJsonValue,
        emailFieldId: dto.emailFieldId,
        sendConfirmation:
          dto.sendConfirmation ??
          settings?.formSubmissionConfirmationDefault ??
          false,
        submitButtonText: dto.submitButtonText,
        submitButtonAlign: dto.submitButtonAlign,
        redirectUrl: dto.redirectUrl,
      },
    });
  }

  async update(id: string, dto: UpdateFormDto) {
    await this.findOneRaw(id);
    if (dto.slug) {
      await this.assertSlugAvailable(dto.slug, id);
    }
    return this.prisma.form.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        fields: dto.fields as unknown as Prisma.InputJsonValue | undefined,
        emailFieldId: dto.emailFieldId,
        sendConfirmation: dto.sendConfirmation,
        status: dto.status,
        submitButtonText: dto.submitButtonText,
        submitButtonAlign: dto.submitButtonAlign,
        // Leerer String = Weiterleitung bewusst entfernt (Frontend schickt
        // "" statt das Feld wegzulassen), `undefined` = unverändert.
        redirectUrl:
          dto.redirectUrl === undefined ? undefined : dto.redirectUrl || null,
      },
    });
  }

  async remove(id: string, actingUserId: string) {
    await this.findOneRaw(id);
    await this.prisma.form.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actingUserId },
    });
  }

  async restore(id: string) {
    const form = await this.prisma.form.findUnique({ where: { id } });
    if (!form || !form.deletedAt) {
      throw new NotFoundException(
        `Formular ${id} befindet sich nicht im Papierkorb.`,
      );
    }
    return this.prisma.form.update({
      where: { id },
      data: { deletedAt: null, deletedById: null },
    });
  }

  async permanentDelete(id: string) {
    const form = await this.prisma.form.findUnique({ where: { id } });
    if (!form || !form.deletedAt) {
      throw new NotFoundException(
        `Formular ${id} befindet sich nicht im Papierkorb.`,
      );
    }
    // MailTemplate + FormSubmission hängen per `onDelete: Cascade` an
    // Form, siehe schema.prisma.
    await this.prisma.form.delete({ where: { id } });
  }

  /** Ungepaginiert für den vereinheitlichten Papierkorb (`TrashService`). */
  findAllTrashed() {
    return this.prisma.form.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: {
        deletedBy: { select: { id: true, firstName: true, lastName: true } },
        ...this.submissionCountInclude,
      },
    });
  }

  async submissions(formId: string, query: QuerySubmissionsDto) {
    await this.findOneRaw(formId);
    const { page, pageSize, isRead } = query;
    const where = {
      formId,
      ...(isRead !== undefined ? { isRead } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.formSubmission.count({ where }),
    ]);
    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  /** App-weite "Einsendungen"-Sammelübersicht (alle Formulare gemeinsam),
   * gleiches Prinzip wie JobsService.findRecentRuns()/"Letzte Läufe". */
  async allSubmissions(query: QuerySubmissionsDto) {
    const { page, pageSize, isRead } = query;
    const where = isRead !== undefined ? { isRead } : {};
    const [items, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          form: { select: { id: true, name: true, slug: true, fields: true } },
        },
      }),
      this.prisma.formSubmission.count({ where }),
    ]);
    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }

  async markSubmissionRead(
    formId: string,
    submissionId: string,
    isRead: boolean,
  ) {
    const submission = await this.prisma.formSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission || submission.formId !== formId) {
      throw new NotFoundException(`Einsendung ${submissionId} nicht gefunden.`);
    }
    return this.prisma.formSubmission.update({
      where: { id: submissionId },
      data: {
        isRead,
        // Bezugspunkt der automatischen Löschung. Beim Zurücksetzen auf
        // ungelesen bewusst wieder geleert, damit die Frist neu beginnt
        // statt weiterzulaufen (siehe schema.prisma).
        readAt: isRead ? (submission.readAt ?? new Date()) : null,
      },
    });
  }

  async deleteSubmission(formId: string, submissionId: string) {
    const submission = await this.prisma.formSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission || submission.formId !== formId) {
      throw new NotFoundException(`Einsendung ${submissionId} nicht gefunden.`);
    }
    await this.prisma.formSubmission.delete({ where: { id: submissionId } });
  }

  /** Formular-Baustein im Seiten-Designer (`ContentTypeField.type === "form"`,
   * siehe module-field-input.tsx/block-field-output.tsx) – rein lesend,
   * öffentlich (auch für die anonyme Vorschau-Seite `/preview/[token]`),
   * daher keine Submissions/Einstellungen im Rückgabewert. */
  async findPublicById(id: string) {
    const form = await this.prisma.form.findUnique({ where: { id } });
    if (!form || form.deletedAt || form.status !== 'published') {
      throw new NotFoundException(`Formular ${id} ist nicht verfügbar.`);
    }
    return {
      id: form.id,
      name: form.name,
      slug: form.slug,
      fields: form.fields,
      submitButtonText: form.submitButtonText,
      submitButtonAlign: form.submitButtonAlign,
      redirectUrl: form.redirectUrl,
    };
  }

  /** Öffentlicher Formular-Baustein (Seiten-Designer) – unauthentifiziert,
   * hinter dem app-weiten `ThrottlerGuard`. */
  async submit(
    slug: string,
    values: Record<string, unknown>,
    submitterIp: string | null,
  ) {
    const form = await this.prisma.form.findUnique({ where: { slug } });
    if (!form || form.deletedAt || form.status !== 'published') {
      throw new NotFoundException(`Formular "${slug}" ist nicht verfügbar.`);
    }
    const fields = form.fields as unknown as FormField[];
    for (const field of fields) {
      const value = values[field.id];
      const isEmpty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);
      if (field.type !== 'section' && field.required && isEmpty) {
        throw new BadRequestException(
          `Feld "${field.label}" ist erforderlich.`,
        );
      }
      // Boolescher Wert `false` fällt nicht unter `isEmpty` oben (kein
      // undefined/null/leerer String) – eine nicht angehakte
      // Einwilligungs-Checkbox würde die Pflichtfeld-Prüfung sonst
      // fälschlich passieren.
      if (field.type === 'privacy_notice' && field.required && value !== true) {
        throw new BadRequestException(
          `Feld "${field.label}" ist erforderlich.`,
        );
      }
    }

    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: {
        dsbFormStoreSubmissionIp: true,
        notificationRecipientEmail: true,
        formSubmissionNotifyOnNew: true,
        formSubmissionRecipientEmail: true,
      },
    });

    await this.prisma.formSubmission.create({
      data: {
        formId: form.id,
        values: values as unknown as Prisma.InputJsonValue,
        submitterIp: settings?.dsbFormStoreSubmissionIp ? submitterIp : null,
      },
    });

    const stringValues = fieldValuesToStrings(values, fields);

    const adminTemplate = await this.prisma.mailTemplate.findUnique({
      where: {
        formId_formKind: { formId: form.id, formKind: 'admin_notification' },
      },
    });
    // Empfänger-Reihenfolge (Nutzervorgabe, 2026-09-02): der am Formular
    // hinterlegte Empfänger gewinnt, danach der eigene Formular-Empfänger
    // aus Einstellungen → Mailing → Einsendungen, zuletzt wie bisher der
    // allgemeine Benachrichtigungsempfänger.
    const adminTo =
      adminTemplate?.recipientTo ||
      settings?.formSubmissionRecipientEmail ||
      settings?.notificationRecipientEmail;
    // Globaler Aus-Schalter – vorher ging die Mail immer raus, sobald
    // irgendein Empfänger auflösbar war.
    if (settings?.formSubmissionNotifyOnNew !== false && adminTo) {
      await this.mailer.sendFormAdminNotification(
        { id: form.id, name: form.name },
        adminTo,
        stringValues,
      );
    }

    if (form.sendConfirmation && form.emailFieldId) {
      const submitterEmail = values[form.emailFieldId];
      if (typeof submitterEmail === 'string' && submitterEmail) {
        await this.mailer.sendFormConfirmation(
          { id: form.id, name: form.name },
          submitterEmail,
          stringValues,
        );
      }
    }

    return { ok: true };
  }
}
