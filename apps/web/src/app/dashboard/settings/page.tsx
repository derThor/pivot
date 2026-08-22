import { SettingsForm } from "@/components/settings-form";
import { PageContent } from "@/components/page-content";
import {
  getMediaFolders,
  getSettings,
  getSettingsChanges,
  getSmtpSettings,
  getWebhooks,
} from "@/lib/api-server";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ webhooksPage?: string; protocolPage?: string }>;
}) {
  const { webhooksPage: webhooksPageParam, protocolPage: protocolPageParam } =
    await searchParams;
  const webhooksPage = Number(webhooksPageParam) || 1;
  const protocolPage = Number(protocolPageParam) || 1;

  const [settings, folders] = await Promise.all([
    getSettings(),
    getMediaFolders(),
  ]);
  // Eigener Query-Param `webhooksPage`/`protocolPage` statt `page`, damit
  // sich die Paginierungen der einzelnen Einstellungen-Abschnitte nicht
  // gegenseitig überschreiben.
  const [webhooks, settingsChanges, smtp] = await Promise.all([
    getWebhooks({
      page: webhooksPage,
      pageSize: settings?.defaultPageSize ?? 10,
    }),
    getSettingsChanges({
      page: protocolPage,
      pageSize: settings?.defaultPageSize ?? 10,
    }),
    getSmtpSettings(),
  ]);
  // Nach Namen filtern statt nur `isSystem`: seit dem "Avatare"-Systemordner
  // (Profilfoto-Upload, 2026-08-17) gibt es mehr als einen isSystem-Ordner.
  const logoFolderId =
    folders?.find((folder) => folder.isSystem && folder.name === "Logo")
      ?.id ?? null;

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
    />
  );
}
