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
    const [items, total] = await Promise.all([
      this.prisma.webhook.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.webhook.count(),
    ]);
    return {
      items,
      meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
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
      webhooks.map((webhook) => this.deliver(webhook.url, event, payload)),
    );
  }

  private async deliver(
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
      }
    } catch (error) {
      this.logger.warn(
        `Webhook ${url} für Event "${event}" fehlgeschlagen: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
