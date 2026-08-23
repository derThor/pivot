import { PageContent } from "@/components/page-content";
import { FormEditor } from "@/components/form-editor";

export default function NewFormPage() {
  return (
    <PageContent plain>
      <FormEditor form={null} adminTemplate={null} />
    </PageContent>
  );
}
