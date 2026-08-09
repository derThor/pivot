import { NavigationsManager } from "@/components/navigations-manager";
import { NavigationDialog } from "@/components/navigation-dialog";
import { PageHeader } from "@/components/page-header";
import { getNavigations } from "@/lib/api-server";

export default async function NavigationPage() {
  const navigations = await getNavigations();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Menüs" />
        <NavigationDialog />
      </div>
      <NavigationsManager items={navigations ?? []} />
    </div>
  );
}
