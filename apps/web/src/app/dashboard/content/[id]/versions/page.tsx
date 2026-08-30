import { notFound } from "next/navigation";

import { ContentVersionsExplorer } from "@/components/content-versions-explorer";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import {
  getContent,
  getContentVersions,
  getGlobalModules,
  getModuleTypes,
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

  const [settings, moduleTypes, globalModules] = await Promise.all([
    getPublicSettings(),
    getModuleTypes(),
    getGlobalModules(),
  ]);
  const versions = await getContentVersions(id, {
    page,
    pageSize: settings?.defaultPageSize ?? 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <DashboardBreadcrumbs />
      <ContentVersionsExplorer
        key={page}
        contentId={id}
        content={content}
        versions={versions?.items ?? []}
        meta={
          versions?.meta ?? { page: 1, pageSize: 10, total: 0, pageCount: 1 }
        }
        moduleTypes={moduleTypes ?? []}
        globalModules={globalModules ?? []}
      />
    </div>
  );
}
