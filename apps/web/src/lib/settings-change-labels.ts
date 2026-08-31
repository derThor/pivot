// Deutsche Kurz-Labels für alle Felder, die über SettingsService.update()
// als "settings.field_updated" protokolliert werden (siehe dort – bewusst
// nur echte, allgemeine Einstellungen, keine Firma-/Datenschutz-Felder,
// die haben ihre eigene Historie). 1:1 dieselben Texte wie die
// zugehörigen Formularfelder in settings-form.tsx bzw.
// notification-settings-card.tsx, damit ein Protokoll-/Aktivitäts-Eintrag
// genau das benennt, was in der UI auch so heißt. Geteilt zwischen
// settings-protocol-card.tsx (Einstellungen → Protokoll) und
// user-activity-timeline.tsx (Benutzer → Aktivität), damit beide Stellen
// nicht auseinanderlaufen (Nutzer-Bugreport, 2026-08-30: rohe Action-Codes
// wie "settings.field_updated" erschienen unübersetzt in der Aktivität).
export const SETTINGS_FIELD_LABELS: Record<string, string> = {
  allowRegistration: "Registrierung erlauben",
  allowPasswordReset: "Passwort-vergessen erlauben",
  allowEmailChange: "Benutzer können E-Mail-Adresse anpassen",
  allowAdminEmailChange: "Administratoren können E-Mail-Adresse anpassen",
  requireAdminActivation: "Admin-Freischaltung erforderlich",
  autosaveEnabled: "Autosave im Content-Editor",
  mediaResponsiveVariantsEnabled: "Automatische Bildvarianten",
  maintenanceModeEnabled: "Wartungsmodus",
  mediaStorageQuotaMb: "Medien-Speicherkontingent",
  maxUploadSizeMb: "Maximale Dateigröße pro Upload",
  passwordMinLength: "Passwort-Mindestlänge",
  passwordRequireUppercase: "Groß-/Kleinschreibung und Zahl erforderlich",
  passwordRequireLowercase: "Groß-/Kleinschreibung und Zahl erforderlich",
  passwordRequireNumber: "Groß-/Kleinschreibung und Zahl erforderlich",
  passwordRequireSpecialChar: "Sonderzeichen erforderlich",
  passwordExpiryDays: "Passwortwechsel nach Tagen",
  failedLoginLockoutThreshold: "Sperre nach Fehlversuchen",
  passwordBlockLeaked: "Bekannte geleakte Passwörter blockieren",
  passwordPreventReuseEnabled: "Letzte 5 Passwörter nicht erneut zulassen",
  allowTwoFactor: "2FA verfügbar machen",
  requireTwoFactorForAdmins: "Zwei-Faktor für Administratoren erzwingen",
  requireTwoFactorForAll: "Zwei-Faktor für alle Konten erzwingen",
  requireTwoFactorForPublishers:
    "Zwei-Faktor für Rollen mit Veröffentlichungsrecht",
  sessionIdleTimeoutMinutes: "Sitzungs-Timeout bei Inaktivität",
  defaultPageSize: "Einträge pro Seite",
  accentColor: "Akzentfarbe",
  tableDensity: "Tabellendichte",
  sidebarCollapsedByDefault: "Seitenleiste eingeklappt starten",
  keyboardShortcutsEnabled: "Tastaturkürzel aktiv",
  reduceMotion: "Bewegungen reduzieren",
  companyLogoUrl: "Firmenlogo",
  companyLogoUrlDark: "Firmenlogo (Dunkelmodus)",
  notifyMaintenanceMode: "Benachrichtigung „Wartungsmodus“",
  notifyStorageQuota: "Benachrichtigung „Speicherplatz fast voll“",
  notifyWebhookFailures: "Benachrichtigung „Fehlschlagende Webhooks“",
  notifyLocalDrafts: "Benachrichtigung „Lokale Entwürfe“",
  notifyPendingActivations: "Benachrichtigung „Wartende Freischaltungen“",
  notifyFailedLogins: "Benachrichtigung „Auffällige Fehlversuche“",
  notifyPendingPasswordChanges: "Benachrichtigung „Anstehende Passwortwechsel“",
  notifyCompanyIncomplete: "Benachrichtigung „Unvollständige Firmendaten“",
  notifyLegalDocuments: "Benachrichtigung „Veraltete/fehlende Rechtstexte“",
  notifyDeletionRequests: "Benachrichtigung „Offene Betroffenenanfragen“",
  notifyTrashExpiring: "Benachrichtigung „Papierkorb-Einträge laufen ab“",
  notificationRecipientEmail: "Benachrichtigungsempfänger",
  // Einstellungen → Integrationen, Karte "Dienste" (Nutzervorgabe,
  // 2026-08-22) – eigener Endpoint statt UpdateSettingsDto, daher kein
  // echtes before/after (siehe SettingsService.updateSmtpSettings()).
  emailSmtp: "E-Mail-Versand (SMTP)",
  // Einstellungen → Master-Client, "API-Key ändern" (siehe
  // SettingsService.updateLicenseClientSettings()) – ebenfalls kein
  // echtes before/after (Secret wird nie im Klartext geloggt).
  licenseApiKey: "Lizenz-API-Key",
  // Einstellungen → Jobs (Nutzervorgabe, 2026-08-30) – 1:1 dieselben
  // Texte wie job-run-retention-card.tsx/activity-log-retention-card.tsx.
  jobsGloballyPaused: "Alle Jobs pausieren",
  jobRunRetentionDays: "Job-Lauf-Historie aufbewahren",
  activityLogRetentionDays: "Aktivitäten-Historie aufbewahren",
  // Einstellungen → Frontend (öffentliche Website, 2026-08-31).
  siteTitle: "Website-Titel",
  siteTagline: "Website-Untertitel",
  faviconUrl: "Favicon",
  defaultSeoDescription: "Standard-SEO-Beschreibung",
  defaultOgImageUrl: "Standard-Social-Media-Bild",
  publicBaseUrl: "Basis-URL der Website",
  mainNavigationId: "Hauptmenü",
};

