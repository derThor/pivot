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
import { LicenseClientService } from '../license-client/license-client.service';
import { PUBLIC_FORM_DSR_SOURCE } from '../deletion-requests/deletion-requests.service';

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
  // Berechtigung, die ein Nutzer braucht, damit für IHN eine Zeile/Mail
  // entsteht (siehe `sync()`) – NICHT Teil der Tatsachen-Berechnung oben
  // (z.B. "gibt es veraltete Rechtstexte" hängt nicht davon ab, wer
  // fragt). Sonst löst ein Sync-Aufruf mit einem Token ohne diese
  // Berechtigung (z.B. ein kurzzeitig fehlendes `privacy:read` durch
  // JWT-Veraltung nach einer Rollenänderung) fälschlich "erledigt" aus,
  // löscht dabei den globalen `NotificationEmailLog`-Eintrag, und der
  // nächste Sync mit ausreichender Berechtigung verschickt dieselbe Mail
  // erneut – Dauerspam alle paar Minuten (Nutzer-Bugreport, 2026-08-31:
  // "warum werde ich permanent mit emails vollgeballert").
  requiredPermission?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Nur für die Beschreibung der "nicht veröffentlicht"-Meldung – benennt den
// konkreten Grund (Entwurf/geplant/archiviert), statt alle drei über einen
// Kamm zu scheren. Gleiche Schreibweise wie in `trash.service.ts`.
const CONTENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Entwurf',
  PUBLISHED: 'veröffentlicht',
  SCHEDULED: 'geplant',
  ARCHIVED: 'archiviert',
};

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
  // 'submissions-unread' ist 2026-09-03 entfallen (der Stand steht am
  // Briefsymbol in der Kopfzeile); bereits erzeugte Zeilen raeumt sync()
  // von selbst ab, weil sie kein Kandidat mehr sind.
  if (dedupeKey === 'submissions-due-deletion') {
    return 'notifyUnreadSubmissions';
  }
  // Beide Website-Anomalien hängen am selben Schalter. Der erste
  // (`website-anomaly:`) fehlte hier bisher – dadurch blieb eine schon
  // erzeugte Zeile stehen, wenn die Kategorie später abgeschaltet wurde
  // (derselbe Bug wie 2026-08-21 bei der Speicherwarnung).
  if (
    dedupeKey.startsWith('website-anomaly:') ||
    dedupeKey.startsWith('website-stats-anomaly:')
  ) {
    return 'notifyWebsiteAnomaly';
  }
  if (dedupeKey === 'company-incomplete') return 'notifyCompanyIncomplete';
  if (dedupeKey === 'legal-documents-stale') return 'notifyLegalDocuments';
  if (dedupeKey === 'legal-documents-unpublished')
    return 'notifyLegalDocuments';
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
    private readonly licenseClient: LicenseClientService,
  ) {}

  /** Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): "bei Datenschutz
   * dann auch keine Systemnachrichten zu Datenschutzthemen" – dieselbe
   * Master-wie-Slave-einheitliche Quelle wie `ModuleEntitlementGuard`/
   * `ModuleFeatureGuard` (siehe `LicenseClientService.getEffectiveStatus()`),
   * damit eine deaktivierte Reiter-Freischaltung nicht nur die Seite/API
   * sperrt, sondern auch keine dazugehörige Meldung mehr erzeugt. */
  private async hasModuleFeature(
    moduleKey: string,
    featureKey: string,
  ): Promise<boolean> {
    const effective = await this.licenseClient.getEffectiveStatus();
    const moduleFeatures =
      'moduleFeatures' in effective ? effective.moduleFeatures : {};
    return (moduleFeatures[moduleKey] ?? []).includes(featureKey);
  }

  private async buildCandidates(user: JwtPayload): Promise<Candidate[]> {
    const permissions = user.permissions ?? [];
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

      // Plausibilitätsprüfung der von einer Installation selbst gemeldeten
      // Kennzahlen (Nutzervorgabe, 2026-09-01) – ein unglaubwürdiger
      // Einbruch ist ein Manipulationsverdacht, kein Beweis: die Meldung
      // benennt deshalb nur den Sprung und überlässt die Bewertung dem
      // Admin, der sie danach quittiert (setzt `statsAnomalyAt` zurück).
      const statsAnomalies = await this.prisma.website.findMany({
        where: { statsAnomalyAt: { not: null } },
      });
      for (const site of statsAnomalies) {
        candidates.push({
          category: 'system',
          dedupeKey: `website-stats-anomaly:${site.id}`,
          title: `Unglaubwürdiger Rückgang bei „${site.name}“`,
          description: `${site.statsAnomalyMessage} – die Zahlen meldet die Installation selbst, ein solcher Einbruch kann echt oder manipuliert sein.`,
          isUrgent: false,
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

    // Formular-Einsendungen. Hier steht seit 2026-09-03 nur noch die
    // WARNUNG vor der automatischen Löschung. Die bloße Erinnerung "es
    // liegen ungelesene Einsendungen" ist entfallen (Nutzervorgabe: "aus
    // systembenachrichtigung rausnehmen ... nur warnungen oder fehler
    // sollen dann da rein") – der Ungelesen-Stand steht jetzt dauerhaft
    // am Briefsymbol in der Kopfzeile und braucht keine Meldung mehr, die
    // man wegklicken muss.
    //
    // Die Frist `formSubmissionUnreadReminderDays` bleibt in Gebrauch:
    // der Job "form-submission-unread-reminder" verschickt weiterhin eine
    // E-Mail (siehe JobsService).
    if (settings.notifyUnreadSubmissions) {
      // Die Löschmeldung hängt am Datenschutz-Modul (Nutzervorgabe,
      // 2026-09-02: "Systembenachrichtigung für zu löschende einsendungen
      // nur, wenn datenschutzmodul vorhanden") – der Schalter dafür sitzt
      // beim Mandanten unter Module → Datenschutz → Formulare.
      const deleteDays = settings.formSubmissionDeleteAfterReadDays;
      const deleteUnreadDays = settings.formSubmissionDeleteUnreadAfterDays;
      if (
        (deleteDays != null || deleteUnreadDays != null) &&
        (await this.hasModuleFeature('datenschutz', 'aufbewahrung'))
      ) {
        // Warnfenster: die letzten 3 Tage vor der endgültigen Löschung –
        // für beide Fristen, gelesene ab readAt, ungelesene ab createdAt.
        const window = (days: number) => {
          const from = new Date();
          from.setDate(from.getDate() - days);
          const until = new Date(from);
          until.setDate(until.getDate() + 3);
          return { gte: from, lt: until };
        };
        const [dueRead, dueUnread] = await Promise.all([
          deleteDays != null
            ? this.prisma.formSubmission.count({
                where: {
                  isRead: true,
                  readAt: { not: null, ...window(deleteDays) },
                },
              })
            : Promise.resolve(0),
          deleteUnreadDays != null
            ? this.prisma.formSubmission.count({
                where: { isRead: false, createdAt: window(deleteUnreadDays) },
              })
            : Promise.resolve(0),
        ]);
        const due = dueRead + dueUnread;
        if (due > 0) {
          candidates.push({
            category: 'privacy',
            dedupeKey: 'submissions-due-deletion',
            title: `${due} Einsendung${due === 1 ? '' : 'en'} ${due === 1 ? 'wird' : 'werden'} in den nächsten Tagen gelöscht`,
            description: `Endgültige Löschung laut den Fristen unter Datenschutz → Aufbewahrung${dueUnread > 0 ? ` – darunter ${dueUnread} nie gelesen` : ''}.`,
            isUrgent: false,
            actionLabel: 'Einsendungen öffnen',
            actionUrl: '/dashboard/forms/submissions',
          });
        }
      }
    }

    // Lizenz-Verbindung des Clients (Nutzer-Bugreport, 2026-09-02: "der
    // lizenzschlüssel ist falsch aber client hat positives feedback?").
    // Bewusst OHNE Eintrag in `settingKeyFor()` und damit nicht
    // abschaltbar: eine Installation, die den Kontakt zum Master verloren
    // hat, sperrt sich in wenigen Tagen selbst – diese Meldung ist die
    // einzige Vorwarnung und darf nicht wegklickbar sein.
    const license = await this.licenseClient.getEffectiveStatus();
    if (
      license.mode === 'slave' &&
      'keySuspect' in license &&
      license.keySuspect &&
      license.status !== 'locked'
    ) {
      const lastOk =
        'lastCheckInAt' in license && license.lastCheckInAt
          ? license.lastCheckInAt.toLocaleString('de-DE')
          : 'nie';
      candidates.push({
        category: 'system',
        dedupeKey: 'license-key-rejected',
        title: 'Verbindung zur Lizenzverwaltung abgelehnt',
        description: `Der Schlüssel wurde beim letzten Versuch nicht akzeptiert. Letzter erfolgreicher Abgleich: ${lastOk}. Ohne gültigen Schlüssel sperrt sich diese Installation nach Ablauf des Tokens.`,
        isUrgent: true,
        actionLabel: 'Master-Client öffnen',
        actionUrl: '/dashboard/settings?section=master-client',
      });
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

    if (
      settings.notifyLegalDocuments &&
      (await this.hasModuleFeature('datenschutz', 'rechtstexte'))
    ) {
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
          requiredPermission: 'privacy:read',
        });
      }
      // Zweite, eigenständige Meldung: ein erzeugter Rechtstext erfüllt
      // seinen Zweck erst, wenn seine Seite öffentlich erreichbar ist – ein
      // Entwurf (ebenso ein geplanter oder archivierter Stand) ist für
      // Besucher dasselbe wie gar kein Text. Bewusst NICHT in
      // 'legal-documents-stale' mit hineingezählt: dort ist die Abhilfe
      // "neu erzeugen", hier "veröffentlichen" (Nutzer-Bugreport,
      // 2026-09-01: "obwohl hier die dokumente überwiegend auf entwurf
      // stehen, wird nur das fehlende in den benachrichtigungen angezeigt.
      // das ist falsch"). Dokumente ganz ohne verknüpfte Seite deckt
      // bereits der 'missing'-Zweig oben ab, deshalb `contentId != null`.
      const unpublished = docs.filter(
        (d) => d.contentId != null && d.contentStatus !== 'PUBLISHED',
      );
      if (unpublished.length > 0) {
        candidates.push({
          category: 'privacy',
          dedupeKey: 'legal-documents-unpublished',
          title: `${unpublished.length} Rechtstext${unpublished.length === 1 ? ' ist' : 'e sind'} nicht veröffentlicht`,
          description: unpublished
            .map(
              (d) =>
                `${d.title} (${CONTENT_STATUS_LABELS[d.contentStatus ?? ''] ?? 'unveröffentlicht'})`,
            )
            .join(', '),
          isUrgent: false,
          actionLabel: 'Rechtstexte öffnen',
          actionUrl: '/dashboard/privacy',
          requiredPermission: 'privacy:read',
        });
      }
    }

    if (
      settings.notifyDeletionRequests &&
      (await this.hasModuleFeature('datenschutz', 'loeschanfragen'))
    ) {
      // Anfragen aus dem Selbstauskunft-Footer der Website
      // (Nutzervorgabe, 2026-09-02) kommen von außen und ohne Vorwarnung
      // herein. Ohne diesen Hinweis fielen sie erst zwei Tage vor
      // Fristende auf – bei einem Monat Frist also fast vier Wochen zu
      // spät. Bewusst kein eigener Schalter: gleiche Kategorie, gleiches
      // Recht, gleicher An/Aus-Hebel wie die Fristen-Warnung darunter.
      // Der Hinweis verschwindet, sobald jemand die Anfrage aus "offen"
      // herausbewegt.
      const fromWebsite = await this.prisma.deletionRequest.findMany({
        where: { status: 'open', source: PUBLIC_FORM_DSR_SOURCE },
      });
      for (const r of fromWebsite) {
        candidates.push({
          category: 'privacy',
          dedupeKey: `dsr-new:${r.id}`,
          title: `Neue Auskunftsanfrage ${r.dsrId} über die Website`,
          description: `${r.requesterEmail} hat über den Selbstauskunft-Link eine Auskunft angefordert.`,
          isUrgent: false,
          actionLabel: 'Anfrage bearbeiten',
          actionUrl: '/dashboard/privacy?tab=loeschanfragen',
          requiredPermission: 'privacy:read',
        });
      }

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
          requiredPermission: 'privacy:read',
        });
      }
    }

    if (
      settings.notifyPendingActivations ||
      settings.notifyFailedLogins ||
      settings.notifyPendingPasswordChanges
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
          requiredPermission: 'users:read',
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
          requiredPermission: 'users:read',
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
          requiredPermission: 'users:read',
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
    // `candidates` ist bewusst UNABHÄNGIG von den Berechtigungen des
    // aktuellen Tokens (siehe `requiredPermission`-Kommentar am
    // `Candidate`-Typ) – für die Erledigt/Wiederbeleben-Entscheidung unten
    // zählt der echte Zustand, nicht was dieses eine Token gerade sehen
    // darf. Nur für NEU anzulegende Zeilen (`toCreate`) wird auf das
    // aktuelle Token gefiltert, sonst bekäme ein Nutzer ohne die nötige
    // Berechtigung eine Zeile in seinem eigenen Postfach, die er gar nicht
    // sehen dürfte.
    const permissions = user.permissions ?? [];
    const candidateKeys = new Set(candidates.map((c) => c.dedupeKey));
    const visibleCandidates = candidates.filter(
      (c) =>
        !c.requiredPermission || permissions.includes(c.requiredPermission),
    );

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
    const toCreate = visibleCandidates.filter(
      (c) => !existingKeys.has(c.dedupeKey),
    );
    if (toCreate.length > 0) {
      await this.prisma.notification.createMany({
        data: toCreate.map((c) => ({
          category: c.category,
          dedupeKey: c.dedupeKey,
          title: c.title,
          description: c.description,
          isUrgent: c.isUrgent,
          actionLabel: c.actionLabel,
          actionUrl: c.actionUrl,
          userId: user.sub,
        })),
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
          category: candidate.category,
          title: candidate.title,
          description: candidate.description,
          isUrgent: candidate.isUrgent,
          actionLabel: candidate.actionLabel,
          actionUrl: candidate.actionUrl,
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
