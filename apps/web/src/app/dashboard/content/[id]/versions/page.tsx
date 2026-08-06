import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContentVersionsList } from "@/components/content-versions-list";
import { PaginationControls } from "@/components/pagination-controls";
import {
  getContent,
  getContentType,
  getContentVersions,
  getPublicSettings,
} from "@/lib/api-server";

export default async function ContentVersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;
  const content = await getContent(id);

  if (!content) {
    notFound();
  }

  const [contentType, settings] = await Promise.all([
    getContentType(content.contentType.id),
    getPublicSettings(),
  ]);
  const versions = await getContentVersions(id, {
    page,
    pageSize: settings?.defaultPageSize ?? 10,
  });
  const richtextFields =
    contentType?.schema.fields
      .filter((field) => field.type === "richtext")
      .map((field) => field.name) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2"
          render={<Link href={`/dashboard/content/${id}/edit`} />}
        >
          <ArrowLeft />
          Zurück zur Bearbeitung
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Versionshistorie
        </h1>
        <p className="text-sm text-muted-foreground">{content.title}</p>
      </div>
      <ContentVersionsList
        contentId={id}
        currentData={content.data}
        versions={versions?.items ?? []}
        richtextFields={richtextFields}
      />

      {versions && (
        <PaginationControls
          page={versions.meta.page}
          pageCount={versions.meta.pageCount}
          buildHref={(p) => `?page=${p}`}
        />
      )}
    </div>
  );
}
