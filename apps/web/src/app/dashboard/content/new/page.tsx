import { ContentEditorForm } from "@/components/content-editor-form";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import {
  getAllTags,
  getCategories,
  getContentTypes,
  getGlobalModules,
  getModuleTypes,
  getPublicSettings,
} from "@/lib/api-server";

export default async function NewContentPage() {
  const [contentTypes, moduleTypes, globalModules, categories, tags, settings] =
    await Promise.all([
      getContentTypes(),
      getModuleTypes(),
      getGlobalModules(),
      getCategories({ pageSize: 100 }),
      getAllTags(),
      getPublicSettings(),
    ]);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Neuer Inhalt" />

      {!contentTypes || contentTypes.length === 0 ? (
        <PageContent>
          <p className="text-sm text-muted-foreground">
            Kein Content-Type vorhanden. Bitte zuerst einen Content-Type
            anlegen.
          </p>
        </PageContent>
      ) : (
        <ContentEditorForm
          contentTypes={contentTypes}
          moduleTypes={moduleTypes ?? []}
          globalModules={globalModules ?? []}
          categories={categories?.items ?? []}
          tags={tags ?? []}
          autosaveEnabled={settings?.autosaveEnabled ?? true}
        />
      )}
    </div>
  );
}
