import { SettingsForm } from "@/components/settings-form";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { getMediaFolders, getSettings } from "@/lib/api-server";

export default async function SettingsPage() {
  const [settings, folders] = await Promise.all([
    getSettings(),
    getMediaFolders(),
  ]);
  const logoFolderId = folders?.find((folder) => folder.isSystem)?.id ?? null;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Einstellungen" />

      {settings === null ? (
        <PageContent>
          <p className="text-sm text-muted-foreground">
            Keine Berechtigung, Einstellungen zu verwalten.
          </p>
        </PageContent>
      ) : (
        <SettingsForm settings={settings} logoFolderId={logoFolderId} />
      )}
    </div>
  );
}
