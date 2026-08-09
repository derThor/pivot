import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { NavigationDialog } from "@/components/navigation-dialog";
import { NavigationItemDialog } from "@/components/navigation-item-dialog";
import { NavigationItemsEditor } from "@/components/navigation-items-editor";
import { getContentList, getNavigation } from "@/lib/api-server";

export default async function NavigationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [navigation, content] = await Promise.all([
    getNavigation(id),
    getContentList({ pageSize: 100 }),
  ]);

  if (!navigation) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="outline" size="sm" render={<Link href="/dashboard/navigation" />}>
          <ArrowLeft />
          Zurück zur Übersicht
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {navigation.name}
          </h1>
          <p className="text-sm text-muted-foreground">/{navigation.slug}</p>
          <DashboardBreadcrumbs />
        </div>
        <div className="flex gap-2">
          <NavigationDialog navigation={navigation} />
          <NavigationItemDialog
            navigationId={navigation.id}
            contentItems={content?.items ?? []}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <Plus />
                Eintrag hinzufügen
              </Button>
            }
          />
        </div>
      </div>
      <NavigationItemsEditor
        navigationId={navigation.id}
        items={navigation.items}
        contentItems={content?.items ?? []}
      />
    </div>
  );
}
