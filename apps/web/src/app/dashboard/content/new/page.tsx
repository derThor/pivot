import { ContentEditorForm } from "@/components/content-editor-form";
import { getCategories, getContentTypes, getPublicSettings } from "@/lib/api-server";

export default async function NewContentPage() {
  const [contentTypes, categories, settings] = await Promise.all([
    getContentTypes(),
    getCategories({ pageSize: 100 }),
    getPublicSettings(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Neuer Inhalt
        </h1>
        <p className="text-sm text-muted-foreground">
          Lege einen neuen Content-Eintrag an.
        </p>
      </div>

      {!contentTypes || contentTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Kein Content-Type vorhanden. Bitte zuerst einen Content-Type
          anlegen.
        </p>
      ) : (
        <ContentEditorForm
          contentTypes={contentTypes}
          categories={categories?.items ?? []}
          autosaveEnabled={settings?.autosaveEnabled ?? true}
        />
      )}
    </div>
  );
}
