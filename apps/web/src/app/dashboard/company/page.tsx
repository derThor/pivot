import { CompanyView } from "@/components/company-view";
import { PageContent } from "@/components/page-content";
import {
  getCompanyChanges,
  getCompanyLocations,
  getCompanySettings,
  getPublicSettings,
} from "@/lib/api-server";

export default async function CompanyPage() {
  const [settings, locations, changes, publicSettings] = await Promise.all([
    getCompanySettings(),
    getCompanyLocations(),
    getCompanyChanges(),
    // Logo liegt auf der /settings-Zeile (settings:read), diese Seite
    // braucht aber nur company:read – daher über die ungeschützte
    // /settings/public-Route holen (Nutzervorgabe, 2026-08-27: "bei Firma
    // das eigene Logo aus Einstellungen hier rein").
    getPublicSettings(),
  ]);

  if (settings === null) {
    return (
      <div className="flex flex-col gap-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Firma</h1>
        </div>
        <PageContent>
          <p className="text-sm text-muted-foreground">
            Keine Berechtigung, Firmenangaben zu verwalten.
          </p>
        </PageContent>
      </div>
    );
  }

  return (
    <CompanyView
      settings={settings}
      locations={locations ?? []}
      changes={changes ?? []}
      logoUrl={publicSettings?.companyLogoUrl ?? null}
    />
  );
}
