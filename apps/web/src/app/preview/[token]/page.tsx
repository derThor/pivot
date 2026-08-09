import { Eye } from "lucide-react";
import { ContentPreviewRender } from "@/components/content-preview-render";
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
      <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
        <Eye className="size-4 shrink-0" />
        Dies ist eine Vorschau über einen Freigabe-Link – der Inhalt ist
        möglicherweise noch nicht veröffentlicht.
      </div>

      <ContentPreviewRender
        content={content}
        moduleTypes={moduleTypes}
        globalModules={globalModules}
      />
    </div>
  );
}
