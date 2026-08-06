import { FolderDialog } from "@/components/folder-dialog";
import { MediaFolderBrowser } from "@/components/media-folder-browser";
import { MediaUploadDialog } from "@/components/media-upload-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { getMediaFolders, getMediaList, getPublicSettings } from "@/lib/api-server";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; page?: string }>;
}) {
  const { folder, page: pageParam } = await searchParams;
  const currentFolderId = folder ?? null;
  const page = Number(pageParam) || 1;

  const [folders, settings] = await Promise.all([
    getMediaFolders(),
    getPublicSettings(),
  ]);
  const media = await getMediaList({
    page,
    pageSize: settings?.defaultPageSize ?? 10,
    folderId: currentFolderId ?? "root",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Medien</h1>
          <p className="text-sm text-muted-foreground">
            Bilder und Dateien deines CMS.
          </p>
        </div>
        <div className="flex gap-2">
          <FolderDialog parentId={currentFolderId} />
          <MediaUploadDialog
            folders={folders ?? []}
            defaultFolderId={currentFolderId}
          />
        </div>
      </div>

      <MediaFolderBrowser
        folders={folders ?? []}
        currentFolderId={currentFolderId}
        items={media?.items ?? []}
      />

      {media && (
        <PaginationControls
          page={media.meta.page}
          pageCount={media.meta.pageCount}
          buildHref={(p) =>
            currentFolderId
              ? `?folder=${currentFolderId}&page=${p}`
              : `?page=${p}`
          }
        />
      )}
    </div>
  );
}
