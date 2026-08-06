import { SettingsForm } from "@/components/settings-form";
import { getMediaFolders, getSettings } from "@/lib/api-server";

export default async function SettingsPage() {
  const [settings, folders] = await Promise.all([
    getSettings(),
    getMediaFolders(),
  ]);
  const logoFolderId =
    folders?.find((folder) => folder.isSystem)?.id ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Einstellungen
        </h1>
        <p className="text-sm text-muted-foreground">
          Globale Konfiguration für Zugriff und Passwort-Regeln.
        </p>
      </div>

      {settings === null ? (
        <p className="text-sm text-muted-foreground">
          Keine Berechtigung, Einstellungen zu verwalten.
        </p>
      ) : (
        <SettingsForm settings={settings} logoFolderId={logoFolderId} />
      )}
    </div>
  );
}
