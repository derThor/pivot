import Link from "next/link";
import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentEditorForm } from "@/components/content-editor-form";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { PreviewLinksDialog } from "@/components/preview-links-dialog";
import {
  getCategories,
  getContent,
  getContentTypes,
  getCurrentUser,
  getGlobalModules,
  getModuleTypes,
  getPublicSettings,
} from "@/lib/api-server";

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [content, contentTypes, moduleTypes, globalModules, categories, settings, user] =
    await Promise.all([
      getContent(id),
      getContentTypes(),
      getModuleTypes(),
      getGlobalModules(),
      getCategories({ pageSize: 100 }),
      getPublicSettings(),
      getCurrentUser(),
    ]);

  if (!content) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            Inhalt bearbeiten
          </h1>
          <p className="text-sm text-muted-foreground break-words">{content.title}</p>
          <DashboardBreadcrumbs />
        </div>
        <div className="flex flex-wrap gap-2">
          <PreviewLinksDialog contentId={id} />
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/dashboard/content/${id}/versions`} />}
          >
            <History />
            Versionen anzeigen
          </Button>
        </div>
      </div>
      <ContentEditorForm
        contentTypes={contentTypes ?? []}
        moduleTypes={moduleTypes ?? []}
        globalModules={globalModules ?? []}
        categories={categories?.items ?? []}
        content={content}
        autosaveEnabled={settings?.autosaveEnabled ?? true}
        canForceUnlock={user?.permissions?.includes("content:delete") ?? false}
      />
    </div>
  );
}
