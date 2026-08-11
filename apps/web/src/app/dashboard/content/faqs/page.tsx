import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalModulesManager } from "@/components/global-modules-manager";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { isFaqModuleType } from "@/components/block-field-output";
import {
  getGlobalModulesPaged,
  getModuleTypes,
  getPublicSettings,
} from "@/lib/api-server";

export default async function FaqsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;
  const [moduleTypes, settings] = await Promise.all([
    getModuleTypes(),
    getPublicSettings(),
  ]);

  const faqType = (moduleTypes ?? []).find((mt) =>
    isFaqModuleType(mt.schema.fields),
  );
  const globalModules = faqType
    ? await getGlobalModulesPaged({
        moduleTypeId: faqType.id,
        page,
        pageSize: settings?.defaultPageSize ?? 10,
      })
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader title="FAQs" />
        {faqType && (
          <Button render={<Link href="/dashboard/content/faqs/new" />}>
            <Plus />
            Neu anlegen
          </Button>
        )}
      </div>
      {faqType ? (
        <>
          <GlobalModulesManager
            items={globalModules?.items ?? []}
            editHrefBase="/dashboard/content/faqs"
          />
          {globalModules && (
            <PaginationControls
              page={globalModules.meta.page}
              pageCount={globalModules.meta.pageCount}
              buildHref={(p) => `?page=${p}`}
            />
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Kein Akkordeon/FAQ-Modul-Typ vorhanden.
        </p>
      )}
    </div>
  );
}