// Für Protokoll-/Aktivitäts-Einträge, die kein Feld ändern, sondern eine
// Aktion sind (kein `metadata.field`) – ohne diese Zuordnung würde der
// rohe Action-String stehen (z.B. "settings.job_runs_deleted").
export const SETTINGS_ACTION_LABELS: Record<string, string> = {
  "settings.job_runs_deleted": "Job-Lauf-Historie gelöscht",
};

export function humanizeSettingsField(field: string) {
  return (
    SETTINGS_FIELD_LABELS[field] ?? field.replace(/([a-z])([A-Z])/g, "$1 $2")
  );
}

function formatSettingsValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "aktiviert" : "deaktiviert";
  return String(value);
}

export function describeSettingsFieldChange(
  field: string,
  after: unknown,
): string {
  const label = humanizeSettingsField(field);
  if (typeof after === "boolean") {
    return `${label} ${after ? "aktiviert" : "deaktiviert"}`;
  }
  const formatted = formatSettingsValue(after);
  return formatted ? `${label} auf ${formatted} geändert` : `${label} geändert`;
}

/** Gemeinsamer Einstiegspunkt für jede "settings.*"-Aktion, egal ob mit
 * (`settings.field_updated`/`settings.smtp_updated`) oder ohne
 * `metadata.field` (`settings.job_runs_deleted`). */
export function describeSettingsAction(
  action: string,
  metadata: Record<string, unknown> | null,
): string {
  const field = (metadata?.field as string | undefined) ?? "";
  if (field) {
    return describeSettingsFieldChange(field, metadata?.after);
  }
  return SETTINGS_ACTION_LABELS[action] ?? action;
}
