import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { QueryWebhookDto } from './dto/query-webhook.dto';

const DISPATCH_TIMEOUT_MS = 5000;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryWebhookDto) {
    const { page, pageSize } = query;
    const [items, total, failingCount] = await Promise.all([
      this.prisma.webhook.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.webhook.count(),
      this.prisma.webhook.count({ where: { consecutiveFailures: { gt: 0 } } }),
    ]);
    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
        failingCount,
      },
    };
  }

  create(dto: CreateWebhookDto) {
    return this.prisma.webhook.create({ data: dto });
  }

  update(id: string, dto: UpdateWebhookDto) {
    return this.prisma.webhook.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.webhook.delete({ where: { id } });
  }

  /**
   * Feuert ein Event an alle aktiven, dafür registrierten Webhooks.
   * Bewusst fire-and-forget/best-effort: ein einzelner nicht erreichbarer
   * Webhook-Endpoint darf den eigentlichen Content-Vorgang (Speichern,
   * automatisches Veröffentlichen) niemals blockieren oder fehlschlagen
   * lassen. Fehler werden geloggt, nicht geworfen.
   */
  async dispatch(event: string, payload: Record<string, unknown>) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { isActive: true, events: { has: event } },
    });
    if (webhooks.length === 0) return;

    await Promise.all(
      webhooks.map((webhook) =>
        this.deliver(webhook.id, webhook.url, event, payload),
      ),
    );
  }

  private async deliver(
    webhookId: string,
    url: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, payload }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(
          `Webhook ${url} antwortete mit Status ${res.status} auf Event "${event}".`,
        );
        await this.recordDeliveryResult(
          webhookId,
          false,
          `HTTP ${res.status}`,
        );
        return;
      }
      await this.recordDeliveryResult(webhookId, true, null);
    } catch (error) {
      this.logger.warn(
        `Webhook ${url} für Event "${event}" fehlgeschlagen: ${(error as Error).message}`,
      );
      await this.recordDeliveryResult(
        webhookId,
        false,
        (error as Error).message,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Persistiert das Ergebnis einer Zustellung, damit die Verwaltungs-UI
   * dauerhaft fehlschlagende Webhooks anzeigen kann (Nutzervorgabe,
   * 2026-08-15, Inline-Systemmeldung "N Webhooks schlagen fehl"). Best-
   * effort wie `deliver` selbst: ein Fehler beim Schreiben darf den
   * eigentlichen Dispatch-Vorgang nicht stören.
   */
  private async recordDeliveryResult(
    webhookId: string,
    success: boolean,
    error: string | null,
  ) {
    try {
      await this.prisma.webhook.update({
        where: { id: webhookId },
        data: {
          lastDeliveryStatus: success ? 'success' : 'failure',
          lastDeliveryAt: new Date(),
          lastDeliveryError: error,
          consecutiveFailures: success ? 0 : { increment: 1 },
        },
      });
    } catch (updateError) {
      this.logger.warn(
        `Zustellstatus für Webhook ${webhookId} konnte nicht gespeichert werden: ${(updateError as Error).message}`,
      );
    }
  }
}
