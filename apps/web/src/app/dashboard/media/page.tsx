import { MediaUploadDialog } from "@/components/media-upload-dialog";
import { MediaCardActions } from "@/components/media-card-actions";
import { MediaPreviewDialog } from "@/components/media-preview-dialog";
import { getMediaList } from "@/lib/api-server";
import { formatBytes } from "@/lib/utils";

export default async function MediaPage() {
  const media = await getMediaList({ pageSize: 48 });
  const items = media?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Medien</h1>
          <p className="text-sm text-muted-foreground">
            Bilder und Dateien deines CMS.
          </p>
        </div>
        <MediaUploadDialog />
      </div>

      {items.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          Noch keine Medien vorhanden.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <figure
              key={item.id}
              className="flex flex-col gap-2 overflow-hidden rounded-lg border"
            >
              <MediaPreviewDialog item={item} />
              <figcaption className="flex flex-col gap-1 px-2 pb-2">
                <span className="truncate text-xs font-medium">
                  {item.filename}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(item.size)}
                </span>
                <MediaCardActions item={item} />
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
