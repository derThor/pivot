import { CompanyView } from "@/components/company-view";
import { PageContent } from "@/components/page-content";
import {
  getCompanyChanges,
  getCompanyLocations,
  getSettings,
} from "@/lib/api-server";

export default async function CompanyPage() {
  const [settings, locations, changes] = await Promise.all([
    getSettings(),
    getCompanyLocations(),
    getCompanyChanges(),
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
    />
  );
}
