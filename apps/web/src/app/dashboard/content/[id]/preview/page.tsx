import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContentPreviewRender } from "@/components/content-preview-render";
import { PageContent } from "@/components/page-content";
import { getContent, getGlobalModules, getModuleTypes } from "@/lib/api-server";

/** Interne Vorschau für angemeldete Redakteure: nutzt dieselbe Authentifizierung
 * wie die Bearbeiten-Seite (kein Token, keine zeitliche Begrenzung). Für das
 * Teilen mit Außenstehenden gibt es stattdessen die Freigabe-Links
 * (`PreviewLinksDialog` → `/preview/[token]`). */
export default async function ContentStandardPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [content, moduleTypes, globalModules] = await Promise.all([
    getContent(id),
    getModuleTypes(),
    getGlobalModules(),
  ]);

  if (!content) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href={`/dashboard/content/${id}/edit`} />}
        >
          <ArrowLeft />
          Zurück zur Bearbeitung
        </Button>
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <Eye className="size-4 shrink-0" />
          Interne Vorschau – nur für angemeldete Redakteur:innen sichtbar, kein
          Freigabe-Link.
        </div>
      </div>

      <PageContent className="mx-auto max-w-3xl">
        <ContentPreviewRender
          content={content}
          moduleTypes={moduleTypes}
          globalModules={globalModules}
        />
      </PageContent>
    </div>
  );
}
