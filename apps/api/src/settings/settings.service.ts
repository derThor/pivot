import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

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
      passwordMinLength: settings.passwordMinLength,
      passwordRequireUppercase: settings.passwordRequireUppercase,
      passwordRequireLowercase: settings.passwordRequireLowercase,
      passwordRequireNumber: settings.passwordRequireNumber,
      passwordRequireSpecialChar: settings.passwordRequireSpecialChar,
      defaultPageSize: settings.defaultPageSize,
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
    };
  }

  async update(dto: UpdateSettingsDto) {
    await this.get(); // stellt sicher, dass die Zeile existiert
    return this.prisma.appSettings.update({
      where: { id: 1 },
      data: dto,
    });
  }
}
