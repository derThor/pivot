import { notFound } from "next/navigation";
import { PageContent } from "@/components/page-content";
import { FormEditor } from "@/components/form-editor";
import { getForm, getMailTemplates } from "@/lib/api-server";

export default async function FormEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [form, mailTemplates] = await Promise.all([
    getForm(id),
    getMailTemplates(),
  ]);
  if (!form) notFound();

  const adminTemplate =
    mailTemplates?.find((t) => t.id === `${id}:admin_notification`) ?? null;

  return (
    <PageContent plain>
      <FormEditor form={form} adminTemplate={adminTemplate} />
    </PageContent>
  );
}
