import { SettingsForm } from "@/components/settings-form";
import { PageContent } from "@/components/page-content";
import {
  getJobRuns,
  getJobs,
  getMailTemplates,
  getMediaFolders,
  getSettings,
  getSettingsChanges,
  getSmtpSettings,
  getWebhooks,
  getWebsites,
} from "@/lib/api-server";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    webhooksPage?: string;
    protocolPage?: string;
    jobsPage?: string;
    jobsRunsPage?: string;
    mandantenPage?: string;
  }>;
}) {
  const {
    webhooksPage: webhooksPageParam,
    protocolPage: protocolPageParam,
    jobsPage: jobsPageParam,
    jobsRunsPage: jobsRunsPageParam,
    mandantenPage: mandantenPageParam,
  } = await searchParams;
  const webhooksPage = Number(webhooksPageParam) || 1;
  const protocolPage = Number(protocolPageParam) || 1;
  const jobsPage = Number(jobsPageParam) || 1;
  const jobsRunsPage = Number(jobsRunsPageParam) || 1;
  const mandantenPage = Number(mandantenPageParam) || 1;

  const [settings, folders] = await Promise.all([
    getSettings(),
    getMediaFolders(),
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
    websites,
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
    }),
    getMailTemplates(),
    getWebsites({
      page: mandantenPage,
      pageSize: settings?.defaultPageSize ?? 10,
    }),
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
      jobRuns={
        jobRuns ?? {
          items: [],
          meta: { page: 1, pageSize: 10, total: 0, pageCount: 1 },
        }
      }
      mailTemplates={mailTemplates ?? []}
      websites={
        websites ?? {
          items: [],
          meta: { page: 1, pageSize: 10, total: 0, pageCount: 1 },
        }
      }
    />
  );
}
