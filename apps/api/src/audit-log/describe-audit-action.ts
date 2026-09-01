// Backend-Pendant zu describeActivity() in
// apps/web/src/components/user-activity-timeline.tsx – für den CSV-Export
// des "Aktivität"-Tabs (UsersService.exportActivityCsv()). Nutzer-
// Korrektur, 2026-08-30: "export von aktivitäten nutzt wieder keine
// deutschen texte" – eine erste, vereinfachte Version fiel für
// "settings.field_updated" & Co. auf den rohen Action-/Feldnamen zurück.
// Jetzt bewusst dieselben deutschen Texte wie auf dem Bildschirm, nicht nur
// eine eigene Kurzfassung – 1:1 dieselbe Fallunterscheidung wie im
// Frontend, nur ohne JSX. Wörterbücher (COMPANY_FIELD_LABELS,
// SETTINGS_FIELD_LABELS/SETTINGS_ACTION_LABELS) hier separat dupliziert,
// da apps/web und apps/api getrennte Pakete ohne gemeinsame lib sind –
// gleiches Prinzip wie ACTION_LABELS in SettingsService, bewusst
// vollständig statt nur teilweise portiert, damit kein Fall wieder auf den
// rohen Code zurückfällt.

// Gleiche Feldliste wie companyFields in company-view.tsx.
const COMPANY_FIELD_LABELS: Record<string, string> = {
  companyName: 'Firmenname',
  companyStreet: 'Straße und Hausnummer',
  companyPostalCode: 'PLZ',
  companyCity: 'Ort',
  companyCountry: 'Land',
  companyRepresentative: 'Vertretungsberechtigte Person',
  companyEmail: 'E-Mail',
  companyPhone: 'Telefon',
  companyRegisterCourt: 'Registergericht',
  companyRegisterNumber: 'Handelsregisternummer',
  companyVatId: 'USt-IdNr.',
  companySupervisoryAuthority: 'Aufsichtsbehörde',
  companyDisputeResolution: 'Streitschlichtung',
};

// 1:1 dieselben Texte wie SETTINGS_FIELD_LABELS in
// apps/web/src/lib/settings-change-labels.ts.
const SETTINGS_FIELD_LABELS: Record<string, string> = {
  allowRegistration: 'Registrierung erlauben',
  allowPasswordReset: 'Passwort-vergessen erlauben',
  allowEmailChange: 'Benutzer können E-Mail-Adresse anpassen',
  allowAdminEmailChange: 'Administratoren können E-Mail-Adresse anpassen',
  requireAdminActivation: 'Admin-Freischaltung erforderlich',
  autosaveEnabled: 'Autosave im Content-Editor',
  mediaResponsiveVariantsEnabled: 'Automatische Bildvarianten',
  maintenanceModeEnabled: 'Wartungsmodus',
  mediaStorageQuotaMb: 'Medien-Speicherkontingent',
  maxUploadSizeMb: 'Maximale Dateigröße pro Upload',
  passwordMinLength: 'Passwort-Mindestlänge',
  passwordRequireUppercase: 'Groß-/Kleinschreibung und Zahl erforderlich',
  passwordRequireLowercase: 'Groß-/Kleinschreibung und Zahl erforderlich',
  passwordRequireNumber: 'Groß-/Kleinschreibung und Zahl erforderlich',
  passwordRequireSpecialChar: 'Sonderzeichen erforderlich',
  passwordExpiryDays: 'Passwortwechsel nach Tagen',
  failedLoginLockoutThreshold: 'Sperre nach Fehlversuchen',
  passwordBlockLeaked: 'Bekannte geleakte Passwörter blockieren',
  passwordPreventReuseEnabled: 'Letzte 5 Passwörter nicht erneut zulassen',
  allowTwoFactor: '2FA verfügbar machen',
  requireTwoFactorForAdmins: 'Zwei-Faktor für Administratoren erzwingen',
  requireTwoFactorForAll: 'Zwei-Faktor für alle Konten erzwingen',
  requireTwoFactorForPublishers:
    'Zwei-Faktor für Rollen mit Veröffentlichungsrecht',
  sessionIdleTimeoutMinutes: 'Sitzungs-Timeout bei Inaktivität',
  defaultPageSize: 'Einträge pro Seite',
  accentColor: 'Akzentfarbe',
  tableDensity: 'Tabellendichte',
  sidebarCollapsedByDefault: 'Seitenleiste eingeklappt starten',
  keyboardShortcutsEnabled: 'Tastaturkürzel aktiv',
  reduceMotion: 'Bewegungen reduzieren',
  companyLogoUrl: 'Firmenlogo',
  companyLogoUrlDark: 'Firmenlogo (Dunkelmodus)',
  notifyMaintenanceMode: 'Benachrichtigung „Wartungsmodus“',
  notifyStorageQuota: 'Benachrichtigung „Speicherplatz fast voll“',
  notifyWebhookFailures: 'Benachrichtigung „Fehlschlagende Webhooks“',
  notifyLocalDrafts: 'Benachrichtigung „Lokale Entwürfe“',
  notifyPendingActivations: 'Benachrichtigung „Wartende Freischaltungen“',
  notifyFailedLogins: 'Benachrichtigung „Auffällige Fehlversuche“',
  notifyPendingPasswordChanges: 'Benachrichtigung „Anstehende Passwortwechsel“',
  notifyCompanyIncomplete: 'Benachrichtigung „Unvollständige Firmendaten“',
  notifyLegalDocuments:
    'Benachrichtigung „Rechtstexte brauchen Aufmerksamkeit“',
  notifyDeletionRequests: 'Benachrichtigung „Offene Betroffenenanfragen“',
  notifyTrashExpiring: 'Benachrichtigung „Papierkorb-Einträge laufen ab“',
  notificationRecipientEmail: 'Benachrichtigungsempfänger',
  emailSmtp: 'E-Mail-Versand (SMTP)',
  licenseApiKey: 'Lizenz-API-Key',
  jobsGloballyPaused: 'Alle Jobs pausieren',
  jobRunRetentionDays: 'Job-Lauf-Historie aufbewahren',
  activityLogRetentionDays: 'Aktivitäten-Historie aufbewahren',
  siteTitle: 'Website-Titel',
  siteTagline: 'Website-Untertitel',
  faviconUrl: 'Favicon',
  defaultSeoDescription: 'Standard-SEO-Beschreibung',
  defaultOgImageUrl: 'Standard-Social-Media-Bild',
  publicBaseUrl: 'Basis-URL der Website',
  mainNavigationId: 'Hauptmenü',
};

