import { NavigationsManager } from "@/components/navigations-manager";
import { NavigationDialog } from "@/components/navigation-dialog";
import { getNavigations } from "@/lib/api-server";

export default async function NavigationPage() {
  const navigations = await getNavigations();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Navigation</h1>
          <p className="text-sm text-muted-foreground">
            Menüs wie Hauptnavigation oder Footer verwalten.
          </p>
        </div>
        <NavigationDialog />
      </div>
      <NavigationsManager items={navigations ?? []} />
    </div>
  );
}
