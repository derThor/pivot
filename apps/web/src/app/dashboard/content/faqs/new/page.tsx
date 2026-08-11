import { notFound } from "next/navigation";
import { GlobalModulePageForm } from "@/components/global-module-page-form";
import { PageHeader } from "@/components/page-header";
import { isFaqModuleType } from "@/components/block-field-output";
import { getModuleTypes } from "@/lib/api-server";

export default async function NewFaqPage() {
  const moduleTypes = await getModuleTypes();
  const faqType = (moduleTypes ?? []).find((mt) =>
    isFaqModuleType(mt.schema.fields),
  );

  if (!faqType) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Neuer FAQ-Eintrag" />
      <GlobalModulePageForm
        moduleType={faqType}
        redirectTo="/dashboard/content/faqs"
      />
    </div>
  );
}
