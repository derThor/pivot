import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GalleryEditor } from "@/components/gallery-editor";
import { isGalleryModuleType } from "@/components/block-field-output";
import { getGlobalModule, getModuleTypes } from "@/lib/api-server";

export default async function GalleryEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [gallery, moduleTypes] = await Promise.all([
    getGlobalModule(id),
    getModuleTypes(),
  ]);

  if (!gallery) {
    notFound();
  }

  const galleryType = (moduleTypes ?? []).find((mt) =>
    isGalleryModuleType(mt.schema.fields),
  );
  if (!galleryType) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/dashboard/content/galleries" />}
        >
          <ArrowLeft />
          Zurück zu Galerien
        </Button>
      </div>
      <GalleryEditor gallery={gallery} moduleType={galleryType} />
    </div>
  );
}
