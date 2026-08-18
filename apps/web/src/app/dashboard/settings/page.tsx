import { SettingsForm } from "@/components/settings-form";
import { PageContent } from "@/components/page-content";
import { getMediaFolders, getSettings } from "@/lib/api-server";

export default async function SettingsPage() {
  const [settings, folders] = await Promise.all([
    getSettings(),
    getMediaFolders(),
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

  return <SettingsForm settings={settings} logoFolderId={logoFolderId} />;
}
