import { PrivacyView } from "@/components/privacy-view";
import {
  getDataProcessors,
  getDeletionRequests,
  getLegalDocuments,
  getPrivacyIncidents,
  getProcessingActivities,
  getRetentionAccessLogDue,
  getRetentionDeactivatedAccountsDue,
  getRetentionTrashDue,
  getSettings,
} from "@/lib/api-server";

export default async function PrivacyPage() {
  const [
    settings,
    legalDocuments,
    deletionRequests,
    processingActivities,
    dataProcessors,
    incidents,
    accessLogDue,
    deactivatedAccountsDue,
    trashDue,
  ] = await Promise.all([
    getSettings(),
    getLegalDocuments(),
    getDeletionRequests(),
    getProcessingActivities(),
    getDataProcessors(),
    getPrivacyIncidents(),
    getRetentionAccessLogDue(),
    getRetentionDeactivatedAccountsDue(),
    getRetentionTrashDue(),
  ]);

  if (settings === null) {
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
      settings={settings}
      legalDocuments={legalDocuments ?? []}
      deletionRequests={deletionRequests ?? []}
      processingActivities={processingActivities ?? []}
      dataProcessors={dataProcessors ?? []}
      incidents={incidents ?? []}
      accessLogDue={accessLogDue ?? []}
      deactivatedAccountsDue={deactivatedAccountsDue ?? []}
      trashDue={trashDue ?? { content: [], media: [], categories: [], tags: [] }}
    />
  );
}
