import { GlobalModulesManager } from "@/components/global-modules-manager";
import { GlobalModuleDialog } from "@/components/global-module-dialog";
import { PageHeader } from "@/components/page-header";
import { isFaqModuleType } from "@/components/block-field-output";
import { getGlobalModules, getModuleTypes } from "@/lib/api-server";

export default async function FaqsPage() {
  const [globalModules, moduleTypes] = await Promise.all([
    getGlobalModules(),
    getModuleTypes(),
  ]);

  const faqType = (moduleTypes ?? []).find((mt) =>
    isFaqModuleType(mt.schema.fields),
  );
  const items = faqType
    ? (globalModules ?? []).filter((gm) => gm.moduleTypeId === faqType.id)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader title="FAQs" />
        {faqType && <GlobalModuleDialog moduleType={faqType} />}
      </div>
      {faqType ? (
        <GlobalModulesManager items={items} moduleType={faqType} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Kein Akkordeon/FAQ-Modul-Typ vorhanden.
        </p>
      )}
    </div>
  );
}
