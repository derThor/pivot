import { ContentEditorForm } from "@/components/content-editor-form";
import { getContentTypes } from "@/lib/api-server";

export default async function NewContentPage() {
  const contentTypes = (await getContentTypes()) ?? [];

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

      {contentTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Kein Content-Type vorhanden. Bitte zuerst einen Content-Type
          anlegen.
        </p>
      ) : (
        <ContentEditorForm contentTypes={contentTypes} />
      )}
    </div>
  );
}