const SETTINGS_ACTION_LABELS: Record<string, string> = {
  'settings.job_runs_deleted': 'Job-Lauf-Historie gelöscht',
};

function humanizeSettingsField(field: string): string {
  return (
    SETTINGS_FIELD_LABELS[field] ?? field.replace(/([a-z])([A-Z])/g, '$1 $2')
  );
}

function formatSettingsValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'aktiviert' : 'deaktiviert';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return null;
}

function describeSettingsFieldChange(field: string, after: unknown): string {
  const label = humanizeSettingsField(field);
  if (typeof after === 'boolean') {
    return `${label} ${after ? 'aktiviert' : 'deaktiviert'}`;
  }
  const formatted = formatSettingsValue(after);
  return formatted ? `${label} auf ${formatted} geändert` : `${label} geändert`;
}

function describeSettingsAction(
  action: string,
  meta: Record<string, unknown>,
): string {
  const field = typeof meta.field === 'string' ? meta.field : '';
  if (field) {
    return describeSettingsFieldChange(field, meta.after);
  }
  return SETTINGS_ACTION_LABELS[action] ?? action;
}

// `metadata`-Werte sind `unknown` (JSON) – nur string/number sicher
// stringifizieren, sonst droht "[object Object]" im Export.
function metaStr(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
}

/** Übersetzt einen AuditLog-Eintrag in denselben deutschen Text, den
 * describeActivity() im Frontend für die Zeitleiste zeigt (nur der Titel –
 * die "von {Akteur}"-Zusatzinfo steckt im Export bereits in der separaten
 * "Akteur"-Spalte, siehe UsersService.exportActivityCsv()). */
export function describeAuditAction(action: string, metadata: unknown): string {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  switch (action) {
    case 'user.created':
      return 'Konto erstellt';
    case 'user.role_changed': {
      const roleNames = Array.isArray(meta.roleNames)
        ? (meta.roleNames as string[]).join(', ')
        : '';
      return `Rolle geändert zu ${roleNames}`;
    }
    case 'user.password_changed':
      return 'Passwort geändert';
    case 'user.2fa_enabled':
      return 'Zwei-Faktor-Authentifizierung aktiviert';
    case 'user.2fa_disabled':
      return 'Zwei-Faktor-Authentifizierung deaktiviert';
    case 'media.uploaded': {
      const filename = metaStr(meta.filename);
      return `Medium hochgeladen${filename ? `: ${filename}` : ''}`;
    }
    case 'user.impersonate':
      return 'Sitzung durch Administrator übernommen';
    case 'website.stats_history_reset': {
      const count = metaStr(meta.deletedReports);
      return `Gemeldete Zählerstände zurückgesetzt${count ? ` (${count} Einträge gelöscht)` : ''}`;
    }
    case 'company.field_updated': {
      const fieldLabel =
        COMPANY_FIELD_LABELS[metaStr(meta.field)] ?? metaStr(meta.field);
      const verb = meta.wasEmpty ? 'ergänzt' : 'aktualisiert';
      return `${fieldLabel} ${verb}`;
    }
    case 'content.published': {
      const title = metaStr(meta.title);
      return title ? `„${title}“ veröffentlicht` : 'Inhalt veröffentlicht';
    }
    case 'deletion_request.completed':
      return `Betroffenenanfrage ${metaStr(meta.dsrId)} abgeschlossen`;
    case 'privacy_incident.reported':
      return `Vorfall „${metaStr(meta.title)}“ der Aufsichtsbehörde gemeldet`;
    case 'privacy_incident.subjects_notified':
      return `Betroffene zu „${metaStr(meta.title)}“ informiert`;
    case 'navigation.homepage_set': {
      const label = metaStr(meta.label);
      return label
        ? `„${label}“ als Startseite festgelegt`
        : 'Startseite festgelegt';
    }
    case 'navigation.homepage_unset': {
      const label = metaStr(meta.label);
      return label
        ? `„${label}“ ist nicht mehr die Startseite`
        : 'Startseite aufgehoben';
    }
    case 'auth.all_sessions_revoked':
      return `Alle Sitzungen beendet (${metaStr(meta.count) || '0'})`;
    case 'auth.password_reset_forced_all':
      return `Passwortwechsel für alle Konten erzwungen (${metaStr(meta.count) || '0'})`;
    default:
      if (action.startsWith('settings.')) {
        return describeSettingsAction(action, meta);
      }
      return action;
  }
}
