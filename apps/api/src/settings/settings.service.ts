import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

// Firma-Stammdaten-Felder (Verwaltung → Firma, "Letzte Änderungen"-Karte,
// 2026-08-17) – deutsche Labels leben zusätzlich im Frontend
// (company-view.tsx), hier nur als Schlüssel-Liste für die Diff-Prüfung
// in update() unten.
const COMPANY_FIELD_KEYS = [
  'companyName',
  'companyStreet',
  'companyPostalCode',
  'companyCity',
  'companyCountry',
  'companyRepresentative',
  'companyEmail',
  'companyPhone',
  'companyRegisterCourt',
  'companyRegisterNumber',
  'companyVatId',
  'companySupervisoryAuthority',
] as const;

const COMPANY_ENTITY_TYPE = 'Company';
const COMPANY_ENTITY_ID = 'company';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async get() {
    return this.prisma.appSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  }

  async getPublic() {
    const settings = await this.get();
    return {
      allowRegistration: settings.allowRegistration,
      allowPasswordReset: settings.allowPasswordReset,
      allowEmailChange: settings.allowEmailChange,
      requireAdminActivation: settings.requireAdminActivation,
      autosaveEnabled: settings.autosaveEnabled,
      mediaResponsiveVariantsEnabled: settings.mediaResponsiveVariantsEnabled,
      maintenanceModeEnabled: settings.maintenanceModeEnabled,
      mediaStorageQuotaMb: settings.mediaStorageQuotaMb,
      maxUploadSizeMb: settings.maxUploadSizeMb,
      passwordMinLength: settings.passwordMinLength,
      passwordRequireUppercase: settings.passwordRequireUppercase,
      passwordRequireLowercase: settings.passwordRequireLowercase,
      passwordRequireNumber: settings.passwordRequireNumber,
      passwordRequireSpecialChar: settings.passwordRequireSpecialChar,
      // Jede Rolle mit Dashboard-Zugriff muss wissen, ob 2FA überhaupt
      // verfügbar ist (Konto-Seite blendet die Einrichtung sonst aus) –
      // gleicher Grund wie bei defaultPageSize/allowEmailChange oben.
      allowTwoFactor: settings.allowTwoFactor,
      defaultPageSize: settings.defaultPageSize,
      accentColor: settings.accentColor,
      tableDensity: settings.tableDensity,
      sidebarCollapsedByDefault: settings.sidebarCollapsedByDefault,
      keyboardShortcutsEnabled: settings.keyboardShortcutsEnabled,
      reduceMotion: settings.reduceMotion,
      notifyMaintenanceMode: settings.notifyMaintenanceMode,
      notifyStorageQuota: settings.notifyStorageQuota,
      notifyWebhookFailures: settings.notifyWebhookFailures,
      notifyLocalDrafts: settings.notifyLocalDrafts,
      notifyPendingActivations: settings.notifyPendingActivations,
      notifyFailedLogins: settings.notifyFailedLogins,
      notifyPendingPasswordChanges: settings.notifyPendingPasswordChanges,
      companyLogoUrl: settings.companyLogoUrl,
      companyName: settings.companyName,
      companyStreet: settings.companyStreet,
      companyPostalCode: settings.companyPostalCode,
      companyCity: settings.companyCity,
      companyCountry: settings.companyCountry,
      companyRepresentative: settings.companyRepresentative,
      companyEmail: settings.companyEmail,
      companyPhone: settings.companyPhone,
      companyRegisterCourt: settings.companyRegisterCourt,
      companyRegisterNumber: settings.companyRegisterNumber,
      companyVatId: settings.companyVatId,
      companySupervisoryAuthority: settings.companySupervisoryAuthority,
      dpoIsExternal: settings.dpoIsExternal,
      dpoName: settings.dpoName,
      dpoCompany: settings.dpoCompany,
      dpoEmail: settings.dpoEmail,
      dpoPhone: settings.dpoPhone,
      dpoAppointedAt: settings.dpoAppointedAt,
      dpoReportedAt: settings.dpoReportedAt,
      dpoSupervisoryAuthority: settings.dpoSupervisoryAuthority,
      dpoLastContactAt: settings.dpoLastContactAt,
      dpoListInLegalTexts: settings.dpoListInLegalTexts,
      dpoNotifyOnIncident: settings.dpoNotifyOnIncident,
      dpoMonthlyReportEnabled: settings.dpoMonthlyReportEnabled,
      retentionFormSubmissionsDays: settings.retentionFormSubmissionsDays,
      retentionAccessLogMonths: settings.retentionAccessLogMonths,
      retentionDeactivatedAccountsMonths:
        settings.retentionDeactivatedAccountsMonths,
      retentionTrashDays: settings.retentionTrashDays,
    };
  }

  async update(dto: UpdateSettingsDto, actingUserId?: string) {
    const existing = await this.get(); // stellt sicher, dass die Zeile existiert
    const updated = await this.prisma.appSettings.update({
      where: { id: 1 },
      data: dto,
    });

    // "Letzte Änderungen" auf der Firma-Seite (Verwaltung → Firma): pro
    // tatsächlich geändertem Stammdaten-Feld ein eigener Eintrag, nicht nur
    // "Einstellungen gespeichert" – deckt sich mit der Bildvorlage
    // ("Telefon aktualisiert", "USt-IdNr. ergänzt", je einzeln gelistet).
    if (actingUserId) {
      for (const key of COMPANY_FIELD_KEYS) {
        if (!(key in dto)) continue;
        const before = existing[key];
        const after = updated[key];
        if (before === after) continue;
        await this.auditLog.record({
          action: 'company.field_updated',
          entityType: COMPANY_ENTITY_TYPE,
          entityId: COMPANY_ENTITY_ID,
          userId: actingUserId,
          metadata: { field: key, wasEmpty: !before },
        });
      }
    }

    return updated;
  }

  getCompanyChanges(limit = 5) {
    return this.auditLog.findRecentForEntity(
      COMPANY_ENTITY_TYPE,
      COMPANY_ENTITY_ID,
      limit,
    );
  }
}
