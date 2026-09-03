import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/** Zweck-Marke im Token. Verhindert, dass ein für etwas anderes
 * ausgestelltes Token hier durchkommt. */
export const REVALIDATION_TOKEN_PURPOSE = 'site-revalidate';

const TOKEN_TTL_SECONDS = 60;

/** Mehrere Änderungen kurz hintereinander (Massenaktion, Veröffentlichen
 * mehrerer Seiten) sollen die Website EINMAL anstoßen, nicht zwanzigmal.
 * Kurz genug, dass niemand es merkt. */
const DEBOUNCE_MS = 2000;

/**
 * Sagt der öffentlichen Website Bescheid, dass sich etwas geändert hat
 * (Nutzerentscheidung, 2026-09-03). Bis dahin wurde eine Änderung
 * ausschließlich über den Zeitablauf sichtbar – im ungünstigsten Fall eine
 * Minute später. Seitdem ist der Zeitablauf nur noch das Sicherheitsnetz
 * (siehe Einstellungen → Caching), sichtbar wird die Änderung sofort.
 *
 * **Warum die API der richtige Ort ist und nicht die Administration:**
 * Inhalte werden nicht nur über die Oberfläche veröffentlicht, sondern
 * auch von der geplanten Veröffentlichung (Cron) – dort gibt es keinen
 * angemeldeten Nutzer und keinen Browser, der etwas anstoßen könnte.
 *
 * **Warum ein selbst ausgestelltes Token und kein gemeinsames Geheimnis:**
 * Die Website kann Tokens nicht selbst prüfen (die Signatur ist
 * symmetrisch, den Schlüssel hat nur die API). Sie legt es deshalb der API
 * vor (`POST /public/revalidation-check`). Damit muss niemand eine
 * Variable in zwei Anwendungen gleich halten – dieselbe Überlegung wie
 * beim Knopf in den Einstellungen, siehe
 * knowledge-base/platform/caching.md.
 */
@Injectable()
export class SiteCacheService {
  private readonly logger = new Logger(SiteCacheService.name);
  private pending: NodeJS.Timeout | null = null;
  private pendingReasons = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Fasst Aufrufe innerhalb von {@link DEBOUNCE_MS} zusammen. Bewusst
   * ohne `await` aufzurufen: das Leeren eines fremden Caches darf niemals
   * die Antwort an den Nutzer verzögern oder scheitern lassen. */
  invalidate(reason: string): void {
    this.pendingReasons.add(reason);
    if (this.pending) return;
    this.pending = setTimeout(() => {
      const reasons = [...this.pendingReasons];
      this.pending = null;
      this.pendingReasons.clear();
      void this.send(reasons);
    }, DEBOUNCE_MS);
    // Ein offener Timer darf das Beenden des Prozesses nicht aufhalten
    // (relevant für Tests und einen sauberen Neustart).
    this.pending.unref?.();
  }

  /** Prüft ein Token aus {@link mintToken}. Wird vom öffentlichen
   * Endpunkt aufgerufen, den die Website befragt. */
  verifyToken(token: string): boolean {
    try {
      const payload = this.jwt.verify<{ purpose?: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      return payload.purpose === REVALIDATION_TOKEN_PURPOSE;
    } catch {
      return false;
    }
  }

  private mintToken(): string {
    return this.jwt.sign(
      { purpose: REVALIDATION_TOKEN_PURPOSE },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: TOKEN_TTL_SECONDS,
      },
    );
  }

  /** Dieselbe Staffelung wie in der Administration
   * (apps/web/src/lib/site-base-url.ts), hier ohne den Rückfall auf die
   * eigene Origin: die API kennt die Adresse der Website nicht aus dem
   * eigenen Aufruf, sie wird ja nicht vom Browser der Website gerufen.
   *
   * Läuft eine ZWEITE Installation auf derselben Maschine, muss sie
   * `SITE_URL` setzen – sonst stieße sie die Website der ersten an. */
  private async resolveSiteBaseUrl(): Promise<string | null> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { publicBaseUrl: true },
    });
    const configured =
      settings?.publicBaseUrl?.trim() ||
      this.config.get<string>('SITE_URL')?.trim();
    if (configured) return configured.replace(/\/+$/, '');
    if (process.env.NODE_ENV !== 'production') return 'http://localhost:3002';
    return null;
  }

  private async send(reasons: string[]): Promise<void> {
    const base = await this.resolveSiteBaseUrl();
    if (!base) {
      // Kein Fehler: eine Installation ohne öffentliche Website ist ein
      // gültiger Zustand (reines Backend). Erst gar nicht loslaufen.
      return;
    }
    try {
      const res = await fetch(`${base}/api/revalidate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.mintToken()}` },
      });
      if (!res.ok) {
        this.logger.warn(
          `Webseiten-Cache konnte nicht geleert werden (${base}): HTTP ${res.status}. Auslöser: ${reasons.join(', ')}`,
        );
        return;
      }
      this.logger.log(
        `Webseiten-Cache geleert (${reasons.join(', ')}) — ${base}`,
      );
    } catch (error) {
      // Häufigster Fall: die Website läuft gerade nicht. Das ist kein
      // Grund, irgendetwas anderes scheitern zu lassen – beim nächsten
      // Start ist ihr Cache ohnehin leer.
      this.logger.warn(
        `Webseite unter ${base} nicht erreichbar, Cache nicht geleert. Auslöser: ${reasons.join(', ')} (${(error as Error).message})`,
      );
    }
  }
}
