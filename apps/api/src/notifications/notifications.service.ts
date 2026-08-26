import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SettingsService,
  COMPANY_FIELD_KEYS,
} from '../settings/settings.service';
import { MediaService } from '../media/media.service';
import { TrashService } from '../trash/trash.service';
import { UsersService } from '../users/users.service';
import { LegalDocumentsService } from '../legal-documents/legal-documents.service';
import { MailerService } from '../mailer/mailer.service';
import { TRASH_TYPES, type TrashType } from '../trash/trash.types';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import type { AppSettings } from '@pivot/database';

export type NotificationCategory =
  'system' | 'security' | 'privacy' | 'accounts';

type Candidate = {
  category: NotificationCategory;
  dedupeKey: string;
  title: string;
  description: string;
  isUrgent: boolean;
  actionLabel: string;
  actionUrl: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Ordnet eine gespeicherte Zeile (über ihren `dedupeKey`-Präfix) dem
// `notify*`-Schalter zu, der sie erzeugt hat. Nötig, weil `sync()` nur
// NEUE Zeilen anhand des aktuellen Schalterstands anlegt, bestehende
// Zeilen aber nicht rückwirkend löscht, wenn der Schalter später
// ausgeschaltet wird – ohne diese Zuordnung würde eine bereits erzeugte
// Meldung stehen bleiben, obwohl die Kategorie deaktiviert wurde
// (Nutzer-Bugreport, 2026-08-21: "ich habe speicher voll warnung
// deaktiviert, dennoch ist die nachricht da"). `findAll()` blendet
// bestehende Zeilen ihrer jetzt deaktivierten Kategorie aus, statt sie
// zu löschen (taucht sofort wieder auf, sobald der Schalter wieder an
// ist, inkl. unverändertem Gelesen-Status).
function settingKeyFor(dedupeKey: string): keyof AppSettings | null {
  if (dedupeKey === 'maintenance-mode') return 'notifyMaintenanceMode';
  if (dedupeKey === 'storage-quota') return 'notifyStorageQuota';
  if (dedupeKey.startsWith('webhook-failure:')) return 'notifyWebhookFailures';
  if (dedupeKey === 'trash-expiring') return 'notifyTrashExpiring';
  if (dedupeKey === 'company-incomplete') return 'notifyCompanyIncomplete';
  if (dedupeKey === 'legal-documents-stale') return 'notifyLegalDocuments';
  if (dedupeKey.startsWith('dsr-due:')) return 'notifyDeletionRequests';
  if (dedupeKey === 'pending-activations') return 'notifyPendingActivations';
  if (dedupeKey === 'failed-logins') return 'notifyFailedLogins';
  if (dedupeKey === 'pending-password-changes')
    return 'notifyPendingPasswordChanges';
  // Unbekannter/zukünftiger Schlüssel: nicht ausblenden können, statt eine
  // Meldung fälschlich verschwinden zu lassen.
  return null;
}

/** Benachrichtigungs-Postfach (Nutzervorgabe, 2026-08-21, 1:1 nach
 * Bildvorlage). `sync()` prüft dieselben Bedingungen, die vorher
 * `system-messages/page.tsx` live berechnet hat (siehe dort für die
 * Referenz-Logik vor diesem Umbau), und legt für jede zutreffende
 * Bedingung genau einmal eine `Notification`-Zeile an (Dedupe über
 * `[userId, dedupeKey]`) – Gelesen-/Erledigt-Status bleibt dadurch über
 * mehrere Seitenaufrufe hinweg erhalten, statt bei jedem Laden neu
 * berechnet (und damit vergessen) zu werden. Bewusst nur vier Kategorien
 * mit echter Datengrundlage (system/security/privacy/accounts) – siehe
 * ausführliche Begründung im Schema-Kommentar bei `model Notification`. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly media: MediaService,
    private readonly trash: TrashService,
    private readonly users: UsersService,
    private readonly legalDocuments: LegalDocumentsService,
    private readonly mailer: MailerService,
  ) {}

  private async buildCandidates(user: JwtPayload): Promise<Candidate[]> {
    const permissions = user.permissions ?? [];
    const canViewUsers = permissions.includes('users:read');
    const canViewPrivacy = permissions.includes('privacy:read');
    const readableTrashTypes = TRASH_TYPES.filter((t: TrashType) =>
      permissions.includes(`${t}:read`),
    );

    const settings = await this.settings.get();
    const candidates: Candidate[] = [];

    if (settings.notifyMaintenanceMode && settings.maintenanceModeEnabled) {
      candidates.push({
        category: 'system',
        dedupeKey: 'maintenance-mode',
        title: 'Wartungsmodus ist aktiv',
        description:
          'Die Website ist aktuell im Wartungsmodus und für Besucher nicht erreichbar.',
        isUrgent: false,
        actionLabel: 'Einstellungen öffnen',
        actionUrl: '/dashboard/settings',
      });
    }

    if (settings.notifyStorageQuota) {
      const usage = await this.media.getStorageUsage();
      if (usage.percentUsed != null && usage.percentUsed >= 90) {
        const rounded = Math.round(usage.percentUsed);
        candidates.push({
          category: 'system',
          dedupeKey: 'storage-quota',
          title: `Medien-Kontingent zu ${rounded} % ausgelastet`,
          description:
            'Das Speicherkontingent für Medien ist fast ausgeschöpft.',
          isUrgent: usage.percentUsed >= 98,
          actionLabel: 'Medien ansehen',
          actionUrl: '/dashboard/media',
        });
      }
    }

    if (settings.notifyWebhookFailures) {
      const failing = await this.prisma.webhook.findMany({
        where: { consecutiveFailures: { gt: 0 } },
      });
      for (const hook of failing) {
        candidates.push({
          category: 'system',
          dedupeKey: `webhook-failure:${hook.id}`,
          title: `Webhook „${hook.url}“ schlägt fehl`,
          description: hook.lastDeliveryError
            ? `${hook.consecutiveFailures}× in Folge fehlgeschlagen: ${hook.lastDeliveryError}`
            : `${hook.consecutiveFailures}× in Folge fehlgeschlagen.`,
          isUrgent: hook.consecutiveFailures >= 3,
          actionLabel: 'Webhook öffnen',
          actionUrl: '/dashboard/settings?section=webhooks',
        });
      }
    }

    // Master-seitige Live-Überwachung gesperrter Websites (Nutzervorgabe,
    // 2026-08-24: regelmäßiger Test, ob eine als "locked" markierte Seite
    // trotzdem noch normal erreichbar ist) – siehe WebsiteMonitorService,
    // das `lastLiveCheckAnomaly` im Hintergrund setzt.
    if (settings.notifyWebsiteAnomaly) {
      const anomalousWebsites = await this.prisma.website.findMany({
        where: { status: 'locked', lastLiveCheckAnomaly: true },
      });
      for (const site of anomalousWebsites) {
        candidates.push({
          category: 'system',
          dedupeKey: `website-anomaly:${site.id}`,
          title: `„${site.name}“ ist gesperrt, aber weiterhin live erreichbar`,
          description: `${site.domain} antwortet trotz Sperre normal statt mit der Wartungsseite – die Sperre wird dort offenbar nicht durchgesetzt.`,
          isUrgent: true,
          actionLabel: 'Website öffnen',
          actionUrl: '/dashboard/websites',
        });
      }
    }

    if (settings.notifyTrashExpiring && readableTrashTypes.length > 0) {
      const trash = await this.trash.list({ types: readableTrashTypes });
      if (trash.stats.expiringSoonCount > 0) {
        candidates.push({
          category: 'system',
          dedupeKey: 'trash-expiring',
          title: `${trash.stats.expiringSoonCount} Papierkorb-Einträge laufen bald ab`,
          description: `Werden nach Ablauf der Aufbewahrungsfrist (${trash.stats.retentionDays} Tage) für die Wiederherstellung gesperrt.`,
          isUrgent: false,
          actionLabel: 'Papierkorb ansehen',
          actionUrl: '/dashboard/trash',
        });
      }
    }

    if (settings.notifyCompanyIncomplete) {
      const missing = COMPANY_FIELD_KEYS.filter((k) => !settings[k]).length;
      if (missing > 0) {
        candidates.push({
          category: 'privacy',
          dedupeKey: 'company-incomplete',
          title: `${missing} Pflichtangabe${missing === 1 ? '' : 'n'} in den Firmendaten ${missing === 1 ? 'fehlt' : 'fehlen'}`,
          description: 'Wirkt sich auf Impressum und Rechtstexte aus.',
          isUrgent: false,
          actionLabel: 'Firmendaten öffnen',
          actionUrl: '/dashboard/company',
        });
      }
    }

    if (canViewPrivacy && settings.notifyLegalDocuments) {
      const docs = await this.legalDocuments.findAll();
      const stale = docs.filter((d) => d.status !== 'current');
      if (stale.length > 0) {
        candidates.push({
          category: 'privacy',
          dedupeKey: 'legal-documents-stale',
          title: `${stale.length} Rechtstext${stale.length === 1 ? '' : 'e'} veraltet oder fehlend`,
          description: stale.map((d) => d.title).join(', '),
          isUrgent: false,
          actionLabel: 'Rechtstexte öffnen',
          actionUrl: '/dashboard/privacy',
        });
      }
    }

    if (canViewPrivacy && settings.notifyDeletionRequests) {
      const dueSoon = await this.prisma.deletionRequest.findMany({
        where: {
          status: { in: ['open', 'in_progress'] },
          dueAt: { not: null, lt: new Date(Date.now() + 2 * DAY_MS) },
        },
      });
      for (const r of dueSoon) {
        const overdue = r.dueAt! < new Date();
        candidates.push({
          category: 'privacy',
          dedupeKey: `dsr-due:${r.id}`,
          title: `Löschanfrage ${r.dsrId} ${overdue ? 'ist überfällig' : 'läuft bald ab'}`,
          description: `${r.requesterName} · ${r.affectedRecordsCount ?? 0} betroffene Datensätze.`,
          isUrgent: true,
          actionLabel: 'Anfrage bearbeiten',
          actionUrl: '/dashboard/privacy?tab=loeschanfragen',
        });
      }
    }

    if (
      canViewUsers &&
      (settings.notifyPendingActivations ||
        settings.notifyFailedLogins ||
        settings.notifyPendingPasswordChanges)
    ) {
      const counts = await this.users.getNotificationCounts();
      if (settings.notifyPendingActivations && counts.pendingActivation > 0) {
        candidates.push({
          category: 'accounts',
          dedupeKey: 'pending-activations',
          title:
            counts.pendingActivation === 1
              ? '1 Konto wartet auf Freischaltung'
              : `${counts.pendingActivation} Konten warten auf Freischaltung`,
          description:
            'Neu registrierte Konten benötigen eine Admin-Freischaltung.',
          isUrgent: false,
          actionLabel: 'Benutzer öffnen',
          actionUrl: '/dashboard/users?status=inactive',
        });
      }
      if (settings.notifyFailedLogins && counts.failedLogins > 0) {
        candidates.push({
          category: 'security',
          dedupeKey: 'failed-logins',
          title:
            counts.failedLogins === 1
              ? '1 Konto mit auffälligen Fehlversuchen'
              : `${counts.failedLogins} Konten mit auffälligen Fehlversuchen`,
          description:
            'Ungewöhnlich viele fehlgeschlagene Login-Versuche in Folge.',
          isUrgent: true,
          actionLabel: 'Benutzer öffnen',
          actionUrl: '/dashboard/users',
        });
      }
      if (
        settings.notifyPendingPasswordChanges &&
        counts.pendingPasswordChange > 0
      ) {
        candidates.push({
          category: 'security',
          dedupeKey: 'pending-password-changes',
          title:
            counts.pendingPasswordChange === 1
              ? '1 Konto muss das Passwort ändern'
              : `${counts.pendingPasswordChange} Konten müssen das Passwort ändern`,
          description: 'Passwortwechsel steht beim nächsten Login an.',
          isUrgent: false,
          actionLabel: 'Benutzer öffnen',
          actionUrl: '/dashboard/users',
        });
      }
    }

    return candidates;
  }

  /** Legt für jede aktuell zutreffende Bedingung eine Zeile an, falls noch
   * keine mit demselben `dedupeKey` existiert – bereits gelesene/erledigte
   * Einträge werden nicht angefasst, auch wenn die Bedingung weiterhin
   * zutrifft (kein Zurücksetzen des Gelesen-Status). Räumt außerdem
   * automatisch auf: eine noch unerledigte Zeile, deren Bedingung nicht
   * mehr zutrifft (z.B. Nutzer wurde freigeschaltet, Speicherplatz wieder
   * frei), wird als erledigt markiert – vorher blieb sie für immer stehen,
   * bis jemand manuell den Aktions-Button klickte (Nutzer-Bugreport,
   * 2026-08-21: "habe benutzer freigeschaltet counter verschwindet nicht
   * und benachrichtigung auch nicht"). Ausdrücklich NUR, wenn der
   * zugehörige `notify*`-Schalter noch aktiv ist – sonst würde ein bloß
   * ausgeschalteter Schalter fälschlich als "erledigt" durchgehen, statt
   * beim Wiedereinschalten den ursprünglichen (unerledigten) Zustand zu
   * zeigen. */
  async sync(user: JwtPayload) {
    const [candidates, settings] = await Promise.all([
      this.buildCandidates(user),
      this.settings.get(),
    ]);
    const candidateKeys = new Set(candidates.map((c) => c.dedupeKey));

    // Alle Zeilen des Nutzers, nicht nur unerledigte: der Unique-Constraint
    // `[userId, dedupeKey]` gilt unabhängig vom Erledigt-Status, eine
    // bereits erledigte Zeile blockiert also weiterhin ihren dedupeKey.
    // Ohne das würde `createMany` unten mit einem Constraint-Fehler
    // abstürzen, sobald eine schon erledigte Bedingung erneut zutrifft
    // (z.B. Wartungsmodus erneut aktiviert) – der ganze Request (inkl.
    // aller anderen, unbeteiligten Meldungen) schlug dadurch fehl
    // (Nutzer-Bugreport, 2026-08-21: "wo sind meine benachrichtigungen.
    // alles weg").
    const existing = await this.prisma.notification.findMany({
      where: { userId: user.sub },
      select: { id: true, dedupeKey: true, isResolved: true },
    });

    const toResolve = existing
      .filter((e) => !e.isResolved)
      .filter((e) => !candidateKeys.has(e.dedupeKey))
      .filter((e) => {
        const key = settingKeyFor(e.dedupeKey);
        return key !== null && settings[key] !== false;
      })
      .map((e) => e.id);
    if (toResolve.length > 0) {
      await this.prisma.notification.updateMany({
        where: { id: { in: toResolve } },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          isRead: true,
          readAt: new Date(),
        },
      });
      // Mail-Sperre für diese dedupeKeys aufheben, damit ein erneutes
      // Auftreten wieder eine Mail auslöst (siehe NotificationEmailLog-
      // Kommentar im Schema) – sonst bliebe die allererste E-Mail für
      // immer die einzige, egal wie oft die Bedingung später wiederkehrt.
      const resolvedDedupeKeys = existing
        .filter((e) => toResolve.includes(e.id))
        .map((e) => e.dedupeKey);
      await this.prisma.notificationEmailLog.deleteMany({
        where: { dedupeKey: { in: resolvedDedupeKeys } },
      });
    }

    const existingKeys = new Set(existing.map((e) => e.dedupeKey));
    const toCreate = candidates.filter((c) => !existingKeys.has(c.dedupeKey));
    if (toCreate.length > 0) {
      await this.prisma.notification.createMany({
        data: toCreate.map((c) => ({ ...c, userId: user.sub })),
      });
    }

    // Erneutes Zutreffen einer bereits erledigten Bedingung (z.B.
    // Wartungsmodus wurde aus-, dann wieder eingeschaltet): der
    // Unique-Constraint verhindert eine neue Zeile mit demselben
    // dedupeKey (siehe oben), also die alte Zeile stattdessen reaktivieren
    // – sonst würde sie für immer erledigt bleiben und nie wieder
    // auftauchen (Nutzer-Bugreport, 2026-08-21: "wartungsmodus wird nicht
    // berücksichtigt"). Titel/Beschreibung werden mit den aktuellen
    // Werten aktualisiert (z.B. geänderte Zähler). `createdAt` MUSS dabei
    // ebenfalls auf jetzt gesetzt werden – sonst bleibt die Zeile unter
    // ihrem alten Erstellungsdatum einsortiert (z.B. "Gestern" statt
    // "Heute", obwohl die Bedingung gerade erst wieder eingetreten ist;
    // Nutzer-Bugreport, 2026-08-22: "wartungsmodius habe ich vor 2 minuten
    // aktiviert, steht jetzt aber gestern").
    const revivable = existing.filter(
      (e) => e.isResolved && candidateKeys.has(e.dedupeKey),
    );
    for (const row of revivable) {
      const candidate = candidates.find((c) => c.dedupeKey === row.dedupeKey);
      if (!candidate) continue;
      await this.prisma.notification.update({
        where: { id: row.id },
        data: {
          ...candidate,
          isResolved: false,
          resolvedAt: null,
          isRead: false,
          readAt: null,
          createdAt: new Date(),
        },
      });
    }

    // E-Mail an die gemeinsame Empfänger-Adresse (Nutzervorgabe,
    // 2026-08-22: "sofort bei jedem neuen Vorfall") – sowohl für ganz neue
    // Meldungen als auch für wiederbelebte (siehe revivable oben), jeweils
    // nur, wenn dafür noch keine Mail verschickt wurde (NotificationEmailLog).
    if (settings.notificationRecipientEmail) {
      const revived = revivable
        .map((row) => candidates.find((c) => c.dedupeKey === row.dedupeKey))
        .filter((c): c is Candidate => c !== undefined);
      await this.notifyByEmail(
        [...toCreate, ...revived],
        settings.notificationRecipientEmail,
      );
    }
  }

  /** Verschickt für jeden Kandidaten höchstens einmal eine Mail, unabhängig
   * davon, welcher Nutzer den auslösenden sync()-Lauf ausführt (siehe
   * NotificationEmailLog-Kommentar im Schema) – dafür zuerst prüfen, für
   * welche dedupeKeys schon geloggt wurde, dann nur die übrigen loggen
   * und verschicken. */
  private async notifyByEmail(candidates: Candidate[], recipientEmail: string) {
    if (candidates.length === 0) return;
    const dedupeKeys = candidates.map((c) => c.dedupeKey);
    const alreadyLogged = await this.prisma.notificationEmailLog.findMany({
      where: { dedupeKey: { in: dedupeKeys } },
      select: { dedupeKey: true },
    });
    const loggedKeys = new Set(alreadyLogged.map((l) => l.dedupeKey));
    const toEmail = candidates.filter((c) => !loggedKeys.has(c.dedupeKey));
    if (toEmail.length === 0) return;

    await this.prisma.notificationEmailLog.createMany({
      data: toEmail.map((c) => ({ dedupeKey: c.dedupeKey })),
      skipDuplicates: true,
    });
    for (const candidate of toEmail) {
      await this.mailer.sendSystemNotificationEmail(recipientEmail, candidate);
    }
  }

  async findAll(user: JwtPayload) {
    await this.sync(user);
    const [rows, settings] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.sub },
        orderBy: { createdAt: 'desc' },
      }),
      this.settings.get(),
    ]);
    return rows.filter((row) => {
      const key = settingKeyFor(row.dedupeKey);
      return key === null || settings[key] !== false;
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markUnread(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, isRead: true },
      data: { isRead: false, readAt: null },
    });
  }

  /** Entfernt die Zeile wirklich (nicht nur "gelesen"/"erledigt") – trifft
   * die zugrunde liegende Bedingung beim nächsten `sync()` weiterhin zu
   * (z.B. ein Webhook, der immer noch fehlschlägt), wird sie erneut
   * angelegt. Das ist so gewollt: "löschen" blendet die aktuelle Meldung
   * aus, unterdrückt die Kategorie aber nicht dauerhaft – dafür sind die
   * `notify*`-Schalter unter Einstellungen da. */
  async remove(id: string, userId: string) {
    return this.prisma.notification.deleteMany({ where: { id, userId } });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markResolved(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        isRead: true,
        readAt: new Date(),
      },
    });
  }
}
