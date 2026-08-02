import { notFound } from "next/navigation";
import { ContentEditorForm } from "@/components/content-editor-form";
import { getContent, getContentTypes } from "@/lib/api-server";

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [content, contentTypes] = await Promise.all([
    getContent(id),
    getContentTypes(),
  ]);

  if (!content) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Inhalt bearbeiten
        </h1>
        <p className="text-sm text-muted-foreground">{content.title}</p>
      </div>
      <ContentEditorForm contentTypes={contentTypes ?? []} content={content} />
    </div>
  );
}
