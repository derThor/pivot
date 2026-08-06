import Link from "next/link";
import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentEditorForm } from "@/components/content-editor-form";
import { getCategories, getContent, getContentTypes } from "@/lib/api-server";

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [content, contentTypes, categories] = await Promise.all([
    getContent(id),
    getContentTypes(),
    getCategories({ pageSize: 100 }),
  ]);

  if (!content) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Inhalt bearbeiten
          </h1>
          <p className="text-sm text-muted-foreground">{content.title}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/dashboard/content/${id}/versions`} />}
        >
          <History />
          Versionen anzeigen
        </Button>
      </div>
      <ContentEditorForm
        contentTypes={contentTypes ?? []}
        categories={categories?.items ?? []}
        content={content}
      />
    </div>
  );
}
