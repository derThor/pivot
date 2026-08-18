import { ContentPreviewRender } from "@/components/content-preview-render";
import { PreviewBanner } from "@/components/preview-banner";
import {
  getContentByPreviewToken,
  getGlobalModules,
  getModuleTypes,
} from "@/lib/api-server";

export default async function ContentPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [content, moduleTypes, globalModules] = await Promise.all([
    getContentByPreviewToken(token),
    getModuleTypes(),
    getGlobalModules(),
  ]);

  if (!content) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 bg-background p-8 text-center">
        <h1 className="text-xl font-semibold">Vorschau nicht verfügbar</h1>
        <p className="text-sm text-muted-foreground">
          Dieser Link ist ungültig oder abgelaufen.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 bg-background p-8">
      <PreviewBanner title="Dies ist eine Vorschau über einen Freigabe-Link – der Inhalt ist möglicherweise noch nicht veröffentlicht." />

      <ContentPreviewRender
        content={content}
        moduleTypes={moduleTypes}
        globalModules={globalModules}
      />
    </div>
  );
}
