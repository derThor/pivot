import { SettingsForm } from "@/components/settings-form";
import { PageContent } from "@/components/page-content";
import {
  getJobRuns,
  getJobs,
  getMailShells,
  getMailTemplates,
  getMediaFolders,
  getNavigations,
  getLicenseState,
  getModuleSettings,
  getSettings,
  getSettingsChanges,
  getSmtpSettings,
  getWebhooks,
  getWebsites,
  getWebsiteStatsHistory,
} from "@/lib/api-server";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    webhooksPage?: string;
    protocolPage?: string;
    jobsPage?: string;
    jobsRunsPage?: string;
    jobsRunsStatus?: string;
    mandantenPage?: string;
  }>;
}) {
  const {
    webhooksPage: webhooksPageParam,
    protocolPage: protocolPageParam,
    jobsPage: jobsPageParam,
    jobsRunsPage: jobsRunsPageParam,
    jobsRunsStatus: jobsRunsStatusParam,
    mandantenPage: mandantenPageParam,
  } = await searchParams;
  const webhooksPage = Number(webhooksPageParam) || 1;
  const protocolPage = Number(protocolPageParam) || 1;
  const jobsPage = Number(jobsPageParam) || 1;
  const jobsRunsPage = Number(jobsRunsPageParam) || 1;
  // Reiter der "Letzte Läufe"-Karte. Alles Unbekannte fällt auf "alle"
  // zurück, damit eine von Hand verbogene URL keine leere Karte erzeugt.
  const jobsRunsStatus =
    jobsRunsStatusParam === "success" || jobsRunsStatusParam === "error"
      ? jobsRunsStatusParam
      : undefined;
  const mandantenPage = Number(mandantenPageParam) || 1;

  const [settings, folders, navigations] = await Promise.all([
    getSettings(),
    getMediaFolders(),
    // Für die drei Menü-Auswahlfelder unter Frontend (Header + zwei
    // Footer-Spalten). `null` bei fehlendem Menü-Recht – die Felder
    // zeigen dann einen Hinweis statt einer leeren Liste.
    getNavigations({ pageSize: 100 }),
  ]);
  // Eigener Query-Param `webhooksPage`/`protocolPage`/`jobsRunsPage` statt
  // `page`, damit sich die Paginierungen der einzelnen
  // Einstellungen-Abschnitte nicht gegenseitig überschreiben.
  const [
    webhooks,
    settingsChanges,
    smtp,
    jobs,
    jobRuns,
    mailTemplates,
    mailShells,
    websites,
    statsHistory,
    moduleSettings,
    licenseState,
  ] = await Promise.all([
    getWebhooks({
      page: webhooksPage,
      pageSize: settings?.defaultPageSize ?? 10,
    }),
    getSettingsChanges({
      page: protocolPage,
      pageSize: settings?.defaultPageSize ?? 10,
    }),
    getSmtpSettings(),
    getJobs({ page: jobsPage, pageSize: settings?.defaultPageSize ?? 10 }),
    getJobRuns({
      page: jobsRunsPage,
      pageSize: settings?.defaultPageSize ?? 10,
      status: jobsRunsStatus,
    }),
    getMailTemplates(),
    getMailShells(),
    getWebsites({
      page: mandantenPage,
      pageSize: settings?.defaultPageSize ?? 10,
    }),
    // Ohne eigene Seitenzahl: der Verlauf wird je Mandanten-Zeile
    // angezeigt, nicht als eigene Liste. Die Obergrenze ist bewusst hoch
    // gewählt – pro Website entstehen nur Einträge bei echten Änderungen
    // und höchstens 50 (siehe WebsitesService.recordStatsReport()).
    getWebsiteStatsHistory({ pageSize: 200 }),
    // 404 auf einer Client-Installation (`MasterOnlyGuard`) – dann `null`,
    // die "Module"-Sidebar-Sektion wird dort ohnehin nicht angezeigt.
    getModuleSettings(),
    getLicenseState(),
  ]);
  // Nach Namen filtern statt nur `isSystem`: seit dem "Avatare"-Systemordner
  // (Profilfoto-Upload, 2026-08-17) gibt es mehr als einen isSystem-Ordner.
  const logoFolderId =
    folders?.find((folder) => folder.isSystem && folder.name === "Logo")?.id ??
    null;

  if (settings === null) {
    return (
      <div className="flex flex-col gap-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Einstellungen
          </h1>
        </div>
        <PageContent>
          <p className="text-sm text-muted-foreground">
            Keine Berechtigung, Einstellungen zu verwalten.
          </p>
        </PageContent>
      </div>
    );
  }

  return (
    <SettingsForm
      settings={settings}
      navigations={navigations?.items ?? []}
      licenseState={licenseState}
      logoFolderId={logoFolderId}
      webhooks={webhooks}
      settingsChanges={settingsChanges}
      smtp={
        smtp ?? {
          host: null,
          port: null,
          username: null,
          hasPassword: false,
          fromAddress: null,
          fromName: null,
          secure: "starttls",
          verifiedAt: null,
          configured: false,
        }
      }
      jobs={
        jobs ?? {
          items: [],
          meta: { page: 1, pageSize: 10, total: 0, pageCount: 1 },
        }
      }
      jobRunsStatus={jobsRunsStatus}
      jobRuns={
        jobRuns ?? {
          items: [],
          meta: { page: 1, pageSize: 10, total: 0, pageCount: 1 },
        }
      }
      mailTemplates={mailTemplates ?? []}
      mailShells={mailShells ?? []}
      websites={
        websites ?? {
          items: [],
          meta: { page: 1, pageSize: 10, total: 0, pageCount: 1 },
        }
      }
      statsHistory={
        statsHistory ?? {
          items: [],
          meta: { page: 1, pageSize: 10, total: 0, pageCount: 1 },
        }
      }
      moduleSettings={moduleSettings}
    />
  );
}
