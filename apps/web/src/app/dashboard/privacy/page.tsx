import { PrivacyView } from "@/components/privacy-view";
import {
  getCompanySettings,
  getDataProcessors,
  getDeletionRequests,
  getLegalDocuments,
  getMediaFolders,
  getPrivacyIncidents,
  getPrivacySettings,
  getProcessingActivities,
  getPublicSettings,
  getRetentionAccessLogDue,
  getRetentionDeactivatedAccountsDue,
  getRetentionTrashDue,
  getUsers,
} from "@/lib/api-server";

export default async function PrivacyPage() {
  const [
    privacySettings,
    companySettings,
    publicSettings,
    legalDocuments,
    deletionRequests,
    processingActivities,
    dataProcessors,
    incidents,
    accessLogDue,
    deactivatedAccountsDue,
    trashDue,
    users,
    mediaFolders,
  ] = await Promise.all([
    // Zwei getrennte, engere Endpunkte statt getSettings() (Recht
    // `settings:read`, das Administrator seit der Pivot-Einführung nicht
    // mehr hat) – die Seite braucht nur `privacy:*`/`company:*`, beide
    // hat Administrator weiterhin (Nutzer-Bugreport, 2026-08-21: "warum
    // habe ich als admin keine datenschutz zugriffsrechte").
    getPrivacySettings(),
    // Für den Pflichtangaben-Check (Firmierung, Anschrift, USt-IdNr. …).
    getCompanySettings(),
    // `getPrivacySettings()` hat kein `sccTemplateMedia` (kein Include im
    // Backend, siehe SettingsService.get() vs. getPublic()) – deshalb
    // zusätzlich die public-Variante nur für dieses eine Feld.
    getPublicSettings(),
    getLegalDocuments(),
    getDeletionRequests(),
    getProcessingActivities(),
    getDataProcessors(),
    getPrivacyIncidents(),
    getRetentionAccessLogDue(),
    getRetentionDeactivatedAccountsDue(),
    getRetentionTrashDue(),
    getUsers({ pageSize: 100 }),
    getMediaFolders(),
  ]);
  const avsFolderId =
    mediaFolders?.find((f) => f.name === "AVs" && f.isSystem)?.id ?? null;

  if (privacySettings === null || companySettings === null) {
    return (
      <div className="flex flex-col gap-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Datenschutz
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Keine Berechtigung, den Datenschutz-Bereich zu verwalten.
        </p>
      </div>
    );
  }

  return (
    <PrivacyView
      settings={{ ...companySettings, ...privacySettings }}
      legalDocuments={legalDocuments ?? []}
      deletionRequests={deletionRequests ?? []}
      processingActivities={processingActivities ?? []}
      dataProcessors={dataProcessors ?? []}
      incidents={incidents ?? []}
      accessLogDue={accessLogDue ?? []}
      deactivatedAccountsDue={deactivatedAccountsDue ?? []}
      trashDue={trashDue ?? { content: [], media: [], categories: [], tags: [] }}
      users={users?.items ?? []}
      avsFolderId={avsFolderId}
      sccTemplateMedia={publicSettings?.sccTemplateMedia ?? null}
    />
  );
}
